// The one door to the desktop side. In the app it is Tauri; opened as a plain page (?demo) it is a stand-in with a
// sample day, which is how the screens are tried and tested in a browser.
const tauri = window.__TAURI__;
const pad = (n) => String(n).padStart(2, '0');

function demoTables() {
  const now = new Date(), date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const at = (m) => { const t = new Date(now.getTime() + m * 60000); return `${pad(t.getHours())}:${pad(t.getMinutes())}`; };
  const chunk = (id, start, minutes, title, category, status = 'planned', workspace_id = 'kohu') => ({ id, date, start: at(start), minutes, title, category, status, workspace_id });
  const rows = [chunk('a', -90, 25, 'Inbox and replies', 'ops', 'done'), chunk('b', -10, 25, 'Investor update outline', 'inv'), chunk('c', 8, 30, 'Client check-in', 'meet'),
    chunk('d', 60, 25, 'Run before dinner', 'fed', 'planned', 'personal')];
  return {
    chunks: Object.fromEntries(rows.map((r) => [r.id, r])),
    workspaces: { kohu: { id: 'kohu', name: 'Kohu' }, personal: { id: 'personal', name: 'Personal' } },
    follow_ups: { f: { id: 'f', person: 'Ana Silva', what: 'Proposal for the new site', direction: 'you', status: 'open', since: date, workspace_id: 'kohu' } },
    settings: {},
  };
}

const demoChat = {};
const demoDay = () => ({ tables: { ...demoTables(), messages: demoChat }, syncedAt: Date.now() });
const demo = {
  ko_area: () => ({ x: 0, y: 0, w: innerWidth, h: innerHeight, scale: 1 }),
  get_day: demoDay,
  sync_day: demoDay,
  refresh_day: demoDay,
  ask_ko: ({ question: q }) => new Promise((resolve, reject) => setTimeout(() => {
    if (/fail/.test(q.message)) return reject('brain_not_configured');
    const n = Object.keys(demoChat).length, reply = 'You’re on the investor update outline, then the client check-in at the top of the hour.';
    demoChat['u' + n] = { id: 'u' + n, who: 'user', text: q.message, date: q.date, created_at: n + 1 };
    demoChat['k' + n] = { id: 'k' + n, who: 'ko', text: reply, date: q.date, created_at: n + 2 };
    resolve({ reply });
  }, 600)),
  get_account: () => ({ email: 'you@example.com', name: 'You' }),
};

export const isDemo = !tauri;
export const invoke = (cmd, args) => (tauri ? tauri.core.invoke(cmd, args) : Promise.resolve(demo[cmd] ? demo[cmd](args) : null));
export const listen = (event, fn) => (tauri ? tauri.event.listen(event, (e) => fn(e.payload)) : Promise.resolve(() => {}));
