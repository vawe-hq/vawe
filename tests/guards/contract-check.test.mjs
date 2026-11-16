import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { contractCheck, withoutComments } from '../../harness/guards/index.mjs';

const HEAD = '<meta name="duration" content="3">\n<meta name="message" content="zero fees">\n';
const BODY = '<section data-world="hello"><h1>Zero fees</h1></section>\n';
const page = (script = '', { head = HEAD, body = BODY, extra = '' } = {}) => `${head}${body}${extra}<script>\n${script}\n</script>\n`;
const codes = (findings, severity) => findings.filter((f) => !severity || f.severity === severity).map((f) => f.code);

test('the smallest film in AGENTS.md has no finding', () => {
  const html = `${HEAD}${BODY}<style>h1 { font-size: calc(var(--vh) * 0.12); animation: in 0.8s var(--ease-land) both }
@keyframes in { from { translate: 0 40px; opacity: 0 } to { translate: 0 0; opacity: 1 } }</style>`;
  assert.deepEqual(contractCheck(html), []);
});

test('setTimeout in a line comment, a block comment, an html comment or a css comment is not a timer', () => {
  for (const script of ['// setTimeout(go, 100)', '/* setTimeout(go, 100) */', 'const a = 1; // setTimeout(go, 100)']) {
    assert.deepEqual(codes(contractCheck(page(script)), 'advise'), [], script);
  }
  assert.deepEqual(codes(contractCheck(page('', { extra: '<!-- setTimeout(go, 100) -->\n<style>/* Math.random() */</style>\n' })), 'advise'), []);
});

test('setTimeout in code advises at its own line', () => {
  const found = contractCheck(page('const a = 1;\n\nsetTimeout(go, 100);')).filter((f) => f.code === 'timer');
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, 'advise');
  assert.equal(found[0].line, 7);
  assert.match(found[0].fix, /keyframe|animate|window\.seek/);
});

test('a // inside a string does not hide the code after it', () => {
  const found = contractCheck(page('const u = "http://a.test/x"; setInterval(go, 9);'));
  assert.deepEqual(codes(found, 'advise'), ['timer']);
});

test('withoutComments keeps every offset and line', () => {
  const html = '<p>a</p>\n<script>\nx(); // note\n/* two\nlines */ y();\n</script>';
  const out = withoutComments(html);
  assert.equal(out.length, html.length);
  assert.equal(out.split('\n').length, html.split('\n').length);
  assert.doesNotMatch(out, /note|two/);
  assert.match(out, /x\(\);\s+y\(\);/);
});

test('a seeded random helper is fine and Math.random advises', () => {
  const seeded = 'function rng(seed) { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }\nconst rand = rng(7); const x = rand();';
  assert.deepEqual(codes(contractCheck(page(seeded)), 'advise'), []);
  const raw = contractCheck(page('const x = Math.random();')).filter((f) => f.code === 'unseeded-random');
  assert.equal(raw.length, 1);
  assert.equal(raw[0].severity, 'advise');
  assert.match(raw[0].fix, /rng/);
  assert.deepEqual(codes(contractCheck(page(`${seeded}\nMath.random = rng(1);\nconst y = Math.random();`)), 'advise'), []);
});

test('a live clock advises: Date.now, performance.now, requestAnimationFrame', () => {
  for (const call of ['Date.now()', 'performance.now()', 'requestAnimationFrame(tick)']) {
    assert.deepEqual(codes(contractCheck(page(`const t = ${call};`)), 'advise'), ['live-clock'], call);
  }
});

test('a vetted waiver drops the finding; a generic or empty reason does not', () => {
  const waive = (why) => `<script type="application/json" id="authoring">${JSON.stringify({ allow: ['timer'], _why: { timer: why } })}</script>\n`;
  const code = 'setTimeout(go, 100);';
  const ok = contractCheck(page(code, { extra: waive('world hello: one timer at 0.5 s drifts 3 ms, the seek moves it to a frame') }));
  assert.deepEqual(codes(ok, 'advise'), []);
  assert.deepEqual(codes(contractCheck(page(code, { extra: waive('intentional') })), 'advise'), ['timer']);
  assert.deepEqual(codes(contractCheck(page(code, { extra: waive('') })), 'advise'), ['timer']);
  const scoped = JSON.stringify({ allow: ['timer@9-10'], _why: { 'timer@9-10': 'world hello: one timer at 9.5 s drifts 3 ms' } });
  assert.deepEqual(codes(contractCheck(page(code, { extra: `<script type="application/json" id="authoring">${scoped}</script>\n` })), 'advise'), ['timer']);
});

test('the duration meta: missing and zero block, a number and auto pass', () => {
  const noMeta = contractCheck(page('', { head: '<meta name="message" content="m">\n' }));
  assert.deepEqual(codes(noMeta, 'block'), ['duration']);
  assert.match(noMeta[0].fix, /content="auto"/);
  assert.deepEqual(codes(contractCheck(page('', { head: '<meta name="duration" content="0">\n<meta name="message" content="m">\n' })), 'block'), ['duration']);
  assert.deepEqual(codes(contractCheck(page('', { head: '<meta name="duration" content="auto">\n<meta name="message" content="m">\n' })), 'block'), []);
  assert.deepEqual(codes(contractCheck(page('', { head: '<meta name="duration" content="12.4">\n<meta name="message" content="m">\n' })), 'block'), []);
});

test('a page with no data-world blocks; a bad or repeated id only advises', () => {
  assert.deepEqual(codes(contractCheck(page('', { body: '<h1>x</h1>\n' })), 'block'), ['no-world']);
  const two = contractCheck(page('', { body: '<section data-world="A_1"></section><section data-world="b"></section><section data-world="b"></section>\n' }));
  assert.deepEqual(codes(two, 'block'), []);
  assert.deepEqual(codes(two, 'advise').sort(), ['world-id', 'world-twice']);
});

test('an absolute path blocks and a relative one passes; a missing local file only advises', () => {
  const abs = contractCheck(page('', { extra: '<img src="/Users/me/a.png">\n' }));
  assert.deepEqual(codes(abs, 'block'), ['absolute-path']);
  assert.deepEqual(codes(contractCheck(page('', { extra: '<img src="assets/a.png"><div style="background:url(assets/b.png)"></div>\n' })), 'block'), []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-contract-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'here.png'), '');
  const html = page('', { extra: '<img src="assets/here.png"><img src="assets/gone.png"><img src="data:image/png;base64,AA">\n' });
  const found = contractCheck(html, { filmDir: dir });
  assert.deepEqual(found.map((f) => [f.code, f.severity]), [['asset-missing', 'advise']]);
  assert.match(found[0].message, /gone\.png/);
  assert.deepEqual(contractCheck(html), []);
});

test('everything that is not the contract only advises, and the engine clock covers timers and random', () => {
  const found = contractCheck(page('const x = Math.random();', { head: '<meta name="duration" content="3">\n', extra: '<style>.a { transition: opacity 1s }</style>\n' }));
  assert.deepEqual(found.map((f) => `${f.severity}:${f.code}`), ['advise:message-meta', 'advise:unseeded-random', 'advise:css-transition']);
  for (const f of found) assert.ok(f.message && f.fix, f.code);
});
