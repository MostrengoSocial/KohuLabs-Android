// A small static server for the browser tests: serves web/ (the app's screens), index.html for folders and a 404
// for anything missing. No dependencies.
//   node serve.mjs [port]      (default 4173)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../web', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  let file = join(ROOT, clean);
  if (!file.startsWith(ROOT + sep) && file !== ROOT) return null; // no escaping web/
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, 'index.html');
    await stat(file);
    return file;
  } catch { return null; }
}

export function startServer(port = 4173) {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    let file = await resolveFile(path), status = 200;
    if (!file) { file = join(ROOT, '404.html'); status = 404; }
    try {
      const body = await readFile(file);
      res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = +process.argv[2] || 4173;
  startServer(port).then(() => console.log(`Serving ${ROOT} on http://127.0.0.1:${port}`));
}
