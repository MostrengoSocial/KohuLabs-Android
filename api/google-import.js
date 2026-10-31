// Brings each person's real day in from Google: today's Calendar events and the Gmail threads waiting on them.
// Runs on the Worker's schedule (wrangler.jsonc "triggers") and right after a sign-in (index.js, on the next sync).
//
//   Calendar  today's events in the primary calendar (not all-day, not declined) become a task, a "meet" chunk at their
//             real time in the Kohu workspace, and a meeting with its attendees and link. Moved events move; events
//             gone from today are marked deleted. What the phone did to a chunk (done, skipped, its timer) is kept.
//   Gmail     unread threads in the inbox from people (not Promotions, Social, Updates, Forums; not newsletters, no-reply
//             or other automated mail) become "waiting on you" follow-ups, from the sender and subject only (the
//             gmail.metadata scope cannot read bodies). A thread that is no longer unread is done. The signed-in account
//             (hello@kohulabs.com: new clients) goes to Kohu; linked accounts (google_links: personal Gmail) to Personal.
//   Nudge     one "your day" nudge per day, in the person's language, updated until they answer it.
//
// Rows get a seq like any synced change, so phones pull them on their next sync. Ids are prefixed (cal:, gm:, brief:)
// so imported rows never collide with rows made on a phone.
import { googleConfig, refreshAccess, unseal } from './google.js';
import { migrate, reserve } from './sync.js';

const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const SCOPE_CAL = 'https://www.googleapis.com/auth/calendar.readonly';
const SCOPE_GMAIL = 'https://www.googleapis.com/auth/gmail.metadata';
export const IMPORT_SCOPES = [SCOPE_CAL, SCOPE_GMAIL];
/** For another Gmail added to the import (index.js /auth/google/link): its mail only. */
export const LINK_SCOPES = [SCOPE_GMAIL];
const EVERY_MS = 50 * 60 * 1000;                     // after a sync, import again only if the last one is this old
// Each message is one request to Google; a Worker run can make only so many (50 on the Free plan), so per mailbox:
const MAX_EVENTS = 50, MAX_THREADS = 20, MAX_MESSAGES = 20;
// Gmail's other tabs: mail there is not waiting on anyone. Read from each message's labels, not as a filter on the list,
// because an inbox without tabs may not mark its mail as Primary (CATEGORY_PERSONAL) at all.
const NOT_PERSONAL = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS'];
// Mail sent by machines, not people: lists and newsletters (List-Unsubscribe, List-Id, Precedence), auto-replies and
// notifications (Auto-Submitted), and the usual no-reply addresses.
const AUTOMATED = /^(?:no-?reply|do-?not-?reply|notifications?|notify|mailer-daemon|postmaster|bounces?|alerts?|newsletters?)(?:[+._-][^@]*)?@/i;
const MAIL_HEADERS = ['From', 'Subject', 'List-Unsubscribe', 'List-Id', 'Precedence', 'Auto-Submitted'];
// Calendar event types that are meetings (fromGmail: flights, reservations and the like that Gmail adds)
const MEETING_TYPES = ['default', 'fromGmail'];

