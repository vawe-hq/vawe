import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { templateFilm, listLines } from '../../harness/cli/template.mjs';
import { EXIT } from '../../harness/lib/exit-codes.mjs';
import { UsageError } from '../../harness/cli/parse.mjs';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures/templates');
const b64 = (text) => Buffer.from(text).toString('base64');

function proServer() {
  const server = http.createServer((req, res) => {
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    if (req.url === '/templates.json') return send(200, [{ id: 'pro-reel', tier: 'pro', category: 'launch', summary: 'A Pro reel.' }]);
    if (req.url === '/api/templates/pro-reel') return req.headers.authorization === 'Bearer good' ? send(200, { files: [{ path: 'page.html', base64: b64('<p>pro</p>') }] }) : send(401, {});
    if (req.url === '/api/templates/pro-evil') return send(200, { files: [{ path: 'page.html', base64: b64('x') }, { path: '../escape.txt', base64: b64('x') }] });
    return send(404, {});
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, api: `http://127.0.0.1:${server.address().port}` })));
}

function setup(extra = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-template-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-home-'));
  const env = { VAWE_TEMPLATES_DIR: FIXTURES, VAWE_TEMPLATES_API: 'http://127.0.0.1:1', ...extra };
  return { work, home, env, engine: work };
}

test('a free template is copied and the three catalog files are skipped', async () => {
  const { work, home, env, engine } = setup();
  const lines = await templateFilm({ id: 'fixture-sting', name: 'mine', work, engine, env, home });
  const dir = path.join(work, 'films', 'mine');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['assets', 'brief.md', 'page.html']);
  assert.ok(fs.existsSync(path.join(dir, 'assets', 'note.txt')));
  assert.ok(lines.some((l) => l.includes('Say the one thing') && l.includes('h1 in world hook')));
  assert.ok(lines.some((l) => l.startsWith('next: ')));
});

test('an existing film is not overwritten', async () => {
  const { work, home, env, engine } = setup();
  await templateFilm({ id: 'fixture-sting', name: 'mine', work, engine, env, home });
  fs.writeFileSync(path.join(work, 'films', 'mine', 'page.html'), 'kept');
  await assert.rejects(templateFilm({ id: 'fixture-sting', name: 'mine', work, engine, env, home }), UsageError);
  assert.equal(fs.readFileSync(path.join(work, 'films', 'mine', 'page.html'), 'utf8'), 'kept');
});

test('list prints a free id, and a Pro id when the site answers', async () => {
  const { server, api } = await proServer();
  try {
    const { env, engine } = setup({ VAWE_TEMPLATES_API: api });
    const text = (await listLines({ engine, env })).join('\n');
    assert.match(text, /fixture-sting\s+free\s+titles\s+A tiny template for tests\./);
    assert.match(text, /pro-reel\s+pro\s+launch/);
  } finally {
    server.close();
  }
});

test('list offline keeps the free ids and says Pro could not be listed', async () => {
  const { env, engine } = setup();
  const text = (await listLines({ engine, env })).join('\n');
  assert.match(text, /fixture-sting/);
  assert.match(text, /Pro templates could not be listed/);
});

test('an unknown id with no key prints the buy line and exits with the refusal code', async () => {
  const { work, home, env, engine } = setup();
  await assert.rejects(templateFilm({ id: 'pro-reel', name: 'mine', work, engine, env, home }), (e) => {
    assert.equal(e.exitCode, EXIT.REFUSED);
    assert.match(e.message, /buy it at https:\/\/vawe\.dev\/templates\/pro-reel, then npx vawe new mine --template pro-reel --key <key>/);
    return true;
  });
  assert.equal(fs.existsSync(path.join(work, 'films', 'mine')), false);
});

test('a refused key gets the buy line, a good key writes the files', async () => {
  const { server, api } = await proServer();
  try {
    const { work, home, env, engine } = setup({ VAWE_TEMPLATES_API: api });
    await assert.rejects(templateFilm({ id: 'pro-reel', name: 'mine', key: 'bad', work, engine, env, home }), (e) => e.exitCode === EXIT.REFUSED && /buy it at/.test(e.message));
    await templateFilm({ id: 'pro-reel', name: 'mine', key: 'good', work, engine, env, home });
    assert.equal(fs.readFileSync(path.join(work, 'films', 'mine', 'page.html'), 'utf8'), '<p>pro</p>');
  } finally {
    server.close();
  }
});

test('the key comes from VAWE_KEY, then ~/.vawe/key', async () => {
  const { server, api } = await proServer();
  try {
    const first = setup({ VAWE_TEMPLATES_API: api, VAWE_KEY: 'good' });
    await templateFilm({ id: 'pro-reel', name: 'a', work: first.work, engine: first.engine, env: first.env, home: first.home });
    const second = setup({ VAWE_TEMPLATES_API: api });
    fs.mkdirSync(path.join(second.home, '.vawe'));
    fs.writeFileSync(path.join(second.home, '.vawe', 'key'), 'good\n');
    await templateFilm({ id: 'pro-reel', name: 'b', work: second.work, engine: second.engine, env: second.env, home: second.home });
    assert.ok(fs.existsSync(path.join(second.work, 'films', 'b', 'page.html')));
  } finally {
    server.close();
  }
});

test('a path with .. from the API is rejected and nothing is written', async () => {
  const { server, api } = await proServer();
  try {
    const { work, home, env, engine } = setup({ VAWE_TEMPLATES_API: api });
    await assert.rejects(templateFilm({ id: 'pro-evil', name: 'mine', key: 'good', work, engine, env, home }), (e) => e.exitCode === EXIT.IO && /not allowed/.test(e.message));
    assert.equal(fs.existsSync(path.join(work, 'films', 'mine')), false);
    assert.equal(fs.existsSync(path.join(work, 'films', 'escape.txt')), false);
  } finally {
    server.close();
  }
});
