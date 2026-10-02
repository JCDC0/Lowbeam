// Static dev server for LOWBEAM. Node only, no dependencies, works on Windows and Linux.
//
// Like any static server, except it sends no-store so edited ES modules reload instead
// of coming from the browser's module cache. It also accepts POST /__shot: the page
// sends a base64 PNG of the canvas and the server writes tools/shots/<name>.png. The game
// is verified by looking at it, and a file on disk is something an agent can open.
//
//   node tools/devserver.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'tools', 'shots');
const PORT = Number(process.argv[2]) || 8040;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};
const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', Pragma: 'no-cache', Expires: '0' };

function shot(req, res) {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let out;
    try {
      const payload = JSON.parse(body);
      const name = path.basename(String(payload.name || 'shot'));
      const data = String(payload.data || '').split(',').pop();
      fs.mkdirSync(SHOTS, { recursive: true });
      const file = path.join(SHOTS, `${name}.${payload.png ? 'png' : 'jpg'}`);
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      out = { ok: true, path: file };
    } catch (err) {
      out = { ok: false, error: String(err) };
    }
    res.writeHead(200, { 'Content-Type': 'application/json', ...NO_STORE });
    res.end(JSON.stringify(out));
  });
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/__shot') return shot(req, res);
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) {
        process.stderr.write(`404 ${url.pathname}\n`);
        res.writeHead(404, NO_STORE).end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', ...NO_STORE });
      res.end(data);
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log(`LOWBEAM :: serving ${ROOT} at http://localhost:${PORT}  (no-store)`));
