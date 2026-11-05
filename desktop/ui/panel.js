// The Today window, opened by clicking Kō. The day is read-only for now; the chat goes to his brain on the Worker.
import { invoke, listen } from './bridge.js';
import { chatOf, copyFor, dayKeyNow, dayView, langOf } from './day.js';

const app = document.getElementById('app'), form = document.getElementById('chat'), input = document.getElementById('ask'), sendButton = document.getElementById('send');
let account = null, day = null, busy = false, offline = false, signing = false, problem = '';
let pending = null, chatError = '', scrollToChat = false; // the form lives outside what render() replaces, so what you're typing survives

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
  form.hidden = !account; input.placeholder = t.askPlaceholder; input.setAttribute('aria-label', t.askPlaceholder); sendButton.textContent = t.ask; sendButton.disabled = !!pending;
  if (!account) {
    const msg = { failed: t.signInFailed, cancelled: t.signInFailed, not_invited: t.notInvited, keyring: t.keyring }[problem];
    app.replaceChildren(h('div', { class: 'signin' }, h('h1', {}, t.signInTitle), h('p', {}, t.signInBody),
      h('button', { class: 'primary', disabled: signing, on: signIn }, signing ? t.signingIn : t.signIn), msg && h('p', { class: 'note warn', role: 'alert' }, msg)));
    return;
  }
  const now = new Date(), v = dayView(tables, now), locale = lang === 'pt' ? 'pt-PT' : 'en-GB';
  const lead = v.current ? ['now', t.now, v.current] : v.next ? ['', t.next, v.next] : null;
  const chat = chatOf(tables, now);
  const shown = pending && !chat.some((m) => m.who === 'user' && m.text === pending) ? [...chat, { id: 'pending', who: 'user', text: pending }] : chat;
  const keptScroll = app.scrollTop;
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
    shown.length || pending || chatError ? h('section', { id: 'thread' }, h('h2', {}, h('span', {}, t.chat)), h('div', { class: 'thread', 'aria-live': 'polite' },
      shown.map((m) => h('p', { class: `say ${m.who}` }, m.text)),
      pending ? h('p', { class: 'say ko wait' }, t.thinking) : null,
      chatError ? h('p', { class: 'say ko warn', role: 'alert' }, t.brainErrors[chatError] || t.brainErrors.other) : null)) : null,
    offline ? h('p', { class: 'note warn', role: 'status' }, t.offline) : h('p', { class: 'note' }, t.readOnly),
    h('footer', {}, syncTime && !busy ? h('span', {}, t.synced(syncTime)) : null, h('span', { class: 'sp' }),
      h('button', { class: 'link', disabled: busy, on: refresh }, busy ? t.refreshing : t.refresh), h('button', { class: 'link', on: signOut }, t.signOut)),
  );
  if (scrollToChat) { scrollToChat = false; const end = document.getElementById('thread'); if (end) end.scrollIntoView({ block: 'end' }); } else app.scrollTop = keptScroll;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message || pending) return;
  const now = new Date(), tables = day && day.tables;
  const history = chatOf(tables, now).slice(-12).map(({ who, text }) => ({ who, text }));
  input.value = ''; pending = message; chatError = ''; scrollToChat = true; render();
  try {
    await invoke('ask_ko', { question: { message, ...dayKeyNow(now), lang: langOf(tables), history } });
    day = await invoke('get_day').catch(() => day);
  } catch (err) {
    if (String(err) === 'signed_out') account = null;
    else { chatError = String(err); input.value = message; }
  }
  pending = null; scrollToChat = true; render();
  if (account) input.focus();
});

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
