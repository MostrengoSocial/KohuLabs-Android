// The Today window, opened by clicking Kō. Read-only for now: it shows what sync brought down.
import { invoke, listen } from './bridge.js';
import { copyFor, dayView, langOf } from './day.js';

const app = document.getElementById('app');
let account = null, day = null, busy = false, offline = false, signing = false, problem = '';

// Everything from Calendar and Gmail goes in as text, never as HTML.
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === 'on') el.addEventListener('click', v); else if (k === 'disabled') el.disabled = !!v; else el.setAttribute(k, v); }
  el.append(...kids.flat().filter((x) => x !== null && x !== undefined && x !== false));
  return el;
}

function render() {
  const tables = day && day.tables, lang = langOf(tables), t = copyFor(lang);
  document.documentElement.lang = lang;
  if (!account) {
    const msg = { failed: t.signInFailed, cancelled: t.signInFailed, not_invited: t.notInvited, keyring: t.keyring }[problem];
    app.replaceChildren(h('div', { class: 'signin' }, h('h1', {}, t.signInTitle), h('p', {}, t.signInBody),
      h('button', { class: 'primary', disabled: signing, on: signIn }, signing ? t.signingIn : t.signIn), msg && h('p', { class: 'note warn', role: 'alert' }, msg)));
    return;
  }
  const now = new Date(), v = dayView(tables, now), locale = lang === 'pt' ? 'pt-PT' : 'en-GB';
  const lead = v.current ? ['now', t.now, v.current] : v.next ? ['', t.next, v.next] : null;
  const syncTime = day && day.syncedAt ? new Date(day.syncedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null;
  app.replaceChildren(
    h('header', {}, h('h1', {}, t.title), h('div', { class: 'date' }, now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }))),
    lead && h('div', { class: `lead ${lead[0]}` }, h('h2', {}, lead[1]), h('p', {}, lead[2].title), h('small', { class: 'mono' }, `${lead[2].start} · ${lead[2].minutes} ${t.min} · ${lead[2].workspace}`)),
    h('section', {}, h('h2', {}, h('span', {}, t.title), v.items.length ? h('span', {}, t.left(v.left)) : null),
      v.items.length ? h('ul', {}, v.items.map((i) => h('li', { class: `row ${i.status}${i.meeting ? ' meeting' : ''}${i.current ? ' current' : ''}` },
        h('span', { class: 'row-time' }, i.start), h('span', { class: 'row-title' }, i.title),
        h('span', { class: 'tag' }, i.status === 'done' ? t.done : i.status === 'skipped' ? t.skipped : `${i.minutes} ${t.min}`))))
        : h('div', { class: 'empty' }, t.noPlan)),
    v.waiting.length ? h('section', {}, h('h2', {}, h('span', {}, t.waiting), h('span', {}, String(v.waiting.length))),
      h('ul', {}, v.waiting.slice(0, 8).map((f) => h('li', { class: 'wait' }, h('b', {}, f.person), h('span', {}, f.what))))) : null,
    offline ? h('p', { class: 'note warn', role: 'status' }, t.offline) : h('p', { class: 'note' }, t.readOnly),
    h('footer', {}, syncTime && !busy ? h('span', {}, t.synced(syncTime)) : null, h('span', { class: 'sp' }),
      h('button', { class: 'link', disabled: busy, on: refresh }, busy ? t.refreshing : t.refresh), h('button', { class: 'link', on: signOut }, t.signOut)),
  );
}

async function signIn() {
  signing = true; problem = ''; render();
  try { account = await invoke('sign_in'); if (account) await refreshDay(); }
  catch (e) { problem = String(e); }
  signing = false; render();
}
async function signOut() { await invoke('sign_out').catch(() => {}); account = null; day = null; render(); }
async function refreshDay(cmd = 'sync_day') {
  busy = true; render();
  try { day = await invoke(cmd); offline = false; }
  catch (e) { if (String(e) === 'signed_out') account = null; else offline = true; }
  busy = false; render();
}
const refresh = () => refreshDay('refresh_day');

listen('day-updated', (d) => { day = d; offline = false; render(); });
listen('auth-changed', (a) => { account = a; if (!a) day = null; render(); });
listen('panel-open', () => { render(); if (account) refreshDay(); });
setInterval(render, 60 * 1000); // the current chunk moves on with the clock

account = await invoke('get_account').catch(() => null);
day = await invoke('get_day').catch(() => null);
render();
