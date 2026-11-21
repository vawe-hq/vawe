import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deliverTemplate } from '../../site/lib/templates-pro-api.ts';
import { buildTemplates } from '../../scripts/site/templates.mjs';

const ENV = { POLAR_ORG_ID: 'org-1', TEMPLATES_REPO_TOKEN: 'ghp_secret', TEMPLATES_REPO: 'acme/pro' };
const b64 = (s) => Buffer.from(s).toString('base64');

function fakeFetch({ polar = { status: 200, body: { status: 'granted' } }, tree } = {}) {
  const calls = [];
  const blobs = { sha1: `${b64('<html>')}\n`, sha2: b64('asset') };
  const impl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith('https://api.polar.sh/')) return Response.json(polar.body, { status: polar.status });
    if (String(url).endsWith('/git/trees/HEAD?recursive=1')) {
      return Response.json(tree ?? { truncated: false, tree: [
        { path: 'title-sting', type: 'tree', sha: 't' },
        { path: 'title-sting/page.html', type: 'blob', sha: 'sha1' },
        { path: 'title-sting/assets/a.png', type: 'blob', sha: 'sha2' },
        { path: 'title-sting-2/page.html', type: 'blob', sha: 'sha1' },
      ] });
    }
    const sha = /git\/blobs\/(\w+)$/.exec(String(url))?.[1];
    return Response.json({ encoding: 'base64', content: blobs[sha] });
  };
  return { impl, calls };
}

const get = (id, { headers = {}, query = '', method = 'GET', env = ENV, fetchImpl } = {}) =>
  deliverTemplate(new Request(`https://vawe.dev/api/templates/${id}${query}`, { method, headers }), id, env, fetchImpl);

test('no key is a 401 and nothing is fetched', async () => {
  const { impl, calls } = fakeFetch();
  const res = await get('title-sting', { fetchImpl: impl });
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);
});

test('a key Polar does not grant is a 403 and the private repo is never read', async () => {
  for (const polar of [{ status: 404, body: {} }, { status: 422, body: {} }, { status: 200, body: { status: 'revoked' } }, { status: 200, body: {} }]) {
    const { impl, calls } = fakeFetch({ polar });
    const res = await get('title-sting', { headers: { authorization: 'Bearer bad' }, fetchImpl: impl });
    assert.equal(res.status, 403, JSON.stringify(polar));
    assert.equal(calls.length, 1);
  }
});

test('a Polar outage is a 502, not a verdict on the key', async () => {
  const res = await get('title-sting', { headers: { authorization: 'Bearer k' }, fetchImpl: fakeFetch({ polar: { status: 500, body: {} } }).impl });
  assert.equal(res.status, 502);
  const down = await get('title-sting', { headers: { authorization: 'Bearer k' }, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(down.status, 502);
});

test('a granted key gets every file under the id, with the path made relative and the base64 on one line', async () => {
  const { impl, calls } = fakeFetch();
  const res = await get('title-sting', { headers: { authorization: 'Bearer good-key' }, fetchImpl: impl });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { files: [{ path: 'page.html', base64: b64('<html>') }, { path: 'assets/a.png', base64: b64('asset') }] });
  const polar = calls[0];
  assert.equal(polar.url, 'https://api.polar.sh/v1/customer-portal/license-keys/validate');
  assert.deepEqual(JSON.parse(polar.init.body), { key: 'good-key', organization_id: 'org-1' });
  for (const c of calls.slice(1)) {
    assert.ok(c.url.startsWith('https://api.github.com/repos/acme/pro/'), c.url);
    assert.equal(c.init.headers.authorization, 'Bearer ghp_secret');
  }
});

test('the key may come as ?key= and the call may be a POST; the repo defaults to vawe-hq/vawe-templates-pro', async () => {
  const { impl, calls } = fakeFetch();
  const res = await get('title-sting', { query: '?key=from-query', method: 'POST', env: { ...ENV, TEMPLATES_REPO: undefined }, fetchImpl: impl });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(calls[0].init.body).key, 'from-query');
  assert.ok(calls[1].url.startsWith('https://api.github.com/repos/vawe-hq/vawe-templates-pro/'));
});

test('an unknown id is a 404, and an id that is not a plain slug never reaches the repo', async () => {
  const { impl, calls } = fakeFetch();
  assert.equal((await get('nope', { headers: { authorization: 'Bearer k' }, fetchImpl: impl })).status, 404);
  const before = calls.length;
  for (const id of ['..', 'a/b', 'Title', 'a--b']) assert.equal((await get(id, { headers: { authorization: 'Bearer k' }, fetchImpl: impl })).status, 404, id);
  assert.equal(calls.length, before);
});

test('a truncated tree is a 502 and a missing server setting is a 503', async () => {
  const cut = await get('title-sting', { headers: { authorization: 'Bearer k' }, fetchImpl: fakeFetch({ tree: { truncated: true, tree: [] } }).impl });
  assert.equal(cut.status, 502);
  const off = await get('title-sting', { headers: { authorization: 'Bearer k' }, env: {}, fetchImpl: fakeFetch().impl });
  assert.equal(off.status, 503);
});

const card = (over = {}) => ({
  id: 'title-sting', title: 'Title sting', summary: 'One line.', category: 'titles', tier: 'free', length: 5, aspect: '16:9',
  structure: 'hook, mark, title, hold', inputs: [{ key: 'title', label: 'Headline', default: 'Say it', where: 'h1 in world hook' }], tags: ['logo'], ...over,
});

