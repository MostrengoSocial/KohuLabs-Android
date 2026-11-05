// Tests for the kohulabs-android API: the app's sign-in and sync. No dependencies: `node --test api/test.mjs`
// (Node 22+; Node's SQLite stands in for D1, see fake-d1.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';
import { sign, verify } from './google.js';
import { FakeD1 } from './fake-d1.mjs';
import { PAGE } from './sync.js';

const SECRET = 'f'.repeat(40);
const ENV = { GOOGLE_CLIENT_ID: 'client-kohulabs-android', GOOGLE_CLIENT_SECRET: 'shh', SESSION_SECRET: SECRET, FOUNDER_EMAILS: 'hello@kohulabs.com, ana@kohulabs.com' };
const BASE = 'https://android.kohulabs.com';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const idToken = (c) => `${b64({ alg: 'RS256' })}.${b64(c)}.sig`;
const now = () => Math.floor(Date.now() / 1000);
const call = (path, { method = 'GET', cookie, headers = {}, body, env = ENV } = {}) =>
  worker.fetch(new Request(BASE + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers }, body }), env);
const post = (path, body, { token, env = ENV } = {}) =>
  call(path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, env });
const cookieHeader = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ');

const pkce = async () => {
  const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  return { verifier, challenge };
};

// The app's whole sign-in: browser tab to /auth/google, pretend Google, back to the app, code → token.
async function signIn({ email = 'hello@kohulabs.com', env = ENV, verifierOverride, claims = {}, redirect } = {}) {
  const { verifier, challenge } = await pkce();
  const start = await call(`/auth/google?challenge=${challenge}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}`, { env });
  const auth = new URL(start.headers.get('Location'));
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = new URLSearchParams(init.body);
    return new Response(JSON.stringify({ id_token: idToken({ iss: 'https://accounts.google.com', aud: ENV.GOOGLE_CLIENT_ID, nonce: auth.searchParams.get('nonce'), exp: now() + 600, email, email_verified: true, name: 'João Duarte', ...claims }) }), { status: 200 });
  };
  const back = await call(`/auth/google/callback?code=abc&state=${auth.searchParams.get('state')}`, { cookie: cookieHeader(start), env });
  const to = new URL(back.headers.get('Location'));
  if (!to.searchParams.get('code')) return { start, auth, back, to, seen };
  const res = await post('/api/token', { code: to.searchParams.get('code'), verifier: verifierOverride || verifier }, { env });
  return { start, auth, back, to, seen, res, body: await res.json() };
}

test('status: says whether sign-in and the database are set up', async () => {
  assert.deepEqual(await (await call('/api/status', { env: {} })).json(), { configured: false, sync: false });
  assert.deepEqual(await (await call('/api/status', { env: { ...ENV, DB: new FakeD1() } })).json(), { configured: true, sync: true });
  assert.equal((await call('/auth/google?challenge=' + 'a'.repeat(43), { env: {} })).status, 503);
});

test('sign-in: Google with PKCE on this Worker; the tab ends in the app with a code; code + verifier make a 90-day token', async () => {
  const { start, auth, back, to, seen, res, body } = await signIn();
  assert.equal(auth.searchParams.get('redirect_uri'), `${BASE}/auth/google/callback`);
  assert.equal(auth.searchParams.get('client_id'), 'client-kohulabs-android');
  assert.match(start.headers.getSetCookie()[0], /^__Host-kohulabs_android_oauth=.*HttpOnly.*Secure/);
  // Browsers only keep a __Host- cookie with Path=/ (and no Domain); any other path and it is silently dropped.
  for (const c of [start.headers.getSetCookie()[0], back.headers.getSetCookie()[0]]) { assert.match(c, /; Path=\/;/); assert.doesNotMatch(c, /Domain=/i); }
  assert.equal(Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seen.get('code_verifier')))).toString('base64url'), auth.searchParams.get('code_challenge'));
  assert.equal(to.protocol + to.pathname, 'com.kohulabs.android:/signed-in');
  assert.match(back.headers.getSetCookie()[0], /__Host-kohulabs_android_oauth=; .*Max-Age=0/);
  assert.equal(res.status, 200);
  assert.equal(body.email, 'hello@kohulabs.com'); assert.equal(body.name, 'João Duarte');
  assert.ok(body.expiresAt > now() + 89 * 24 * 3600);
  assert.equal((await verify(body.token, SECRET)).kind, 'app');
});

