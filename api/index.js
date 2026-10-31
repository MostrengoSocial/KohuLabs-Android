// kohulabs-android API (Cloudflare Worker): sign-in and the cloud copy for the Kō Android app (android/).
//
//   GET  /auth/google?challenge=…   Google sign-in, opened by the app in a browser tab. It ends by sending the app a
//                                   one-time code: com.kohulabs.android:/signed-in?code=… (or ?error=…)
//   GET  /auth/google/callback      Google sends the browser back here
//   POST /api/token                 {code, verifier} → {token, email, name, expiresAt}: the app's sign-in (Bearer),
//                                   90 days. PKCE: only the app that started the sign-in knows the verifier.
//   POST /api/sync                  the app's data ↔ D1 (binding DB; see sync.js)
//   GET  /api/status                {configured, sync}: whether sign-in and the database are set up
//   POST /api/refresh               imports Calendar and Gmail now (pull to refresh in the app); at most once a minute
//   (schedule)                      imports everyone's Calendar and Gmail for today (google-import.js); a sync also
//                                   starts one in the background when the last is over 50 minutes old
//
// Sign-in also asks Google for read-only Calendar and Gmail-metadata access with offline use; the refresh token is kept
// encrypted in D1 (google_accounts) for the import. People can untick either on Google's consent screen.
//
// Settings (Cloudflare dashboard → the Worker → Settings → Variables and Secrets):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET   (type: Secret)
//   FOUNDER_EMAILS   comma-separated Google accounts allowed in, set in wrangler.jsonc
//   TIMEZONE         the time zone "today" is counted in (default Europe/Lisbon), set in wrangler.jsonc
import { b64url, cookie, emailList, enc, googleConfig, googleSignIn, json, randomToken, readCookie, redirect, seal, sign, verify } from './google.js';
import { IMPORT_SCOPES, importAll, importFor, importIfDue } from './google-import.js';
import { migrate, sync } from './sync.js';

const OAUTH_SECONDS = 10 * 60;
const CODE_SECONDS = 2 * 60;
const TOKEN_SECONDS = 90 * 24 * 3600;
const APP_REDIRECT = 'com.kohulabs.android:/signed-in';
const MAX_SYNC_BYTES = 4 * 1024 * 1024;

const configured = (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET && String(env.SESSION_SECRET).length >= 24);
const allowed = (email, env) => emailList(env.FOUNDER_EMAILS).includes(email);
// The sign-in flow cookie. Path=/ because browsers silently drop a __Host- cookie with any other path.
const flowCookie = (url) => (url.protocol === 'https:' ? '__Host-kohulabs_android_oauth' : 'kohulabs_android_oauth');
const clearFlow = (url) => ['Set-Cookie', cookie(flowCookie(url), '', { secure: url.protocol === 'https:', maxAge: 0 })];
const toApp = (query, url) => redirect(`${APP_REDIRECT}?${query}`, [clearFlow(url)]);

// ---- Google sign-in, ending in the app ---------------------------------------------------------------------------
async function startGoogle(env, url) {
  if (!configured(env)) return json({ error: 'auth_not_configured' }, 503);
  const app = url.searchParams.get('challenge') || '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(app)) return json({ error: 'bad_challenge' }, 400);
  const c = googleConfig(env);
  const state = randomToken(), verifier = randomToken(48), nonce = randomToken();
  const challenge = b64url(await crypto.subtle.digest('SHA-256', enc.encode(verifier)));
  const flow = await sign({ kind: 'flow', state, verifier, nonce, app, exp: Math.floor(Date.now() / 1000) + OAUTH_SECONDS }, c.secret);
  const q = new URLSearchParams({
    client_id: c.googleId, redirect_uri: `${url.origin}/auth/google/callback`, response_type: 'code', scope: ['openid', 'email', 'profile', ...IMPORT_SCOPES].join(' '),
    state, nonce, code_challenge: challenge, code_challenge_method: 'S256',
    // offline + consent: Google returns a refresh token every time, so the import keeps working after the app closes
    access_type: 'offline', include_granted_scopes: 'true', prompt: 'consent select_account',
  });
  return redirect(`${c.authUrl}?${q}`, [['Set-Cookie', cookie(flowCookie(url), flow, { secure: url.protocol === 'https:', maxAge: OAUTH_SECONDS })]]);
}

