// The pure parts of the template export: the layer split, the text keyframes, template.json, the layer style and the zip.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planLayers, keyframes, checkInputs, paintedSamples, textTrack, runsOf, keyFrameOf, TemplateError } from '../../harness/lib/template-plan.mjs';
import { layerCss } from '../../core/engine/page-layer.js';
import { zipFolder, listFiles } from '../../harness/lib/zip-write.mjs';
import { conventionName } from '../../harness/media/template-sample.mjs';
import { templateReadme } from '../../harness/lib/template-readme.mjs';

const on = (n, from, to) => Array.from({ length: n }, (_, i) => i >= from && i < to);
const child = (nth, label, shown, extra = {}) => ({ nth, label, world: null, blends: ['normal'], shown, ...extra });

test('planLayers: a world, a text host and a blend each own a layer; plain neighbours share one; a part that never shows is left out', () => {
  const children = [
    child(1, 'cold', on(10, 0, 3), { world: 'cold' }),
    child(2, 'heat', on(10, 2, 6)),
    child(3, 'vignette', on(10, 0, 10)),
    child(4, 'glow', on(10, 0, 10), { blends: ['screen'] }),
    child(5, 'camera', on(10, 1, 9)),
    child(6, 'ghost', on(10, 0, 0)),
    child(7, 'lens', on(10, 4, 8), { blends: ['normal', 'screen'] }),
    child(8, 'gl', on(10, 0, 10)),
  ];
  const { layers, skipped } = planLayers(children, new Set([5]));
  assert.deepEqual(layers.map((l) => [l.name, l.members, l.span, l.blend, l.blendVaries]), [
    ['01-world-cold', [1], [0, 3], 'normal', false],
    ['02-heat-to-vignette', [2, 3], [0, 10], 'normal', false],
    ['03-glow', [4], [0, 10], 'screen', false],
    ['04-camera', [5], [1, 9], 'normal', false],
    ['05-lens', [7], [4, 8], 'normal', true],
    ['06-gl', [8], [0, 10], 'normal', false],
  ]);
  assert.deepEqual(skipped, ['ghost']);
});

test('keyframes keep the ends of each run and every bend, and drop keys on a straight line', () => {
  assert.deepEqual(keyframes([0, 0, 0, 10, 20, 30, 30], 5), [
    { frame: 5, value: 0 }, { frame: 7, value: 0 }, { frame: 10, value: 30 }, { frame: 11, value: 30 },
  ]);
  assert.deepEqual(keyframes([[0, 0], [1, 2], [2, 4], [2, 4]]), [{ frame: 0, value: [0, 0] }, { frame: 2, value: [2, 4] }, { frame: 3, value: [2, 4] }]);
  assert.deepEqual(keyframes([7]), [{ frame: 0, value: 7 }]);
});

const sample = (opacity, x = 10, extra = {}) => ({ opacity, x, baseline: 50, scale: 1, color: [1, 1, 1], effects: false, ...extra });

test('textTrack spans the frames the text shows and keys opacity, position and colour in percent and px', () => {
  const samples = [sample(0), sample(0.5, 10), sample(1, 20), sample(1, 30, { effects: true }), sample(0)];
  const track = textTrack({ id: 'a', selector: '.a', label: 'A', at: null }, samples, { text: 'A' }, 30);
  assert.deepEqual(track.span, [1, 4]);
  assert.deepEqual(track.opacity, [{ frame: 1, value: 50 }, { frame: 2, value: 100 }, { frame: 3, value: 100 }]);
  assert.deepEqual(track.position.map((k) => k.frame), [1, 3]);
  assert.equal(track.keyFrame, 2);
  assert.deepEqual(track.effects, [{ from: 0.1, to: 0.133 }]);
  assert.equal(textTrack({ id: 'b' }, [sample(0)], {}, 30).span, null);
});

test('paintedSamples hides the frames the reference clip shows no text on', () => {
  const samples = [sample(1), sample(1), sample(1), sample(1)];
  assert.deepEqual(paintedSamples(samples, [false, true], 1).map((s) => s.opacity), [1, 0, 1, 1]);
});

test('keyFrameOf takes the template\'s second, else the first frame at full opacity', () => {
  assert.equal(keyFrameOf({ at: 0.5 }, [sample(0), sample(1)], 30), 1);
  assert.equal(keyFrameOf({ at: null }, [sample(0.2), sample(0.9), sample(0.9)], 30), 1);
  assert.deepEqual(runsOf([1, 0, 1, 1].map((v) => ({ v })), (s) => s.v, 10), [{ from: 0, to: 0.1 }, { from: 0.2, to: 0.4 }]);
});