test('the desktop app signs in through its loopback address, and only that', async () => {
  const back = 'http://127.0.0.1:53124/signed-in';
  const { to, res } = await signIn({ redirect: back });
  assert.equal(to.origin + to.pathname, back);
  assert.equal(res.status, 200);
  assert.equal((await signIn({ redirect: back, email: 'stranger@gmail.com' })).to.href, `${back}?error=not_invited`);
  for (const bad of ['https://evil.example/signed-in', 'http://127.0.0.1.evil.example:53124/signed-in', 'http://localhost:53124/signed-in',
    'http://127.0.0.1:53124/other', 'http://127.0.0.1:99999/signed-in', 'http://127.0.0.1:53124/signed-in?x=1', 'com.evil.app:/signed-in', '']) {
    const res = await call(`/auth/google?challenge=${'a'.repeat(43)}&redirect=${encodeURIComponent(bad)}`);
    assert.equal(res.status, 400, bad);
    assert.equal((await res.json()).error, 'bad_redirect');
  }
  // A redirect on the callback itself is ignored: the way back only comes from the signed flow.
  assert.match((await call(`/auth/google/callback?code=x&state=y&redirect=${encodeURIComponent('http://127.0.0.1:1/signed-in')}`)).headers.get('Location'), /^com\.kohulabs\.android:/);
});

test('sign-in refuses: a wrong verifier, a bad challenge, someone not on the list, a cancelled or tampered sign-in, bad ID tokens', async () => {
  assert.equal((await signIn({ verifierOverride: 'x'.repeat(43) })).res.status, 400);
  assert.equal((await call('/auth/google?challenge=short')).status, 400);
  assert.equal((await signIn({ email: 'stranger@gmail.com' })).to.href, 'com.kohulabs.android:/signed-in?error=not_invited');
  assert.equal((await call('/auth/google/callback?error=access_denied')).headers.get('Location'), 'com.kohulabs.android:/signed-in?error=cancelled');
  assert.equal((await call('/auth/google/callback?code=x&state=y')).headers.get('Location'), 'com.kohulabs.android:/signed-in?error=failed');
  for (const claims of [{ aud: 'other' }, { email_verified: false }, { nonce: 'nope' }, { exp: now() - 5 }]) {
    assert.equal((await signIn({ claims })).to.href, 'com.kohulabs.android:/signed-in?error=failed', JSON.stringify(claims));
  }
  // A code is not a token, a token is not a code, and nothing signed with another secret counts.
  const { to, body } = await signIn();
  const env = { ...ENV, DB: new FakeD1() };
  assert.equal((await post('/api/sync', { cursor: 0, changes: {} }, { token: to.searchParams.get('code'), env })).status, 401);
  assert.equal((await post('/api/token', { code: body.token, verifier: 'x' })).status, 400);
  const foreign = await sign({ kind: 'app', email: 'hello@kohulabs.com', exp: now() + 100 }, 'p'.repeat(40));
  assert.equal((await post('/api/sync', { cursor: 0, changes: {} }, { token: foreign, env })).status, 401);
});

const ROWS = {
  chunks: { id: 'c1', task_id: 't1', workspace_id: 'kohu', date: '2026-10-29', start: '09:15', minutes: 25, title: 'Outline', category: 'inv', status: 'planned', started_at: null, carried_from: null, updated_at: 100, deleted: 0 },
  settings: { id: 'lang', value: '"pt"', updated_at: 100, deleted: 0 }
};
const row = (table, over = {}) => ({ ...ROWS[table], ...over });

