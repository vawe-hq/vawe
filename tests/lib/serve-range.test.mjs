import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { serveRepo, parseRange } from '../../harness/lib/render-harness.mjs';

const get = (port, file, range) => new Promise((resolve, reject) => {
  const headers = range ? { range } : {};
  http.get({ host: '127.0.0.1', port, path: `/${file}`, headers }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
  }).on('error', reject);
});

test('parseRange: a-b, a-, -n, past the end, bad forms', () => {
  assert.deepEqual(parseRange('bytes=2-5', 10), { start: 2, end: 5 });
  assert.deepEqual(parseRange('bytes=4-', 10), { start: 4, end: 9 });
  assert.deepEqual(parseRange('bytes=-3', 10), { start: 7, end: 9 });
  assert.deepEqual(parseRange('bytes=-30', 10), { start: 0, end: 9 });
  assert.deepEqual(parseRange('bytes=8-99', 10), { start: 8, end: 9 });
  for (const bad of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=99-120']) assert.equal(parseRange(bad, 10), 'unsatisfiable', bad);
  for (const none of [undefined, 'bytes=0-1,4-5', 'bytes=-', 'items=0-1', 'bytes=a-b']) assert.equal(parseRange(none, 10), null, String(none));
});

test('serveRepo answers byte ranges with 206, and a bad range with 416', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-range-'));
  fs.writeFileSync(path.join(dir, 'f.txt'), '0123456789');
  const { port, close } = await serveRepo({ root: dir });
  try {
    const whole = await get(port, 'f.txt');
    assert.equal(whole.status, 200);
    assert.equal(whole.headers['accept-ranges'], 'bytes');
    assert.equal(whole.headers['content-length'], '10');
    assert.equal(whole.body, '0123456789');
    const mid = await get(port, 'f.txt', 'bytes=2-5');
    assert.equal(mid.status, 206);
    assert.equal(mid.headers['content-range'], 'bytes 2-5/10');
    assert.equal(mid.headers['content-length'], '4');
    assert.equal(mid.body, '2345');
    assert.equal((await get(port, 'f.txt', 'bytes=7-')).body, '789');
    assert.equal((await get(port, 'f.txt', 'bytes=-2')).body, '89');
    const bad = await get(port, 'f.txt', 'bytes=50-60');
    assert.equal(bad.status, 416);
    assert.equal(bad.headers['content-range'], 'bytes */10');
  } finally { close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
