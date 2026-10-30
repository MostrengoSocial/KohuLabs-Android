// The Kohu Founders Worker on your computer, for trying the app's sync without Cloudflare: Node's SQLite stands in for D1, and
// POST /__test/token {email} hands out an app token (this route exists only here, never in the deployed Worker).
//   node api/dev-server.mjs [port]      (default 8799; data is kept in memory until it stops)
import { createServer } from 'node:http';
import worker from './index.js';
import { sign } from './google.js';
import { FakeD1 } from './fake-d1.mjs';

const SECRET = 'dev-'.repeat(10);
const env = { GOOGLE_CLIENT_ID: 'dev', GOOGLE_CLIENT_SECRET: 'dev', SESSION_SECRET: SECRET, FOUNDER_EMAILS: 'hello@kohulabs.com', DB: new FakeD1() };
const port = Number(process.argv[2] || 8799);

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  if (req.url === '/__test/token' && req.method === 'POST') {
    const { email } = JSON.parse(body.toString() || '{}');
    const token = await sign({ kind: 'app', email, name: email, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ token }));
  }
  const r = await worker.fetch(new Request(`http://127.0.0.1:${port}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, '127.0.0.1', () => console.log(`Kohu Founders dev Worker on http://127.0.0.1:${port}`));