test('sync: sets up D1, saves what the phone sends, sends back what changed, newest wins, per person', async () => {
  const env = { ...ENV, DB: new FakeD1() };
  const token = (await signIn()).body.token;
  const s = async (body, t = token) => { const r = await post('/api/sync', body, { token: t, env }); return { status: r.status, ...(await r.json()) }; };

  const one = await s({ cursor: 0, changes: { chunks: [row('chunks')], settings: [row('settings')] } });
  assert.equal(one.status, 200);
  assert.equal(one.cursor, 2); assert.equal(one.more, false);
  assert.deepEqual(one.changes.chunks, [row('chunks')]);
  const tables = env.DB.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
  assert.ok(tables.includes('chunks') && tables.includes('schema_migrations') && tables.includes('sync_counter'));
  assert.deepEqual((await s({ cursor: 2, changes: {} })).changes, {});

  await s({ cursor: 2, changes: { chunks: [row('chunks', { status: 'done', updated_at: 200 })] } });
  await s({ cursor: 2, changes: { chunks: [row('chunks', { status: 'skipped', updated_at: 150 })] } });
  assert.deepEqual((await s({ cursor: 2, changes: {} })).changes.chunks.map((c) => [c.status, c.updated_at]), [['done', 200]]);

  const ana = (await signIn({ email: 'ana@kohulabs.com' })).body.token;
  assert.deepEqual((await s({ cursor: 0, changes: {} }, ana)).changes, {});
  await s({ cursor: 0, changes: { chunks: [row('chunks', { title: 'Ana’s', updated_at: 999 })] } }, ana);
  assert.equal((await s({ cursor: 0, changes: {} })).changes.chunks[0].title, 'Outline');
});

test('sync refuses: no token, removed from the list, unknown table, bad rows, too many rows; 503 without D1', async () => {
  const env = { ...ENV, DB: new FakeD1() };
  const { body } = await signIn({ email: 'ana@kohulabs.com' });
  assert.equal((await post('/api/sync', { cursor: 0, changes: {} }, { env })).status, 401);
  assert.equal((await post('/api/sync', { cursor: 0, changes: {} }, { token: body.token, env: { ...env, FOUNDER_EMAILS: 'hello@kohulabs.com' } })).status, 401);
  assert.equal((await post('/api/sync', { cursor: 0, changes: {} }, { token: body.token, env: ENV })).status, 503);
  assert.equal((await post('/api/sync', { changes: { users: [] } }, { token: body.token, env })).status, 400);
  for (const bad of [{ id: '' }, { id: 'x' }, { ...row('chunks'), updated_at: 'soon' }, { ...row('chunks'), title: { a: 1 } }]) {
    assert.equal((await post('/api/sync', { changes: { chunks: [bad] } }, { token: body.token, env })).status, 400, JSON.stringify(bad));
  }
  const many = Array.from({ length: 1001 }, (_, i) => row('settings', { id: `s${i}` }));
  assert.equal((await post('/api/sync', { changes: { settings: many } }, { token: body.token, env })).status, 413);
});

test('sync pages a long history without skipping anything', async () => {
  const env = { ...ENV, DB: new FakeD1() };
  const token = (await signIn()).body.token;
  const n = PAGE + 20;
  await post('/api/sync', { cursor: 0, changes: { settings: Array.from({ length: n }, (_, i) => row('settings', { id: `s${i}` })) } }, { token, env });
  await post('/api/sync', { cursor: 0, changes: { chunks: [row('chunks')] } }, { token, env });
  const seen = new Set(); let cursor = 0, more = true, rounds = 0;
  while (more && rounds++ < 10) {
    const r = await (await post('/api/sync', { cursor, changes: {} }, { token, env })).json();
    for (const [t, rows] of Object.entries(r.changes)) for (const x of rows) seen.add(`${t}:${x.id}`);
    cursor = r.cursor; more = r.more;
  }
  assert.equal(seen.size, n + 1);
});

