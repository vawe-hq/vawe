// `--param key=value` reaches the page as its query string, is part of the render key and of the default output names.
// Needs Chrome.   node --test tests/media/page-params.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { paramsQuery, pageQuery, paramsSlug, PARAMS_ENV } from '../../harness/lib/page-params.mjs';
import { renderKey, defaultOut } from '../../harness/media/render-page.mjs';
import { stillPath } from '../../harness/media/see/still-math.mjs';

const PAGE = 'tests/fixtures/pages/param-look.html';
const VAWE = path.resolve('bin/vawe');
const key = (query) => renderKey({ pagePath: PAGE, frame: { width: 1920, height: 1080 }, frames: 30, fps: 30, from: 0, blur: 1, query });

test('params become a sorted query, and a bad entry is named', () => {
  assert.equal(paramsQuery(['b=2', 'look=riso', 'a=x y']), 'a=x+y&b=2&look=riso');
  assert.equal(paramsQuery([]), '');
  assert.throws(() => paramsQuery(['look']), /--param needs key=value, got "look"/);
});

test('the query and the file-name slug come from the env of the process', () => {
  assert.equal(pageQuery({}), '');
  assert.equal(pageQuery({ [PARAMS_ENV]: 'look=riso' }), '?look=riso');
  assert.equal(paramsSlug({}), '');
  assert.equal(paramsSlug({ [PARAMS_ENV]: 'b=2&look=riso' }), 'b-2_look-riso');
});

test('another look is another render key', () => {
  assert.notEqual(key('look=riso'), key('look=mono'));
  assert.notEqual(key('look=riso'), key(''));
});

test('default output names differ per look', () => {
  assert.equal(stillPath(PAGE, 1), path.resolve('out/still/param-look-1s.png'));
  process.env[PARAMS_ENV] = 'look=riso';
  try {
    assert.equal(stillPath(PAGE, 1), path.resolve('out/still/param-look-look-riso-1s.png'));
    assert.equal(defaultOut(PAGE, { aspect: '16:9', final: false }), path.join('out', 'param-look-look-riso-draft.mp4'));
  } finally { delete process.env[PARAMS_ENV]; }
});

test('vawe frame --param look=riso renders the page with ?look=riso', () => {
  const riso = path.resolve('out/still/param-look-look-riso-0s.png');
  const plain = path.resolve('out/still/param-look-0s.png');
  fs.rmSync(riso, { force: true });
  fs.rmSync(plain, { force: true });
  const run = (...args) => spawnSync(process.execPath, [VAWE, 'still', PAGE, '--at', '0', ...args], { encoding: 'utf8' });
  const a = run('--param', 'look=riso');
  assert.equal(a.status, 0, a.stdout + a.stderr);
  const b = run();
  assert.equal(b.status, 0, b.stdout + b.stderr);
  const px = (f) => spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'crop=1:1:10:10,format=rgb24', '-f', 'rawvideo', '-'], { encoding: 'buffer' }).stdout;
  assert.deepEqual([...px(riso)], [255, 0, 0]);
  assert.deepEqual([...px(plain)], [128, 128, 128]);
});