async function finishGoogle(request, env, url) {
  if (!configured(env)) return json({ error: 'auth_not_configured' }, 503);
  if (url.searchParams.get('error')) return toApp('error=cancelled', url);
  const c = googleConfig(env);
  const flow = await verify(readCookie(request, flowCookie(url)), c.secret);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  if (!flow || flow.kind !== 'flow' || !code || !state || state !== flow.state) return toApp('error=failed', url);
  const signedIn = await googleSignIn(c, { code, verifier: flow.verifier, nonce: flow.nonce, redirectUri: `${url.origin}/auth/google/callback` });
  if (!signedIn) return toApp('error=failed', url);
  const { claims, tokens } = signedIn;
  const email = String(claims.email).toLowerCase();
  if (!allowed(email, env)) return toApp('error=not_invited', url);
  // Keep Google access for the import, encrypted; the next sync imports straight away (last_import_at cleared).
  if (env.DB && tokens.refresh_token) {
    await migrate(env.DB);
    await env.DB.prepare(`INSERT INTO google_accounts (user_id, refresh_token, scopes, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET refresh_token = excluded.refresh_token, scopes = excluded.scopes, updated_at = excluded.updated_at, last_import_at = NULL, last_error = NULL`)
      .bind(email, await seal(tokens.refresh_token, c.secret), String(tokens.scope || ''), Date.now()).run();
  }
  // A short-lived code the app can only redeem with its PKCE verifier (POST /api/token).
  const appCode = await sign({ kind: 'code', email, name: claims.name || email, challenge: flow.app, exp: Math.floor(Date.now() / 1000) + CODE_SECONDS }, c.secret);
  return toApp(`code=${encodeURIComponent(appCode)}`, url);
}

// ---- the app's token and its sync ----------------------------------------------------------------------------------
async function readJson(request, limit) {
  if (Number(request.headers.get('Content-Length') || 0) > limit) return { tooBig: true };
  const text = await request.text();
  if (text.length > limit) return { tooBig: true };
  try { return { body: JSON.parse(text) }; } catch (_) { return { body: null }; }
}

async function token(request, env) {
  if (!configured(env)) return json({ error: 'auth_not_configured' }, 503);
  const { body } = await readJson(request, 16 * 1024);
  const code = await verify(body && body.code, env.SESSION_SECRET);
  if (!code || code.kind !== 'code' || typeof body.verifier !== 'string') return json({ error: 'bad_code' }, 400);
  if (b64url(await crypto.subtle.digest('SHA-256', enc.encode(body.verifier))) !== code.challenge) return json({ error: 'bad_code' }, 400);
  if (!allowed(code.email, env)) return json({ error: 'not_invited' }, 403);
  const exp = Math.floor(Date.now() / 1000) + TOKEN_SECONDS;
  return json({ token: await sign({ kind: 'app', email: code.email, name: code.name, exp }, env.SESSION_SECRET), email: code.email, name: code.name, expiresAt: exp });
}

async function appUser(request, env) {
  if (!configured(env)) return null;
  const auth = request.headers.get('Authorization') || '';
  const t = await verify(auth.startsWith('Bearer ') ? auth.slice(7) : null, env.SESSION_SECRET);
  if (!t || t.kind !== 'app') return null;
  return allowed(t.email, env) ? { email: t.email } : null;     // re-checked every time: removing someone locks them out
}

async function syncRoute(request, env, ctx) {
  const user = await appUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!env.DB) return json({ error: 'sync_not_configured' }, 503);
  const { body, tooBig } = await readJson(request, MAX_SYNC_BYTES);
  if (tooBig) return json({ error: 'too_large' }, 413);
  const res = await sync(env.DB, user.email, body);
  if (res.status !== 200) return json({ error: res.error }, res.status);
  // Bring in Calendar and Gmail after replying, when due; the phone gets the result on its next sync.
  if (ctx) ctx.waitUntil(importIfDue(env, user.email).catch(() => {}));
  return json({ cursor: res.cursor, more: res.more, changes: res.changes });
}

// Pull to refresh: import now and say what came in. The app then syncs to bring it down.
async function refreshRoute(request, env) {
  const user = await appUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!env.DB) return json({ error: 'sync_not_configured' }, 503);
  await migrate(env.DB);
  const acct = (await env.DB.prepare('SELECT last_import_at FROM google_accounts WHERE user_id = ?').bind(user.email).all()).results[0];
  if (!acct) return json({ ok: false, error: 'no_google' });
  if (acct.last_import_at && Date.now() - acct.last_import_at < 60_000) return json({ ok: true, skipped: true });
  return json(await importFor(env, user.email));
}

// ---- routing -----------------------------------------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    try {
      if (route === 'GET /api/status') return json({ configured: configured(env), sync: !!env.DB });
      if (route === 'GET /auth/google') return await startGoogle(env, url);
      if (route === 'GET /auth/google/callback') return await finishGoogle(request, env, url);
      if (route === 'POST /api/token') return await token(request, env);
      if (route === 'POST /api/sync') return await syncRoute(request, env, ctx);
      if (route === 'POST /api/refresh') return await refreshRoute(request, env);
    } catch (err) {
      return json({ error: 'server_error' }, 500);
    }
    return json({ error: 'not_found' }, 404);
  },

  // wrangler.jsonc "triggers": every hour through the day
  async scheduled(event, env, ctx) {
    if (configured(env) && env.DB) ctx.waitUntil(importAll(env));
  },
};