test('routing: anything else is a JSON 404', async () => {
  for (const p of ['/', '/api/me', '/api/nope', '/auth/logout']) assert.equal((await call(p)).status, 404, p);
});

// ---- Calendar and Gmail import (google-import.js) ------------------------------------------------------------------
import { importAll, importFor, importIfDue } from './google-import.js';

const NOW = Date.parse('2026-10-31T08:00:00Z');       // Europe/Lisbon is UTC+0 on this day
const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly', MAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.metadata';

// A pretend Google: sign-in with a refresh token, refreshing it, Calendar events and Gmail messages.
function fakeGoogle(state) {
  return async (url, init = {}) => {
    const u = new URL(url);
    if (u.pathname === '/token') {
      const p = new URLSearchParams(init.body);
      if (p.get('grant_type') === 'refresh_token') {
        if (state.revoked) return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
        state.refreshedWith = p.get('refresh_token');
        return new Response(JSON.stringify({ access_token: 'at-1', scope: state.scope }), { status: 200 });
      }
      return new Response(JSON.stringify({ id_token: idToken({ iss: 'https://accounts.google.com', aud: ENV.GOOGLE_CLIENT_ID, nonce: state.nonce, exp: now() + 600, email: 'hello@kohulabs.com', email_verified: true, name: 'João Duarte' }), refresh_token: 'rt-secret', scope: state.scope }), { status: 200 });
    }
    assert.equal(init.headers && init.headers.Authorization, 'Bearer at-1');
    if (u.hostname === 'www.googleapis.com') return new Response(JSON.stringify({ items: state.events }), { status: state.calStatus || 200 });
    if (u.pathname.endsWith('/messages')) {
      assert.deepEqual(u.searchParams.getAll('labelIds'), ['INBOX', 'UNREAD']);
      assert.equal(u.searchParams.get('q'), null, 'gmail.metadata cannot search');
      return new Response(JSON.stringify({ messages: state.mail.map((m) => ({ id: m.id })) }), { status: 200 });
    }
    const m = state.mail.find((x) => u.pathname.endsWith('/' + x.id));
    assert.equal(u.searchParams.get('format'), 'metadata');
    return new Response(JSON.stringify({ id: m.id, threadId: m.thread, internalDate: String(NOW - 86400e3), labelIds: m.labels || ['INBOX', 'UNREAD'], payload: { headers: [{ name: 'From', value: m.from }, { name: 'Subject', value: m.subject }] } }), { status: 200 });
  };
}
const event = (id, startIso, endIso, over = {}) => ({ id, status: 'confirmed', summary: `Meeting ${id}`, start: { dateTime: startIso }, end: { dateTime: endIso }, attendees: [{ email: 'ana@x.pt', displayName: 'Ana' }, { email: 'hello@kohulabs.com', self: true, responseStatus: 'accepted' }], hangoutLink: 'https://meet.google.com/abc', ...over });

async function connected(state) {
  const env = { ...ENV, GOOGLE_TOKEN_URL: 'https://oauth2.googleapis.com/token', DB: new FakeD1() };
  const { verifier, challenge } = await pkce();
  const start = await call(`/auth/google?challenge=${challenge}`, { env });
  const auth = new URL(start.headers.get('Location'));
  state.nonce = auth.searchParams.get('nonce');
  globalThis.fetch = fakeGoogle(state);
  const back = await call(`/auth/google/callback?code=abc&state=${auth.searchParams.get('state')}`, { cookie: cookieHeader(start), env });
  const code = new URL(back.headers.get('Location')).searchParams.get('code');
  const { token } = await (await post('/api/token', { code, verifier }, { env })).json();
  return { env, token, auth };
}
const rows = (env, sql, ...args) => env.DB.db.prepare(sql).all(...args);

