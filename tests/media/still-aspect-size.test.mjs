// `vawe frame` takes --aspect (any W:H, over the page meta) and --size WxH; the aspect is part of the file names like a param.
// Needs Chrome.   node --test tests/media/still-aspect-size.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { UsageError } from '../../harness/cli/parse.mjs';
import { isAspect, aspectProblem, aspectSlug, aspectValue, renderEnv, paramsFilm, paramsFlags, ASPECT_ENV } from '../../harness/lib/page-params.mjs';
import { resolveFrame, defaultOut } from '../../harness/media/render-page.mjs';
import { stillPath, stillProblem, sizeProblem } from '../../harness/media/see/still-math.mjs';

const PAGE = 'tests/fixtures/pages/aspect-probe.html';
const VAWE = path.resolve('bin/vawe');
const vawe = (...args) => spawnSync(process.execPath, [VAWE, 'still', PAGE, '--at', '0', ...args], { encoding: 'utf8' });
const png = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const px = (f) => [...spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'crop=1:1:10:10,format=rgb24', '-f', 'rawvideo', '-'], { encoding: 'buffer' }).stdout];
const still = (name) => path.resolve('out/still', name);

test('an aspect is a W:H ratio of whole numbers; all and none set nothing', () => {
  assert.equal(aspectValue('1200:630'), '1200:630');
  assert.equal(aspectValue('all'), '');
  assert.equal(aspectValue(undefined), '');
  for (const bad of ['0:1', '16-9', '16:', '1.5:1', '2:0']) assert.throws(() => aspectValue(bad), /--aspect "[^"]*" is not a W:H ratio of whole numbers/, bad);
  assert.deepEqual(renderEnv({ aspect: '2:1' }), { [ASPECT_ENV]: '2:1' });
  assert.deepEqual(renderEnv({}), {});
});

test('the aspect is in every default file name and in the printed command', () => {
  const env = { [ASPECT_ENV]: '2:1', VAWE_PARAMS: 'look=riso' };
  assert.equal(paramsFilm('card', env), 'card-look-riso_2x1');
  assert.equal(paramsFilm('card', { [ASPECT_ENV]: '1200:630' }), 'card-1200x630');
  assert.equal(paramsFilm('card', {}), 'card');
  assert.equal(paramsFlags(env), ' --param look=riso --aspect 2:1');
  process.env[ASPECT_ENV] = '2:1';
  try {
    assert.equal(stillPath(PAGE, 0), path.resolve('out/still/aspect-probe-2x1-0s.png'));
    assert.equal(stillPath(PAGE, 0, '800x400'), path.resolve('out/still/aspect-probe-2x1-800x400-0s.png'));
    assert.equal(defaultOut(PAGE, { aspect: '2:1', final: true }), path.join('out', 'aspect-probe-2x1.mp4'));
  } finally { delete process.env[ASPECT_ENV]; }
});

test('the frame takes the aspect of the flag over the page meta', () => {
  assert.equal(resolveFrame(PAGE, {}).aspect, '16:9');
  process.env[ASPECT_ENV] = '2:1';
  try {
    const f = resolveFrame(PAGE, { final: true });
    assert.deepEqual([f.aspect, f.width, f.height], ['2:1', 1920, 960]);
  } finally { delete process.env[ASPECT_ENV]; }
});

test('--size must have the ratio of the aspect, and says the size that does', () => {
  assert.equal(sizeProblem('1200x630', '1200:630'), null);
  assert.equal(sizeProblem('1920x1080', '16:9'), null);
  assert.match(sizeProblem('1200x630', '16:9'), /not the aspect 16:9.*1200x675.*--aspect 1200:630/);
  assert.match(stillProblem({ source: 'p.html', at: '0', size: '1200' }), /--size is not WxH/);
  assert.equal(stillProblem({ source: 'p.html', at: '0', size: '1200x630' }), null);
});