test('template.json inputs: checked, with a fix in each refusal', () => {
  assert.deepEqual(checkInputs({ inputs: [{ id: 'head', selector: 'h1' }] }), [{ id: 'head', selector: 'h1', label: 'head', at: null }]);
  assert.throws(() => checkInputs({}), (e) => e instanceof TemplateError && /"inputs"/.test(e.message));
  assert.throws(() => checkInputs({ inputs: [{ id: 'Head', selector: 'h1' }] }), /lowercase/);
  assert.throws(() => checkInputs({ inputs: [{ id: 'a', selector: 'h1' }, { id: 'a', selector: 'p' }] }), /used twice/);
  assert.throws(() => checkInputs({ inputs: [{ id: 'a', selector: '' }] }), /selector/);
  assert.throws(() => checkInputs({ inputs: [{ id: 'a', selector: 'p', at: -1 }] }), /at must be seconds/);
});

test('layerCss: a clear ground, hidden subtrees at specificity 0, glyph-free text, and the text-only marks', () => {
  const css = layerCss({ hide: ['body > :nth-child(2)'], noText: ['.word'] });
  assert.match(css, /html, body \{ background: transparent !important; \}/);
  assert.match(css, /:where\(body > :nth-child\(2\), body > :nth-child\(2\) \*\) \{ visibility: hidden !important; \}/);
  assert.match(css, /:is\(\.word, \.word \*\) \{ color: transparent !important; -webkit-text-fill-color: transparent !important;/);
  assert.doesNotMatch(css, /data-vawe-off/);
  const only = layerCss({ hide: ['body > :nth-child(2)'], textOnly: '.word' });
  assert.match(only, /\[data-vawe-off\] \{ visibility: hidden !important; \}/);
  assert.match(only, /\[data-vawe-bare\] \{ background: none !important;/);
});

test('conventionName names a face the way font tools list it', () => {
  assert.equal(conventionName('Unbounded', 300, false), 'Unbounded-Light');
  assert.equal(conventionName('IBM Plex Mono', 400, true), 'IBMPlexMono-Italic');
  assert.equal(conventionName('Geist', 700, true), 'Geist-BoldItalic');
});

test('the README names each file, each editable text and how to open the template in each app', () => {
  const readme = templateReadme({
    name: 'demo', width: 1920, height: 1080, fps: 30, frames: 150, skipped: [], notes: ['a note'],
    layers: [{ file: '01-world-cold.mov', start: 0, end: 21, blend: 'normal' }, { file: '02-glow.mov', start: 0, end: 150, blend: 'screen' }],
    texts: [{ track: { label: 'Name', span: [30, 150], style: { text: 'onsen', size: 313, family: 'Unbounded' }, effects: [{ from: 1, to: 2 }] }, font: { name: 'Unbounded-Regular', guessed: false } }],
    audio: { mix: 'mix.wav', cues: [{}, {}] },
  });
  for (const line of ['File > Scripts > Run Script File', 'premiere/demo.xml', 'Relink others automatically', '"Name": "onsen", Unbounded-Regular at 313 px', '02-glow.mov: 0.00 s to 5.00 s, blend mode screen', 'mask or a clip shape', '(2 files, media/cue-*.wav)', '- a note']) {
    assert.ok(readme.includes(line), line);
  }
  assert.doesNotMatch(readme, new RegExp(String.fromCharCode(0x2014)), 'no em dash');
});

const hasUnzip = spawnSync('unzip', ['-v']).status === 0;

for (const zip64 of [false, true]) {
  test(`zipFolder writes a zip ${zip64 ? 'with ZIP64 records ' : ''}that unzip tests clean, with every file under the prefix`, { skip: !hasUnzip && 'no unzip on this machine' }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-zip-'));
    try {
      const src = path.join(dir, 'src');
      fs.mkdirSync(path.join(src, 'media'), { recursive: true });
      fs.writeFileSync(path.join(src, 'README.txt'), 'hello '.repeat(500));
      fs.writeFileSync(path.join(src, 'media', 'clip one.mov'), Buffer.alloc(70000, 7));
      fs.writeFileSync(path.join(src, 'media', 'mix.wav'), Buffer.from([1, 2, 3]));
      const out = path.join(dir, 'demo.zip');
      const names = zipFolder(src, out, { prefix: 'demo-template', ...(zip64 ? { zip64Limit: 16 } : {}) });
      assert.deepEqual(names, ['demo-template/README.txt', 'demo-template/media/clip one.mov', 'demo-template/media/mix.wav']);
      assert.deepEqual(listFiles(src), ['README.txt', 'media/clip one.mov', 'media/mix.wav']);
      assert.equal(fs.readFileSync(out).includes(Buffer.from([0x50, 0x4b, 0x06, 0x06])), zip64, 'the ZIP64 end record is there only when needed');
      const check = spawnSync('unzip', ['-t', out], { encoding: 'utf8' });
      assert.equal(check.status, 0, check.stdout + check.stderr);
      assert.match(check.stdout, /No errors detected/);
      const back = spawnSync('unzip', ['-p', out, 'demo-template/README.txt'], { encoding: 'utf8' });
      assert.equal(back.stdout, 'hello '.repeat(500));
      const again = path.join(dir, 'again.zip');
      zipFolder(src, again, { prefix: 'demo-template', ...(zip64 ? { zip64Limit: 16 } : {}) });
      assert.ok(fs.readFileSync(out).equals(fs.readFileSync(again)), 'the same folder gives the same bytes');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