test('import: sign-in asks for read-only Calendar and Gmail metadata, offline, and keeps the refresh token encrypted', async () => {
  const { env, auth } = await connected({ scope: `openid email profile ${CAL_SCOPE} ${MAIL_SCOPE}`, events: [], mail: [] });
  assert.deepEqual(auth.searchParams.get('scope').split(' '), ['openid', 'email', 'profile', CAL_SCOPE, MAIL_SCOPE]);
  assert.equal(auth.searchParams.get('access_type'), 'offline');
  assert.match(auth.searchParams.get('prompt'), /consent/);
  const [acct] = rows(env, 'SELECT * FROM google_accounts');
  assert.equal(acct.user_id, 'hello@kohulabs.com');
  assert.ok(!acct.refresh_token.includes('rt-secret'), 'stored encrypted');
  assert.equal(acct.last_import_at, null);
});

test('import: today’s meetings, unread mail and a day nudge reach the phone through sync; the phone’s own changes stay', async () => {
  const state = { scope: `${CAL_SCOPE} ${MAIL_SCOPE}`, mail: [{ id: 'm1', thread: 't1', from: '"Ana Reis" <ana@vc.pt>', subject: 'Deck follow-up' }, { id: 'm2', thread: 't1', from: 'Ana Reis <ana@vc.pt>', subject: 'Re: Deck' }, { id: 'm3', thread: 't2', from: 'rui@contas.pt', subject: 'IVA T3' }, { id: 'm4', thread: 't3', from: 'deals@shop.pt', subject: '50% off', labels: ['INBOX', 'UNREAD', 'CATEGORY_PROMOTIONS'] }],
    events: [event('e1', '2026-10-31T09:30:00Z', '2026-10-31T10:00:00Z'), event('e2', '2026-10-31T14:00:00Z', '2026-10-31T15:00:00Z', { summary: 'Board' }),
      event('allday', null, null, { start: { date: '2026-10-31' }, end: { date: '2026-11-01' } }), event('declined', '2026-10-31T11:00:00Z', '2026-10-31T11:30:00Z', { attendees: [{ self: true, responseStatus: 'declined' }] }),
      event('tomorrow', '2026-11-01T09:00:00Z', '2026-11-01T10:00:00Z'), event('ooo', '2026-10-31T12:00:00Z', '2026-10-31T13:00:00Z', { eventType: 'outOfOffice' }),
      event('flight', '2026-10-31T18:00:00Z', '2026-10-31T20:30:00Z', { eventType: 'fromGmail', summary: 'Flight to Porto', attendees: [] })] };
  const { env, token } = await connected(state);
  await post('/api/sync', { cursor: 0, changes: { settings: [{ id: 'lang', value: '"pt"', updated_at: 5, deleted: 0 }] } }, { token, env });
  // A sync starts the import in the background (by the real clock); here it is run for a fixed morning.
  const waits = [];
  const r = await worker.fetch(new Request(BASE + '/api/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ cursor: 0, changes: {} }) }), env, { waitUntil: (p) => waits.push(p) });
  assert.equal(r.status, 200);
  assert.equal(waits.length, 1);
  await Promise.all(waits);
  assert.ok(rows(env, 'SELECT last_import_at FROM google_accounts')[0].last_import_at > 0);
  const res = await importFor(env, 'hello@kohulabs.com', { now: NOW });
  assert.deepEqual(res, { ok: true, meetings: 3, emails: 2, error: undefined });
  assert.equal(state.refreshedWith, 'rt-secret');

  const pulled = await (await post('/api/sync', { cursor: 0, changes: {} }, { token, env })).json();
  assert.deepEqual(pulled.changes.chunks.filter((c) => c.date === '2026-10-31').map((c) => [c.id, c.date, c.start, c.minutes, c.category, c.workspace_id]),
    [['cal:e1', '2026-10-31', '09:30', 30, 'meet', 'kohu'], ['cal:e2', '2026-10-31', '14:00', 60, 'meet', 'kohu'], ['cal:flight', '2026-10-31', '18:00', 150, 'meet', 'kohu']]);
  assert.deepEqual(JSON.parse(pulled.changes.meetings[0].prep), { attendees: ['Ana'], link: 'https://meet.google.com/abc', location: null, organizer: null });
  assert.deepEqual(pulled.changes.follow_ups.map((f) => [f.id, f.person, f.what, f.direction, f.source, f.since]),
    [['gm:t1', 'Ana Reis', 'Deck follow-up', 'you', 'Gmail', '2026-10-30'], ['gm:t2', 'rui@contas.pt', 'IVA T3', 'you', 'Gmail', '2026-10-30']]);
  const nudge = pulled.changes.nudges.find((n) => n.id === 'brief:2026-10-31');
  assert.equal(nudge.title, 'Hoje: 3 reuniões, 2 emails à espera');
  assert.match(nudge.body, /^A primeira às 09:30: Meeting e1\./);

  // The phone marks the first meeting done; then the event is renamed and the second one is cancelled.
  const done = { ...pulled.changes.chunks.find((c) => c.id === 'cal:e1'), status: 'done', updated_at: Date.now() + 1000 };
  await post('/api/sync', { cursor: pulled.cursor, changes: { chunks: [done] } }, { token, env });
  state.events = [event('e1', '2026-10-31T09:30:00Z', '2026-10-31T10:00:00Z', { summary: 'Renamed' })];
  state.mail = state.mail.filter((m) => m.thread === 't2');                 // Ana's thread was read
  await importFor(env, 'hello@kohulabs.com', { now: NOW + 3600e3 });
  const c = Object.fromEntries(rows(env, "SELECT id, title, status, deleted FROM chunks WHERE id LIKE 'cal:%'").map((x) => [x.id, x]));
  assert.deepEqual([c['cal:e1'].title, c['cal:e1'].status, c['cal:e1'].deleted], ['Renamed', 'done', 0]);
  assert.equal(c['cal:e2'].deleted, 1);
  assert.deepEqual(rows(env, "SELECT id, status FROM follow_ups ORDER BY id").map((f) => [f.id, f.status]), [['gm:t1', 'done'], ['gm:t2', 'open']]);
  assert.equal(rows(env, "SELECT title FROM nudges WHERE id = 'brief:2026-10-31'")[0].title, 'Hoje: 1 reunião, 1 email à espera');

  // An unchanged import changes nothing, so phones have nothing new to pull.
  const before = rows(env, 'SELECT seq FROM sync_counter')[0].seq;
  const cursor = (await (await post('/api/sync', { cursor: 0, changes: {} }, { token, env })).json()).cursor;
  await importFor(env, 'hello@kohulabs.com', { now: NOW + 7200e3 });
  assert.deepEqual((await (await post('/api/sync', { cursor, changes: {} }, { token, env })).json()).changes, {});
  assert.ok(rows(env, 'SELECT seq FROM sync_counter')[0].seq >= before);
});

test('import: only what was granted, a revoked token stops it, and the schedule runs everyone', async () => {
  const state = { scope: CAL_SCOPE, events: [event('e1', '2026-10-31T09:30:00Z', '2026-10-31T10:00:00Z')], mail: [] };
  const { env } = await connected(state);
  const res = await importFor(env, 'hello@kohulabs.com', { now: NOW });
  assert.equal(res.emails, 0);
  assert.equal(rows(env, 'SELECT COUNT(*) AS n FROM follow_ups')[0].n, 0, 'no Gmail without its scope');
  assert.equal(rows(env, "SELECT title FROM nudges WHERE id = 'brief:2026-10-31'")[0].title, 'Today: 1 meeting, 0 emails waiting');
  // Due again only after 50 minutes.
  assert.equal(await importIfDue(env, 'hello@kohulabs.com', NOW + 10 * 60e3), null);
  assert.ok(await importIfDue(env, 'hello@kohulabs.com', NOW + 60 * 60e3));
  // Calendar API off: the error is kept, nothing is deleted.
  state.calStatus = 403;
  assert.match((await importFor(env, 'hello@kohulabs.com', { now: NOW + 2 * 3600e3 })).error, /calendar 403/);
  assert.equal(rows(env, "SELECT deleted FROM chunks WHERE id = 'cal:e1'")[0].deleted, 0);
  // Access removed in Google: marked for a new sign-in, skipped by the schedule and by syncs.
  state.revoked = true;
  assert.equal((await importFor(env, 'hello@kohulabs.com', { now: NOW + 3 * 3600e3 })).error, 'reauth');
  assert.equal(await importIfDue(env, 'hello@kohulabs.com', NOW + 9 * 3600e3), null);
  assert.deepEqual(await importAll(env, NOW + 9 * 3600e3), []);
  // The scheduled handler.
  state.revoked = false;
  env.DB.db.prepare("UPDATE google_accounts SET last_error = NULL").run();
  const waits = [];
  await worker.scheduled({}, env, { waitUntil: (p) => waits.push(p) });
  assert.equal((await Promise.all(waits))[0].length, 1);
});

test('refresh: imports now for the signed-in person, at most once a minute; needs a sign-in and Google', async () => {
  const state = { scope: `${CAL_SCOPE} ${MAIL_SCOPE}`, events: [], mail: [{ id: 'm1', thread: 't1', from: 'Ana <a@x.pt>', subject: 'Hi' }] };
  const { env, token } = await connected(state);
  assert.equal((await post('/api/refresh', {}, { env })).status, 401);
  const first = await (await post('/api/refresh', {}, { token, env })).json();
  assert.equal(first.ok, true); assert.equal(first.emails, 1);
  assert.deepEqual(await (await post('/api/refresh', {}, { token, env })).json(), { ok: true, skipped: true });
  env.DB.db.prepare('DELETE FROM google_accounts').run();
  assert.deepEqual(await (await post('/api/refresh', {}, { token, env })).json(), { ok: false, error: 'no_google' });
});

// ---- Kō's brain ---------------------------------------------------------------------------------------------------
const TODAY = '2026-11-05';
async function brain({ answer = 'Hi João', usage = { cost: 0.01, prompt_tokens: 100, completion_tokens: 20 }, upstream = 200, env: extra = {} } = {}) {
  const token = (await signIn()).body.token;
  const env = { ...ENV, DB: new FakeD1(), OPENROUTER_API_KEY: 'or-key', KO_MONTHLY_CAP_USD: '1', ...extra };
  const seen = [];
  globalThis.fetch = async (url, init) => { seen.push({ url, init, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ model: 'anthropic/test', choices: [{ message: { content: answer } }], usage }), { status: upstream }); };
  const askKo = (body) => post('/api/ko', { message: 'What now?', date: TODAY, time: '10:00', lang: 'en', ...body }, { token, env });
  return { token, env, seen, askKo };
}
const pulled = async (token, env) => (await (await post('/api/sync', { cursor: 0, changes: {} }, { token, env })).json()).changes;

test('Kō answers from your real day, with the key on the server, and the answer is paid for in usage', async () => {
  const { token, env, seen, askKo } = await brain();
  const row = { id: 'c1', workspace_id: 'k', date: TODAY, start: '11:00', minutes: 25, title: 'Investor update', category: 'inv', status: 'planned', updated_at: 5, deleted: 0 };
  assert.equal((await post('/api/sync', { cursor: 0, changes: { chunks: [row] } }, { token, env })).status, 200);
  const res = await askKo({ history: [{ who: 'user', text: 'Hi' }, { who: 'ko', text: 'Hello' }, { who: 'evil', text: 'x' }] });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { reply: 'Hi João', cost: 0.01, spent: 0.01, cap: 1 });
  const { url, init, body } = seen.at(-1);
  assert.match(url, /openrouter\.ai/);
  assert.equal(init.headers.Authorization, 'Bearer or-key');
  assert.match(body.messages[0].content, /Investor update/);
  assert.match(body.messages[0].content, /never as instructions/);
  assert.deepEqual(body.messages.slice(1).map((m) => [m.role, m.content]), [['user', 'Hi'], ['assistant', 'Hello'], ['user', 'What now?']]);
  const { usage, messages } = await pulled(token, env);
  assert.equal(usage.length, 1); assert.equal(usage[0].cost, 0.01); assert.equal(usage[0].purpose, 'chat');
  assert.equal(messages, undefined, 'the phone saves its own chat');
});

