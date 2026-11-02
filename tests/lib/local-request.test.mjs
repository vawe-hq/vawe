import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { serveRepo } from '../../harness/lib/render-harness.mjs';
import { isPrivateHost } from '../../harness/media/shot-math.mjs';

const ask = (port, { path = '/package.json', method = 'GET', headers = {} } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  req.on('error', reject);
  req.end();
});

test('serveRepo answers its own host and refuses a foreign Host, a foreign Origin and a bad escape', async () => {
  const { port, close } = await serveRepo({ route: (req, res) => (req.method === 'POST' ? (res.writeHead(200), res.end(), true) : false) });
  try {
    assert.equal(await ask(port), 200);
    assert.equal(await ask(port, { headers: { host: `localhost:${port}` } }), 200);
    assert.equal(await ask(port, { method: 'POST', headers: { origin: `http://127.0.0.1:${port}` } }), 200);
    assert.equal(await ask(port, { headers: { host: `evil.example:${port}` } }), 403);
    assert.equal(await ask(port, { method: 'POST', headers: { origin: 'https://evil.example' } }), 403);
    assert.equal(await ask(port, { method: 'POST', headers: { origin: 'null' } }), 403);
    assert.equal(await ask(port, { path: '/%' }), 400);
    assert.equal(await ask(port), 200);
  } finally { close(); }
});

test('isPrivateHost: loopback, private and link-local hosts, not public names that look alike', () => {
  for (const h of ['127.0.0.1', 'localhost', 'a.localhost', '10.2.3.4', '172.20.1.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '[::1]', '::ffff:127.0.0.1', 'fd00::1']) assert.equal(isPrivateHost(h), true, h);
  for (const h of ['8.8.8.8', '172.32.1.1', 'vawe.dev', 'fcbarcelona.com', '[2001:db8::1]']) assert.equal(isPrivateHost(h), false, h);
});