// Local date and clock time in the person's time zone.
function local(ms, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

async function google(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw Object.assign(new Error(`google ${res.status}`), { status: res.status });
  return res.json();
}

// "Ana Reis <ana@x.pt>" → "Ana Reis"; "ana@x.pt" → "ana@x.pt"
const address = (from) => (String(from || '').match(/<([^>]+)>/) || [, String(from || '')])[1].trim().toLowerCase();
const sender = (from) => (String(from || '').match(/^\s*"?([^"<]+?)"?\s*</) || [])[1] || String(from || '').replace(/[<>]/g, '').trim() || '?';

const TEXT = {
  en: { kind: 'Today', ok: 'OK', title: (m, e) => `Today: ${m} meeting${m === 1 ? '' : 's'}, ${e} email${e === 1 ? '' : 's'} waiting`,
    body: (first) => (first ? `First at ${first.start}: ${first.title}. ` : 'No meetings today. ') + 'Your meetings are in Today; emails waiting on you are in Inbox › Follow-ups.' },
  pt: { kind: 'Hoje', ok: 'Ok', title: (m, e) => `Hoje: ${m} ${m === 1 ? 'reunião' : 'reuniões'}, ${e} email${e === 1 ? '' : 's'} à espera`,
    body: (first) => (first ? `A primeira às ${first.start}: ${first.title}. ` : 'Sem reuniões hoje. ') + 'As reuniões estão no Hoje; os emails à tua espera estão em Avisos › Pendentes.' },
};

/** Imports today for one person. Returns { ok, meetings, emails } or { ok: false, error }. */
export async function importFor(env, userId, { now = Date.now() } = {}) {
  const db = env.DB;
  await migrate(db);
  const acct = (await db.prepare('SELECT * FROM google_accounts WHERE user_id = ?').bind(userId).all()).results[0];
  if (!acct) return { ok: false, error: 'no_account' };
  const fail = async (error) => {
    await db.prepare('UPDATE google_accounts SET last_import_at = ?, last_error = ? WHERE user_id = ?').bind(now, error, userId).run();
    return { ok: false, error };
  };
  const refresh = await unseal(acct.refresh_token, env.SESSION_SECRET);
  if (!refresh) return fail('reauth');
  const access = await refreshAccess(googleConfig(env), refresh);
  if (access.error) return fail(access.error === 'revoked' ? 'reauth' : access.error);
  const scopes = access.scope || acct.scopes;
  const tz = env.TIMEZONE || 'Europe/Lisbon';
  const today = local(now, tz).date;
  const statements = [];
  const errors = [];

  // ---- Calendar ----
  const meetings = [];
  if (scopes.includes(SCOPE_CAL)) {
    try {
      const q = new URLSearchParams({ timeMin: new Date(now - 36 * 3600e3).toISOString(), timeMax: new Date(now + 36 * 3600e3).toISOString(),
        singleEvents: 'true', orderBy: 'startTime', maxResults: String(MAX_EVENTS) });
      const { items = [] } = await google(`${CAL}?${q}`, access.accessToken);
      for (const ev of items) {
        if (ev.status === 'cancelled' || !ev.start || !ev.start.dateTime || (ev.eventType && !MEETING_TYPES.includes(ev.eventType))) continue;
        if ((ev.attendees || []).some((a) => a.self && a.responseStatus === 'declined')) continue;
        const start = Date.parse(ev.start.dateTime), end = Date.parse(ev.end && ev.end.dateTime);
        const at = local(start, tz);
        if (at.date !== today || !ev.id || ev.id.length > 90) continue;
        meetings.push({ id: `cal:${ev.id}`, title: String(ev.summary || '(no title)').slice(0, 200), date: at.date, start: at.time,
          minutes: Math.max(5, Math.min(240, Math.round(((end || start + 30 * 60e3) - start) / 60e3))),
          prep: JSON.stringify({ attendees: (ev.attendees || []).filter((a) => !a.self && !a.resource).map((a) => a.displayName || a.email).slice(0, 20),
            link: ev.hangoutLink || null, location: ev.location || null, organizer: ev.organizer && (ev.organizer.displayName || ev.organizer.email) || null }) });
      }
    } catch (e) { errors.push(`calendar ${e.status || 'error'}`); }
    for (const m of meetings) {
      statements.push((seq) => db.prepare(
        `INSERT INTO tasks (user_id, seq, id, workspace_id, title, category, source, due_date, status, created_at, updated_at, deleted)
         VALUES (?, ?, ?, 'kohu', ?, 'meet', 'calendar', ?, 'open', ?, ?, 0)
         ON CONFLICT (user_id, id) DO UPDATE SET seq = excluded.seq, title = excluded.title, due_date = excluded.due_date, deleted = 0, updated_at = excluded.updated_at
         WHERE tasks.title IS NOT excluded.title OR tasks.due_date IS NOT excluded.due_date OR tasks.deleted <> 0`)
        .bind(userId, seq, m.id, m.title, m.date, now, now));
      statements.push((seq) => db.prepare(
        `INSERT INTO chunks (user_id, seq, id, task_id, workspace_id, date, start, minutes, title, category, status, updated_at, deleted)
         VALUES (?, ?, ?, ?, 'kohu', ?, ?, ?, ?, 'meet', 'planned', ?, 0)
         ON CONFLICT (user_id, id) DO UPDATE SET seq = excluded.seq, date = excluded.date, start = excluded.start, minutes = excluded.minutes, title = excluded.title, deleted = 0, updated_at = excluded.updated_at
         WHERE chunks.date IS NOT excluded.date OR chunks.start IS NOT excluded.start OR chunks.minutes IS NOT excluded.minutes OR chunks.title IS NOT excluded.title OR chunks.deleted <> 0`)
        .bind(userId, seq, m.id, m.id, m.date, m.start, m.minutes, m.title, now));
      statements.push((seq) => db.prepare(
        `INSERT INTO meetings (user_id, seq, id, workspace_id, title, date, start, minutes, prep, recap, updated_at, deleted)
         VALUES (?, ?, ?, 'kohu', ?, ?, ?, ?, ?, '{}', ?, 0)
         ON CONFLICT (user_id, id) DO UPDATE SET seq = excluded.seq, title = excluded.title, date = excluded.date, start = excluded.start, minutes = excluded.minutes, prep = excluded.prep, deleted = 0, updated_at = excluded.updated_at
         WHERE meetings.title IS NOT excluded.title OR meetings.date IS NOT excluded.date OR meetings.start IS NOT excluded.start OR meetings.minutes IS NOT excluded.minutes OR meetings.prep IS NOT excluded.prep OR meetings.deleted <> 0`)
        .bind(userId, seq, m.id, m.title, m.date, m.start, m.minutes, m.prep, now));
    }
    if (!errors.length) {
      // Events no longer on today's calendar (moved to another day, deleted, declined).
      const keep = JSON.stringify(meetings.map((m) => m.id));
      for (const table of ['chunks', 'meetings']) {
        statements.push((seq) => db.prepare(`UPDATE ${table} SET deleted = 1, seq = ?, updated_at = ? WHERE user_id = ? AND date = ? AND id LIKE 'cal:%' AND deleted = 0 AND id NOT IN (SELECT value FROM json_each(?))`)
          .bind(seq, now, userId, today, keep));
      }
    }
  }

  // ---- Gmail: this account (Kohu), then linked ones (Personal) ----
  let emails = 0;
  const self = [userId];
  const links = (await db.prepare('SELECT * FROM google_links WHERE user_id = ?').bind(userId).all()).results;
  for (const l of links) self.push(l.email);
  const mailbox = async (token, prefix, workspace, source) => {
    const threads = await waiting(token, tz, now, self);
    emails += threads.length;
    for (const t of threads) {
      statements.push((seq) => db.prepare(
        `INSERT INTO follow_ups (user_id, seq, id, workspace_id, person, what, direction, since, source, status, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, 'you', ?, ?, 'open', ?, 0) ON CONFLICT (user_id, id) DO NOTHING`)
        .bind(userId, seq, prefix + t.thread, workspace, t.person, t.what, t.since, source, now));
    }
    // Read (or archived) since the last import: no longer waiting.
    statements.push((seq) => db.prepare(`UPDATE follow_ups SET status = 'done', seq = ?, updated_at = ? WHERE user_id = ? AND id LIKE ? AND status = 'open' AND deleted = 0 AND id NOT IN (SELECT value FROM json_each(?))`)
      .bind(seq, now, userId, prefix + '%', JSON.stringify(threads.map((t) => prefix + t.thread))));
  };
  if (scopes.includes(SCOPE_GMAIL)) {
    try { await mailbox(access.accessToken, 'gm:', 'kohu', 'Gmail'); } catch (e) { errors.push(`gmail ${e.status || 'error'}`); }
  }
  for (const l of links) {
    let error = null;
    const token = await unseal(l.refresh_token, env.SESSION_SECRET);
    const a = token ? await refreshAccess(googleConfig(env), token) : { error: 'revoked' };
    if (a.error) error = a.error === 'revoked' ? 'reauth' : a.error;
    else {
      try { await mailbox(a.accessToken, await linkPrefix(l.email), 'personal', l.email); } catch (e) { error = `gmail ${e.status || 'error'}`; }
    }
    await db.prepare('UPDATE google_links SET last_import_at = ?, last_error = ? WHERE user_id = ? AND email = ?').bind(now, error, userId, l.email).run();
  }

  // ---- the day's nudge, in the person's language ----
  if (scopes.includes(SCOPE_CAL) || scopes.includes(SCOPE_GMAIL)) {
    const langRow = (await db.prepare("SELECT value FROM settings WHERE user_id = ? AND id = 'lang'").bind(userId).all()).results[0];
    let lang = 'en';
    try { lang = JSON.parse(langRow.value) === 'pt' ? 'pt' : 'en'; } catch (_) { /* default */ }
    const t = TEXT[lang];
    const first = meetings.find((m) => m.start >= local(now, tz).time) || meetings[0];
    statements.push((seq) => db.prepare(
      `INSERT INTO nudges (user_id, seq, id, workspace_id, kind, tone, time_label, title, body, actions, go, created_at, updated_at, deleted)
       VALUES (?, ?, ?, NULL, ?, 'info', ?, ?, ?, ?, NULL, ?, ?, 0)
       ON CONFLICT (user_id, id) DO UPDATE SET seq = excluded.seq, title = excluded.title, body = excluded.body, time_label = excluded.time_label, updated_at = excluded.updated_at
       WHERE nudges.answer IS NULL AND (nudges.title IS NOT excluded.title OR nudges.body IS NOT excluded.body)`)
      .bind(userId, seq, `brief:${today}`, t.kind, local(now, tz).time, t.title(meetings.length, emails), t.body(first), JSON.stringify([t.ok]), now, now));
  }

  if (statements.length) {
    let seq = (await reserve(db, userId, statements.length)) - statements.length;
    const prepared = statements.map((s) => s(++seq));
    for (let i = 0; i < prepared.length; i += 50) await db.batch(prepared.slice(i, i + 50));
  }
  await db.prepare('UPDATE google_accounts SET scopes = ?, last_import_at = ?, last_import_date = ?, last_error = ? WHERE user_id = ?')
    .bind(scopes, now, today, errors.join(', ') || null, userId).run();
  return { ok: !errors.length, meetings: meetings.length, emails, error: errors.join(', ') || undefined };
}

/** The follow-up id prefix for a linked account's threads: gl: and a short hash of its address. */
export async function linkPrefix(email) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email)));
  return `gl:${[...h.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('')}:`;
}