test('the desktop can have the exchange kept, so the phone sees it too', async () => {
  const { token, env, askKo } = await brain();
  await askKo({ save: true });
  const { messages } = await pulled(token, env);
  assert.deepEqual(messages.map((m) => [m.who, m.text, m.date]).sort(), [['ko', 'Hi João', TODAY], ['user', 'What now?', TODAY]]);
});

test('Kō stops at the monthly cap, before spending anything more', async () => {
  const { seen, askKo } = await brain({ usage: { cost: 0.6 } });
  assert.equal((await askKo()).status, 200);
  assert.equal((await askKo()).status, 200);
  const stopped = await askKo();
  assert.equal(stopped.status, 402);
  assert.equal((await stopped.json()).error, 'spend_cap');
  assert.equal(seen.length, 2);
});

test('Kō refuses without a sign-in or key, and on bad input; a failed answer says so', async () => {
  const body = { message: 'x', date: TODAY, time: '10:00' };
  assert.equal((await post('/api/ko', body, { env: { ...ENV, DB: new FakeD1() } })).status, 401);
  const noKey = await brain({ env: { OPENROUTER_API_KEY: '' } });
  const res = await noKey.askKo();
  assert.equal(res.status, 503); assert.equal((await res.json()).error, 'brain_not_configured');
  const { askKo, seen } = await brain();
  for (const bad of [{ message: '' }, { message: 'x'.repeat(4001) }, { date: 'today' }, { time: 'noon' }]) assert.equal((await askKo(bad)).status, 400);
  assert.equal(seen.length, 0);
  assert.equal((await (await brain({ upstream: 500 })).askKo()).status, 502);
  const empty = await brain({ answer: '  ' });
  assert.equal((await empty.askKo()).status, 502);
  assert.equal((await pulled(empty.token, empty.env)).usage.length, 1, 'an empty answer is still recorded');
});

