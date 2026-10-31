// Sign-in pieces for the Worker (index.js): signed tokens, cookies and JSON replies, and Google's OAuth 2.0 code
// exchange with the ID-token checks. No dependencies. (Shared in origin with the KohuLabs client portal's Worker.)

export const enc = new TextEncoder();

// ---- small helpers ---------------------------------------------------------------------------------------------
export const b64url = (buf) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64url = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));
export const emailList = (v) => String(v || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}
// signed token: base64url(JSON).base64url(HMAC)
export async function sign(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}
export async function verify(token, secret) {
  if (typeof token !== 'string' || token.split('.').length !== 2) return null;
  const [body, sig] = token.split('.');
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await hmacKey(secret, ['verify']), unb64url(sig), enc.encode(body)); } catch (_) { return null; }
  if (!ok) return null;
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(unb64url(body))); } catch (_) { return null; }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export const readCookie = (request, name) => {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
};
export const cookie = (name, value, { secure, maxAge, path = '/' }) =>
  `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export const redirect = (location, headers = []) => {
  const h = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const [k, v] of headers) h.append(k, v);
  return new Response(null, { status: 302, headers: h });
};

export const googleConfig = (env) => ({
  googleId: env.GOOGLE_CLIENT_ID, googleSecret: env.GOOGLE_CLIENT_SECRET, secret: env.SESSION_SECRET,
  authUrl: env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth',          // overridable for tests
  tokenUrl: env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
  issuers: env.GOOGLE_ISSUERS ? env.GOOGLE_ISSUERS.split(',') : ['https://accounts.google.com', 'accounts.google.com'],
});

/**
 * Finishes Google sign-in: trades the authorization code (with the PKCE verifier) for tokens and checks the ID
 * token's claims. Returns { claims, tokens } (tokens may include a refresh_token when offline access was granted),
 * or null when anything is off.
 */
export async function googleSignIn(c, { code, verifier, nonce, redirectUri }) {
  let tokens;
  try {
    const res = await fetch(c.tokenUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: c.googleId, client_secret: c.googleSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier }),
    });
    if (!res.ok) return null;
    tokens = await res.json();
  } catch (_) { return null; }

  // The ID token arrives straight from Google's token endpoint over TLS, so its signature need not be re-checked
  // (OpenID Connect Core §3.1.3.7); its claims still are.
  let claims;
  try { claims = JSON.parse(new TextDecoder().decode(unb64url(String(tokens.id_token).split('.')[1]))); } catch (_) { return null; }
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!c.issuers.includes(claims.iss) || !aud.includes(c.googleId) || claims.nonce !== nonce || !(claims.exp > now) || claims.email_verified !== true || !claims.email) return null;
  return { claims, tokens };
}

/**
 * A fresh access token from a stored refresh token. Returns { accessToken, scope }, or { error } where 'revoked'
 * means the person must sign in again (they removed access, or the token expired).
 */
export async function refreshAccess(c, refreshToken) {
  let res;
  try {
    res = await fetch(c.tokenUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: c.googleId, client_secret: c.googleSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
  } catch (_) { return { error: 'network' }; }
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.access_token) return { accessToken: body.access_token, scope: body.scope || '' };
  return { error: body.error === 'invalid_grant' ? 'revoked' : 'refresh_failed' };
}

// ---- secrets at rest: AES-GCM, with a key derived from SESSION_SECRET (HKDF), so no extra secret to manage ----------
async function sealKey(secret) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('kohulabs-android'), info: enc.encode('google-refresh-token') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function seal(text, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(secret), enc.encode(text));
  return `${b64url(iv)}.${b64url(data)}`;
}
export async function unseal(sealed, secret) {
  try {
    const [iv, data] = String(sealed).split('.').map(unb64url);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await sealKey(secret), data));
  } catch (_) { return null; }       // a changed SESSION_SECRET: the person signs in again
}
