// `vawe dev --data file.json` hands the page window.VAWE_DATA, and every file it writes carries a hash of the data. Needs Chrome and ffmpeg.
//   node --test tests/media/page-data-dev.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalJson, dataKey, DATA_ENV } from '../../harness/lib/page-params.mjs';

const PAGE = 'tests/fixtures/pages/data-colour.html';
const out = (name) => path.resolve('out', name);
const vawe = (...args) => spawnSync(process.execPath, [path.resolve('bin/vawe'), ...args], { encoding: 'utf8' });
const firstPixel = (file) => [...spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-vf', 'crop=8:8:0:0,scale=1:1,format=rgb24', '-f', 'rawvideo', '-'], { encoding: 'buffer' }).stdout];

test('dev --data paints the colour of the data, and two data files keep two drafts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-data-'));
  try {
    const red = path.join(dir, 'red.json');
    const blue = path.join(dir, 'blue.json');
    fs.writeFileSync(red, JSON.stringify({ brand: { colour: '#ff0000' } }));
    fs.writeFileSync(blue, JSON.stringify({ brand: { colour: '#0000ff' } }));
    const names = [red, blue].map((f) => `data-colour-data-${dataKey({ [DATA_ENV]: canonicalJson(JSON.parse(fs.readFileSync(f, 'utf8'))) })}-draft.mp4`);
    for (const n of names) fs.rmSync(out(n), { force: true });
    for (const f of [red, blue]) {
      const r = vawe('dev', PAGE, '--silent', '--no-judge', '--data', f);
      assert.equal(r.status, 0, r.stdout + r.stderr);
    }
    const [r, g, b] = firstPixel(out(names[0]));
    assert.ok(r > 200 && g < 60 && b < 60, `the first draft is not red: ${r},${g},${b}`);
    const [r2, g2, b2] = firstPixel(out(names[1]));
    assert.ok(b2 > 200 && r2 < 60 && g2 < 60, `the second draft is not blue: ${r2},${g2},${b2}`);
    assert.notEqual(names[0], names[1]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a missing or bad data file ends with exit 2, an error line and a fix line', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-data-'));
  try {
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '{"brand": ');
    for (const file of [path.join(dir, 'none.json'), bad]) {
      const r = vawe('dev', PAGE, '--silent', '--no-judge', '--data', file);
      assert.equal(r.status, 2, r.stdout + r.stderr);
      assert.match(r.stderr, /^error: --data .*\nfix: /m);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