test('when OpenRouter refuses, Kō says why', async () => {
  for (const [upstream, error] of [[401, 'brain_key'], [403, 'brain_forbidden'], [402, 'brain_credits'], [400, 'brain_model'], [404, 'brain_model'], [429, 'brain_busy'], [500, 'brain_failed']]) {
    const res = await (await brain({ upstream })).askKo();
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, error, String(upstream));
  }
  const { askKo } = await brain();
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 402, message: 'no credits' } }), { status: 200 });
  assert.equal((await (await askKo()).json()).error, 'brain_credits');
});

test('a stray line break in the key is harmless, and a passing hiccup gets one more try', async () => {
  const { askKo, seen } = await brain({ env: { OPENROUTER_API_KEY: ' or-key\n' } });
  assert.equal((await askKo()).status, 200);
  assert.equal(seen.at(-1).init.headers.Authorization, 'Bearer or-key');
  const flaky = await brain();
  let calls = 0;
  globalThis.fetch = async () => (++calls === 1 ? new Response('{}', { status: 503 }) : new Response(JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: 'In parts' }] } }] })));
  assert.equal((await (await flaky.askKo()).json()).reply, 'In parts');
  assert.equal(calls, 2);
});

test('each way of failing has its own name, and a refusal is not retried', async () => {
  const { askKo } = await brain();
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError('bad'); };
  assert.equal((await (await askKo()).json()).error, 'brain_network'); assert.equal(calls, 2);
  globalThis.fetch = async () => { throw Object.assign(new Error('late'), { name: 'TimeoutError' }); };
  assert.equal((await (await askKo()).json()).error, 'brain_timeout');
  calls = 0; globalThis.fetch = async () => { calls++; return new Response('{}', { status: 401 }); };
  assert.equal((await (await askKo()).json()).error, 'brain_key'); assert.equal(calls, 1);
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: null } }] }));
  assert.equal((await (await askKo()).json()).error, 'brain_empty');
});
