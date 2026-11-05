// Turns the rows that sync brings down into "today", and decides when Kō should get your attention.
// Pure logic, tested with `node --test desktop/ui/day.test.mjs`. Read-only for now: changes happen on the phone.

export const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const minutesOf = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0; };
export const dayKeyNow = (d) => ({ date: dateKey(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` });
const rowsOf = (tables, name) => Object.values((tables && tables[name]) || {}).filter((r) => r && !r.deleted);
const SHOWN = new Set(['planned', 'done', 'skipped']); // a split, moved or dropped chunk has been replaced by others

const COPY = {
  en: {
    meetingSoon: (t, n) => (n <= 0 ? `Now: ${t}` : `In ${n} min: ${t}`), chunkNow: (t) => `Time for: ${t}`,
    title: 'Today', next: 'Next', now: 'Now', noPlan: 'Nothing planned today.', allDone: 'All done for today.', left: (n) => `${n} left`, min: 'min',
    waiting: 'Waiting on you', meeting: 'Meeting', done: 'Done', skipped: 'Skipped',
    signInTitle: 'Bring in your day', signInBody: 'Sign in with the same Google account as your phone. Your day stays in sync.', signIn: 'Continue with Google', signingIn: 'Waiting for the browser…',
    signOut: 'Sign out', refresh: 'Refresh', refreshing: 'Checking…', synced: (t) => `Synced ${t}`, offline: 'Could not reach the cloud. Showing your last copy.', readOnly: 'Change things on your phone for now.',
    chat: 'Chat', askPlaceholder: 'Ask Kō…', ask: 'Send', thinking: 'Thinking…', you: 'You',
    brainErrors: { brain_not_configured: 'My brain isn’t connected yet.', spend_cap: 'I’ve reached this month’s spending limit.', too_many: 'That’s a lot at once. Give me a minute.', offline: 'I can’t reach the cloud right now.', brain_key: 'OpenRouter refused my key. Check the key on the Worker (error: brain_key).', brain_forbidden: 'OpenRouter blocked this request under a provider’s terms (error: brain_forbidden).', brain_credits: 'OpenRouter says there are no credits left, or the key reached its limit (error: brain_credits).', brain_model: 'OpenRouter refused my request, probably the model name (error: brain_model).', brain_busy: 'OpenRouter is busy or limiting requests. Try again in a minute (error: brain_busy).', brain_failed: 'OpenRouter couldn’t answer just now. Please try again (error: brain_failed).', other: 'Something went wrong on my side. Please try again.' }, errorCode: (c) => `(error: ${c})`,
    signInFailed: 'Sign-in did not finish. Please try again.', notInvited: 'That Google account is not allowed in.', keyring: 'Windows would not save your sign-in. Please try again.',
  },
  pt: {
    meetingSoon: (t, n) => (n <= 0 ? `Agora: ${t}` : `Daqui a ${n} min: ${t}`), chunkNow: (t) => `Está na hora de: ${t}`,
    title: 'Hoje', next: 'A seguir', now: 'Agora', noPlan: 'Nada planeado para hoje.', allDone: 'Está tudo feito por hoje.', left: (n) => `Faltam ${n}`, min: 'min',
    waiting: 'À tua espera', meeting: 'Reunião', done: 'Feito', skipped: 'Saltado',
    signInTitle: 'Traz o teu dia', signInBody: 'Inicia sessão com a mesma conta Google do telemóvel. O teu dia fica sincronizado.', signIn: 'Continuar com o Google', signingIn: 'À espera do navegador…',
    signOut: 'Terminar sessão', refresh: 'Atualizar', refreshing: 'A verificar…', synced: (t) => `Sincronizado às ${t}`, offline: 'Não foi possível ligar à nuvem. A mostrar a última cópia.', readOnly: 'Por agora, faz as alterações no telemóvel.',
    chat: 'Conversa', askPlaceholder: 'Pergunta ao Kō…', ask: 'Enviar', thinking: 'A pensar…', you: 'Tu',
    brainErrors: { brain_not_configured: 'O meu cérebro ainda não está ligado.', spend_cap: 'Cheguei ao limite de gastos deste mês.', too_many: 'É muita coisa de uma vez. Dá-me um minuto.', offline: 'Não consigo ligar à nuvem agora.', brain_key: 'O OpenRouter recusou a minha chave. Confirma a chave no Worker (erro: brain_key).', brain_forbidden: 'O OpenRouter bloqueou este pedido ao abrigo dos termos de um fornecedor (erro: brain_forbidden).', brain_credits: 'O OpenRouter diz que não há créditos ou que a chave chegou ao limite (erro: brain_credits).', brain_model: 'O OpenRouter recusou o pedido, provavelmente o nome do modelo (erro: brain_model).', brain_busy: 'O OpenRouter está ocupado ou a limitar pedidos. Tenta daqui a um minuto (erro: brain_busy).', brain_failed: 'O OpenRouter não conseguiu responder agora. Tenta outra vez (erro: brain_failed).', other: 'Correu mal do meu lado. Tenta outra vez.' }, errorCode: (c) => `(erro: ${c})`,
    signInFailed: 'O início de sessão não terminou. Tenta outra vez.', notInvited: 'Essa conta Google não tem acesso.', keyring: 'O Windows não guardou a sessão. Tenta outra vez.',
  },
};

export function langOf(tables) {
  const row = tables && tables.settings && tables.settings.lang;
  if (!row || row.deleted) return 'en';
  try { return JSON.parse(row.value) === 'pt' ? 'pt' : 'en'; } catch (_) { return row.value === 'pt' ? 'pt' : 'en'; }
}
export const copyFor = (lang) => COPY[lang] || COPY.en;

/** tables: { chunks: {id: row}, follow_ups: {...}, workspaces: {...}, settings: {...} }. now: a Date. */
export function dayView(tables, now) {
  const date = dateKey(now), nowMin = now.getHours() * 60 + now.getMinutes();
  const names = Object.fromEntries(rowsOf(tables, 'workspaces').map((w) => [w.id, w.name]));
  const items = rowsOf(tables, 'chunks')
    .filter((c) => c.date === date && SHOWN.has(c.status))
    .sort((a, b) => minutesOf(a.start) - minutesOf(b.start) || String(a.id).localeCompare(String(b.id)))
    .map((c) => {
      const start = minutesOf(c.start);
      return { id: c.id, title: c.title, start: c.start, minutes: c.minutes, status: c.status, meeting: c.category === 'meet', workspace: names[c.workspace_id] || c.workspace_id,
        current: c.status === 'planned' && start <= nowMin && nowMin < start + c.minutes };
    });
  const open = items.filter((i) => i.status === 'planned');
  const current = open.find((i) => i.current) || null;
  const next = open.find((i) => minutesOf(i.start) > nowMin) || null;
  const waiting = rowsOf(tables, 'follow_ups')
    .filter((f) => f.status === 'open' && f.direction === 'you')
    .sort((a, b) => String(b.since).localeCompare(String(a.since)))
    .map((f) => ({ id: f.id, person: f.person, what: f.what, since: f.since, workspace: names[f.workspace_id] || f.workspace_id }));
  return { date, items, current, next, left: open.length, waiting };
}

/** Today's chat, oldest first, as the screen and the brain need it. */
export function chatOf(tables, now) {
  const date = dateKey(now);
  return rowsOf(tables, 'messages').filter((m) => m.date === date && m.text)
    .sort((a, b) => (a.created_at || 0) - (b.created_at || 0)).map((m) => ({ id: m.id, who: m.who === 'ko' ? 'ko' : 'user', text: m.text }));
}

/** What Kō should come and say now, or null. A key names each reminder, so a dismissed one stays dismissed. */
export function attention(view, now, dismissed = new Set(), lang = 'en') {
  const t = copyFor(lang), nowMin = now.getHours() * 60 + now.getMinutes();
  for (const i of view.items) {
    if (i.status !== 'planned') continue;
    const inMin = minutesOf(i.start) - nowMin, key = `${view.date}:${i.id}:${i.start}`;
    if (dismissed.has(key)) continue;
    if (i.meeting && inMin <= 10 && inMin >= -2) return { key, text: t.meetingSoon(i.title, Math.max(0, inMin)) };
    if (!i.meeting && inMin <= 0 && inMin >= -1) return { key, text: t.chunkNow(i.title) };
  }
  return null;
}