/** Unread inbox threads from people, newest first: [{ thread, person, what, since }]. [self]: the person's own addresses. */
async function waiting(token, tz, now, self) {
  const q = new URLSearchParams([['labelIds', 'INBOX'], ['labelIds', 'UNREAD'], ['maxResults', String(MAX_MESSAGES)]]);
  const { messages = [] } = await google(`${GMAIL}?${q}`, token);
  const headers = MAIL_HEADERS.map((h) => `&metadataHeaders=${h}`).join('');
  const seen = new Set(), out = [];
  for (const { id } of messages) {
    const m = await google(`${GMAIL}/${encodeURIComponent(id)}?format=metadata${headers}`, token);
    if (!m.threadId || seen.has(m.threadId)) continue;
    seen.add(m.threadId);
    if ((m.labelIds || []).some((l) => NOT_PERSONAL.includes(l))) continue;
    const h = Object.fromEntries((m.payload && m.payload.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    if (!fromPerson(h, self)) continue;
    out.push({ thread: m.threadId, person: sender(h.from).slice(0, 120), what: String(h.subject || '(no subject)').slice(0, 300), since: local(Number(m.internalDate) || now, tz).date });
    if (out.length >= MAX_THREADS) break;
  }
  return out;
}

/** Whether a message's headers look like a person wrote it (see AUTOMATED), and not the person themselves. */
function fromPerson(h, self) {
  if (h['list-unsubscribe'] || h['list-id'] || /^(bulk|list|junk)$/i.test(String(h.precedence || '').trim())) return false;
  if (h['auto-submitted'] && !/^no$/i.test(String(h['auto-submitted']).trim())) return false;
  const from = address(h.from);
  return !!from && !AUTOMATED.test(from) && !self.includes(from);
}

/** For a sync: import in the background if this person's last import is over EVERY_MS old (or never ran). */
export async function importIfDue(env, userId, now = Date.now()) {
  await migrate(env.DB);
  const acct = (await env.DB.prepare('SELECT last_import_at, last_error FROM google_accounts WHERE user_id = ?').bind(userId).all()).results[0];
  if (!acct || acct.last_error === 'reauth' || (acct.last_import_at && now - acct.last_import_at < EVERY_MS)) return null;
  return importFor(env, userId, { now });
}

/** The schedule: everyone with Google connected, one after the other. */
export async function importAll(env, now = Date.now()) {
  await migrate(env.DB);
  const people = (await env.DB.prepare("SELECT user_id FROM google_accounts WHERE last_error IS NOT 'reauth'").all()).results;
  const out = [];
  for (const p of people) out.push(await importFor(env, p.user_id, { now }).catch((e) => ({ ok: false, error: String(e && e.message || e) })));
  return out;
}
