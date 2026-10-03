// Static dev server for LOWBEAM. Node only, no dependencies, works on Windows and Linux.
//
// Like any static server, except it sends no-store so edited ES modules reload instead
// of coming from the browser's module cache. It also accepts POST /__shot: the page
// sends a base64 PNG of the canvas and the server writes tools/shots/<name>.png. The game
// is verified by looking at it, and a file on disk is something an agent can open.
// POST /__file does the same for other captures (rendered audio, JSON): the body is
// { name, ext, data } with base64 data, written to tools/shots/<name>.<ext>.
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
const RANGES = { 'Accept-Ranges': 'bytes' };

/**
 * Reads a `Range: bytes=` header against a file of `size` bytes.
 * @param {string} header @param {number} size
 * @returns {{ start: number, end: number } | null | undefined} the slice, null when the
 *   range cannot be satisfied (416), or undefined when there is no usable range and the
 *   whole file should be sent.
 */
export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec((header || '').trim());
  if (!m) return undefined;
  const [, from, to] = m;
  if (from === '' && to === '') return undefined;
  let start;
  let end;
  if (from === '') {
    // A suffix range asks for the last n bytes.
    const n = Number(to);
    if (!Number.isFinite(n) || n <= 0) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(from);
    end = to === '' ? size - 1 : Math.min(Number(to), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= size || start > end) return null;
  return { start, end };
}

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

const FILE_EXT = new Set(['wav', 'json', 'txt', 'png']);

function capture(req, res) {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let out;
    try {
      const payload = JSON.parse(body);
      const name = path.basename(String(payload.name || 'file'));
      const ext = String(payload.ext || 'txt');
      if (!FILE_EXT.has(ext)) throw new Error(`extension ${ext} is not allowed`);
      fs.mkdirSync(SHOTS, { recursive: true });
      const target = path.join(SHOTS, `${name}.${ext}`);
      fs.writeFileSync(target, Buffer.from(String(payload.data || ''), 'base64'));
      out = { ok: true, path: target };
    } catch (err) {
      out = { ok: false, error: String(err) };
    }
    res.writeHead(200, { 'Content-Type': 'application/json', ...NO_STORE });
    res.end(JSON.stringify(out));
  });
}

/** Builds the static server without listening, so a test can start it on a free port. */
export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/__shot') return shot(req, res);
    if (req.method === 'POST' && url.pathname === '/__file') return capture(req, res);
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
      const type = TYPES[path.extname(file)] || 'application/octet-stream';
      const slice = parseRange(req.headers.range, data.length);
      if (slice === null) {
        res.writeHead(416, { 'Content-Range': `bytes */${data.length}`, ...RANGES, ...NO_STORE }).end();
        return;
      }
      if (slice) {
        const body = data.subarray(slice.start, slice.end + 1);
        res.writeHead(206, {
          'Content-Type': type,
          'Content-Range': `bytes ${slice.start}-${slice.end}/${data.length}`,
          'Content-Length': String(body.length),
          ...RANGES,
          ...NO_STORE,
        });
        res.end(req.method === 'HEAD' ? undefined : body);
        return;
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': String(data.length), ...RANGES, ...NO_STORE });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}

// Only listen when this file is the entry point, so a test can import createServer
// without taking the port.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, '127.0.0.1', () => {
    console.log(`LOWBEAM :: serving ${ROOT} at http://localhost:${PORT}  (no-store, ranges)`);
  });
}