function fixtureRoot({ free = [card()], pro = [], extra = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'templates-'));
  fs.mkdirSync(path.join(root, 'site', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'site', 'lib', 'templates-pro.json'), JSON.stringify(pro));
  for (const c of free) {
    const dir = path.join(root, 'templates', c.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'template.json'), JSON.stringify(c));
    for (const f of ['page.html', 'preview.mp4', 'poster.webp']) fs.writeFileSync(path.join(dir, f), `${c.id} ${f}`);
  }
  for (const [file, text] of Object.entries(extra)) {
    fs.mkdirSync(path.dirname(path.join(root, 'templates', file)), { recursive: true });
    fs.writeFileSync(path.join(root, 'templates', file), text);
  }
  return root;
}

const slot = (over = {}) => ({ key: 'screen-1', label: 'Main app screen', kind: 'image', size: '1600x1000', file: 'assets/slots/screen-1.png', where: 'the laptop in world tour', ...over });
const slotFiles = { 'title-sting/assets/slots/screen-1.png': 'x' };

test('slots reach templates.json with their size, kind and span', () => {
  const root = fixtureRoot({ free: [card({ slots: [slot(), slot({ key: 'clip', kind: 'video', file: 'assets/slots/clip.mp4', span: 4 })] })], extra: { ...slotFiles, 'title-sting/assets/slots/clip.mp4': 'x' } });
  const [built] = buildTemplates({ root });
  assert.deepEqual(built.slots.map((s) => [s.key, s.kind, s.size, s.span]), [['screen-1', 'image', '1600x1000', undefined], ['clip', 'video', '1600x1000', 4]]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'site', 'lib', 'templates.json'), 'utf8')).templates[0].slots[0].file, 'assets/slots/screen-1.png');
});

test('a card with no slots gets an empty list', () => {
  assert.deepEqual(buildTemplates({ root: fixtureRoot() })[0].slots, []);
});

test('a bad slot names the slot and the problem, and a slot without its placeholder file is refused', () => {
  for (const [over, want] of [[{ kind: 'audio' }, /slots\[0\] \(screen-1\): kind must be image or video/], [{ size: '16:10' }, /size must look like/], [{ file: 'assets/slots/screen-1.mp4' }, /is not a image file/]]) {
    assert.throws(() => buildTemplates({ root: fixtureRoot({ free: [card({ slots: [slot(over)] })] }) }), want);
  }
  assert.throws(() => buildTemplates({ root: fixtureRoot({ free: [card({ slots: [slot()] })] }) }), /slot screen-1 has no placeholder file at assets\/slots\/screen-1\.png/);
  assert.throws(() => buildTemplates({ root: fixtureRoot({ free: [card({ slots: [slot(), slot()] })], extra: slotFiles }) }), /key screen-1 is used twice/);
});

test('a template whose page loads a file outside its folder and ../../core/ is refused', () => {
  const root = fixtureRoot({ extra: { 'title-sting/page.html': `<script type="module">import a from '../../prompts/moves/a.js'</script>` } });
  assert.throws(() => buildTemplates({ root }), /templates\/title-sting: page\.html loads \.\.\/\.\.\/prompts\/moves\/a\.js/);
});

test('one free template is copied to site/public/templates and listed in templates.json', () => {
  const root = fixtureRoot();
  const cards = buildTemplates({ root });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].hasSource, true);
  assert.match(cards[0].hash, /^[0-9a-f]{12}$/);
  for (const f of ['title-sting.mp4', 'title-sting.webp', 'title-sting.page.html']) assert.ok(fs.existsSync(path.join(root, 'site', 'public', 'templates', f)), f);
  const data = JSON.parse(fs.readFileSync(path.join(root, 'site', 'lib', 'templates.json'), 'utf8'));
  assert.equal(data.templates[0].id, 'title-sting');
  assert.equal(data.categories.length, 8);
});

test('a Pro entry is metadata only and needs its public preview; stale files are removed', () => {
  const root = fixtureRoot({ pro: [card({ id: 'north-wind', tier: 'pro' })] });
  assert.throws(() => buildTemplates({ root }), /public preview/);
  const out = path.join(root, 'site', 'public', 'templates');
  fs.writeFileSync(path.join(out, 'north-wind.mp4'), 'x');
  fs.writeFileSync(path.join(out, 'north-wind.webp'), 'x');
  fs.writeFileSync(path.join(out, 'gone.mp4'), 'x');
  const cards = buildTemplates({ root });
  assert.deepEqual(cards.map((c) => [c.id, c.hasSource]), [['title-sting', true], ['north-wind', false]]);
  assert.ok(!fs.existsSync(path.join(out, 'gone.mp4')));
});

test('a bad card names the file and the problem', () => {
  assert.throws(() => buildTemplates({ root: fixtureRoot({ free: [card({ category: 'memes' })] }) }), /category must be one of/);
  assert.throws(() => buildTemplates({ root: fixtureRoot({ free: [card({ summary: 'x'.repeat(120) })] }) }), /under 120/);
  assert.throws(() => buildTemplates({ root: fixtureRoot({ free: [card({ tier: 'pro' })] }) }), /must be free/);
  assert.throws(() => buildTemplates({ root: fixtureRoot({ free: [card({ id: 'Bad_Id' })] }) }), /id must be lowercase/);
  assert.throws(() => buildTemplates({ root: fixtureRoot({ free: [card({ inputs: [{ key: 'a' }] })] }) }), /every input needs/);
});

test('an id used by a free and a Pro template is refused', () => {
  const root = fixtureRoot({ pro: [card({ tier: 'pro' })] });
  const out = path.join(root, 'site', 'public', 'templates');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'title-sting.mp4'), 'x');
  fs.writeFileSync(path.join(out, 'title-sting.webp'), 'x');
  assert.throws(() => buildTemplates({ root }), /used by a free and a Pro/);
});