test('vawe frame --aspect 2:1 paints the page at 2:1, and the next plain still is 16:9 again', () => {
  const wide = still('aspect-probe-2x1-0s.png');
  const plain = still('aspect-probe-0s.png');
  fs.rmSync(wide, { force: true });
  fs.rmSync(plain, { force: true });
  const a = vawe('--aspect', '2:1');
  assert.equal(a.status, 0, a.stdout + a.stderr);
  assert.match(a.stdout, /1920x960, the frame at 0s/);
  assert.deepEqual(png(wide), [1920, 960]);
  assert.deepEqual(px(wide), [255, 0, 0]);
  const b = vawe();
  assert.equal(b.status, 0, b.stdout + b.stderr);
  assert.deepEqual(png(plain), [1920, 1080]);
  assert.deepEqual(px(plain), [128, 128, 128]);
  fs.rmSync(wide, { force: true });
  const c = vawe('--aspect', '2:1');
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.deepEqual(px(wide), [255, 0, 0]);
});

test('vawe frame --aspect 1200:630 --size 1200x630 writes exactly 1200x630', () => {
  const out = still('aspect-probe-1200x630-1200x630-0s.png');
  fs.rmSync(out, { force: true });
  const r = vawe('--aspect', '1200:630', '--size', '1200x630');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /1200x630, the frame at 0s/);
  assert.deepEqual(png(out), [1200, 630]);
  assert.deepEqual(px(out), [0, 255, 0]);
});

test('vawe frame --size with another ratio than the page is refused with the size that fits', () => {
  const r = vawe('--size', '1200x630');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--size 1200x630 is not the aspect 16:9.*1200x675.*--aspect 1200:630/);
  assert.equal(fs.existsSync(still('aspect-probe-1200x630-0s.png')), false);
});

test('a bad --aspect is a usage error before any render', () => {
  const r = vawe('--aspect', '0:1');
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /--aspect "0:1" is not a W:H ratio of whole numbers/);
});

test('one owner decides what an aspect is and how its file name reads', () => {
  assert.equal(isAspect('1200:630'), true);
  assert.equal(isAspect('all'), false);
  assert.equal(aspectProblem('wide'), '"wide" is not a W:H ratio of whole numbers such as 16:9 or 1200:630');
  assert.equal(aspectSlug('1200:630'), '1200x630');
  assert.throws(() => resolveFrame(PAGE, { aspect: 'wide' }), /unknown aspect "wide" is not a W:H ratio/);
});

test('--out of a page still must be a PNG: a .jpg would hold PNG bytes under the wrong name', () => {
  const out = path.resolve('out/still/aspect-probe-jpg.jpg');
  fs.rmSync(out, { force: true });
  const r = vawe('--out', out);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /a page still is a PNG: --out aspect-probe-jpg\.jpg must end in \.png/);
  assert.equal(fs.existsSync(out), false);
});

const build = (name, v, input) => VERBS.find((x) => x.name === name).build(v, [input]);

test('--aspect all is a dev and ship batch: frame (a frame or a sheet) and approve refuse it', () => {
  for (const [name, v] of [['frame', { at: '0', aspect: 'all' }], ['frame', { aspect: 'all' }], ['approve', { aspect: 'all' }]]) {
    assert.throws(() => build(name, v, PAGE), (e) => e instanceof UsageError && /--aspect all renders every aspect: dev and ship take it/.test(e.message), name);
  }
  assert.doesNotThrow(() => build('ship', { aspect: 'all' }, PAGE));
});

test('a page-only option on an mp4 is refused once, for --param, --aspect and --size', () => {
  for (const [name, v] of [['frame', { aspect: '2:1' }], ['frame', { param: ['a=b'] }], ['frame', { at: '1', size: '10x10' }], ['frame', { at: '1', aspect: '2:1' }]]) {
    assert.throws(() => build(name, v, 'x.mp4'), /goes to a page: /, JSON.stringify(v));
  }
});

test('new --aspect help is about the brief, not the render override', () => {
  const help = VERBS.find((x) => x.name === 'new').flags.find((f) => f.name === 'aspect').help;
  assert.match(help, /written to brief\.md/);
  assert.doesNotMatch(help, /overrides|output name/);
});
