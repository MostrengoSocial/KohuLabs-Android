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
async function signIn({ email = 'hello@kohulabs.com', env = ENV, verifierOverride, claims = {} } = {}) {
  const { verifier, challenge } = await pkce();
  const start = await call(`/auth/google?challenge=${challenge}`, { env });
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
  assert.equal(Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seen.get('code_verifier')))).toString('base64url'), auth.searchParams.get('code_challenge'));
  assert.equal(to.protocol + to.pathname, 'com.kohulabs.android:/signed-in');
  assert.match(back.headers.getSetCookie()[0], /__Host-kohulabs_android_oauth=; .*Max-Age=0/);
  assert.equal(res.status, 200);
  assert.equal(body.email, 'hello@kohulabs.com'); assert.equal(body.name, 'João Duarte');
  assert.ok(body.expiresAt > now() + 89 * 24 * 3600);
  assert.equal((await verify(body.token, SECRET)).kind, 'app');
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
