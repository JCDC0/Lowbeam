import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer, parseRange } from '../tools/devserver.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PKG = readFileSync(new URL('../package.json', import.meta.url));

/** Starts the dev server on a free port and hands back its base URL and a stop function. */
async function serve() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { base: `http://127.0.0.1:${port}`, stop: () => new Promise((r) => server.close(r)) };
}

test('parseRange reads the three range forms and rejects one past the end', () => {
  assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(parseRange('bytes=10-', 100), { start: 10, end: 99 });
  assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=0-500', 100), { start: 0, end: 99 });
  assert.equal(parseRange('bytes=100-200', 100), null, 'a range past the end is not satisfiable');
  assert.equal(parseRange('bytes=abc', 100), undefined, 'unparseable: serve the whole file');
  assert.equal(parseRange('', 100), undefined);
});

test('the dev server answers a range request with 206 and the right slice', async () => {
  const { base, stop } = await serve();
  try {
    const res = await fetch(`${base}/package.json`, { headers: { Range: 'bytes=0-9' } });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-range'), `bytes 0-9/${PKG.length}`);
    assert.equal(res.headers.get('accept-ranges'), 'bytes');
    assert.match(res.headers.get('cache-control') || '', /no-store/);
    const body = Buffer.from(await res.arrayBuffer());
    assert.equal(body.length, 10);
    assert.deepEqual(body, PKG.subarray(0, 10));
  } finally {
    await stop();
  }
});

test('an open ended range runs to the end of the file', async () => {
  const { base, stop } = await serve();
  try {
    const res = await fetch(`${base}/package.json`, { headers: { Range: 'bytes=90-' } });
    assert.equal(res.status, 206);
    const body = Buffer.from(await res.arrayBuffer());
    assert.deepEqual(body, PKG.subarray(90));
    assert.equal(res.headers.get('content-range'), `bytes 90-${PKG.length - 1}/${PKG.length}`);
  } finally {
    await stop();
  }
});

test('a suffix range returns the last bytes', async () => {
  const { base, stop } = await serve();
  try {
    const res = await fetch(`${base}/package.json`, { headers: { Range: 'bytes=-25' } });
    assert.equal(res.status, 206);
    const body = Buffer.from(await res.arrayBuffer());
    assert.deepEqual(body, PKG.subarray(PKG.length - 25));
  } finally {
    await stop();
  }
});

test('a range past the end of the file is 416 with the real length', async () => {
  const { base, stop } = await serve();
  try {
    const res = await fetch(`${base}/package.json`, { headers: { Range: `bytes=${PKG.length + 10}-${PKG.length + 20}` } });
    assert.equal(res.status, 416);
    assert.equal(res.headers.get('content-range'), `bytes */${PKG.length}`);
    await res.arrayBuffer();
  } finally {
    await stop();
  }
});

test('a request with no range still gets the whole file and advertises ranges', async () => {
  const { base, stop } = await serve();
  try {
    const res = await fetch(`${base}/package.json`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('accept-ranges'), 'bytes');
    assert.match(res.headers.get('cache-control') || '', /no-store/);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), PKG);
  } finally {
    await stop();
  }
});

test('a partial request for a missing file is still a 404', async () => {
  const { base, stop } = await serve();
  try {
    const res = await fetch(`${base}/no-such-file.json`, { headers: { Range: 'bytes=0-9' } });
    assert.equal(res.status, 404);
    await res.arrayBuffer();
  } finally {
    await stop();
  }
});

test('ROOT is the repository directory', () => {
  assert.match(ROOT, /Lowbeam[/\\]?$/i);
});