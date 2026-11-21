// A player reads an untagged HD stream as BT.709, so a flat patch must decode as BT.709 to the colour the page painted.
// The score is the largest 8-bit channel error at a stripe centre of tests/fixtures/pages/colour-patches.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ffmpegEncode } from '../../harness/media/render-page.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, 'harness/media/render-page.mjs');
const PAGE = path.join(ROOT, 'tests/fixtures/pages/colour-patches.html');
const W = 320, H = 180, STRIPE = W / 5;
const PATCHES = [['red', [255, 0, 0]], ['green', [0, 255, 0]], ['blue', [0, 0, 255]], ['brand blue', [0x3b, 0x82, 0xf6]], ['mid grey', [128, 128, 128]]];
const TOLERANCE = 2;

function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=format_name:stream=codec_type,codec_name,profile,pix_fmt,color_space,color_primaries,color_transfer,color_range', '-of', 'json', file], { encoding: 'utf8' });
  const { streams, format } = JSON.parse(out);
  return { ...streams.find((s) => s.codec_type === 'video'), audio: streams.some((s) => s.codec_type === 'audio'), format: format.format_name };
}

// One pixel per stripe at row y, as RGBA after a BT.709 limited-range decode.
function decodeRow(file, y) {
  const tag = probe(file).color_space;
  const matrix = tag === 'bt470bg' || tag === 'smpte170m' ? 'bt601' : 'bt709';
  const px = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-vf', `scale=${W}:${H}:flags=area+accurate_rnd+full_chroma_int:in_color_matrix=${matrix}:in_range=tv:out_range=pc,format=rgba`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 24 });
  return PATCHES.map((_, i) => { const o = (y * W + i * STRIPE + STRIPE / 2) * 4; return [...px.subarray(o, o + 4)]; });
}

function assertColour(file, y = H / 2) {
  const t = probe(file);
  const name = path.basename(file);
  for (const key of ['color_space', 'color_primaries', 'color_transfer']) assert.equal(t[key], 'bt709', `${name} ${key}`);
  // A mov stores no range flag, and ProRes is always limited range.
  assert.ok(t.color_range === 'tv' || (name.endsWith('.mov') && t.color_range !== 'pc'), `${name} color_range ${t.color_range}`);
  const rows = decodeRow(file, y).map((got, i) => ({ name: PATCHES[i][0], want: PATCHES[i][1], got: got.slice(0, 3) }));
  const report = rows.map((r) => `${r.name}: want ${r.want}, got ${r.got}`).join('; ');
  assert.ok(rows.every((r) => r.want.every((v, c) => Math.abs(v - r.got[c]) <= TOLERANCE)), `${name}: ${report}`);
}

const render = (args) => execFileSync('node', [SCRIPT, PAGE, ...args, '--w', String(W), '--h', String(H)], { encoding: 'utf8' });

test('the draft decodes to the page colours and carries bt709 tags', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-colour-'));
  try {
    const out = path.join(dir, 'draft.mp4');
    render([out, '--fps', '10', '--silent']);
    assertColour(out);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the final, its web copy and the ProRes master decode to the page colours, carry bt709 tags and keep the sound', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-colour-'));
  try {
    const out = path.join(dir, 'final.mp4');
    const log = render([out, '--final', '--fps', '10', '--blur', '1', '--master', 'prores']);
    const prores = path.join(dir, 'final.prores.mov');
    assert.match(log, /ProRes master: .*final\.prores\.mov/);
    for (const f of [out, path.join(dir, 'final.web.mp4'), prores]) assertColour(f);
    const p = probe(prores);
    assert.deepEqual([p.codec_name, p.profile, p.pix_fmt, p.audio], ['prores', 'HQ', 'yuv422p10le', true]);
    assert.match(p.format, /mov/);
    assert.deepEqual(fs.readdirSync(dir).filter((f) => f.includes('.tmp-')), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a layer clip keeps its alpha and decodes to the page colours', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-colour-'));
  try {
    const stripe = (c) => PATCHES.map(([, v], i) => `if(lt(X,${(i + 1) * STRIPE}),${v[c]},`).join('') + `0${')'.repeat(PATCHES.length)}`;
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=c=black@0:s=${W}x${H}:d=0.1`, '-vf',
      `format=rgba,geq=r='${stripe(0)}':g='${stripe(1)}':b='${stripe(2)}':a='if(lt(Y,${H / 2}),255,128)'`, '-frames:v', '1', path.join(dir, 'f000000.png')]);
    const out = path.join(dir, 'layer.mov');
    const r = ffmpegEncode(dir, 10, [1], [0, 1], out, { final: true, alpha: true });
    assert.equal(r.status, 0, r.stderr);
    const p = probe(out);
    assert.deepEqual([p.codec_name, p.profile], ['prores', '4444']);
    assertColour(out, H / 4);
    for (const [, , , a] of decodeRow(out, (3 * H) / 4)) assert.ok(Math.abs(a - 128) <= TOLERANCE, `half alpha decoded as ${a}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('--master takes only prores, and only on a final', () => {
  const run = (args) => spawnSync('node', [SCRIPT, PAGE, path.join(os.tmpdir(), 'x.mp4'), ...args], { encoding: 'utf8' });
  const unknown = run(['--final', '--master', 'dnxhr']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown --master dnxhr; valid: prores/);
  const draft = run(['--master', 'prores']);
  assert.equal(draft.status, 2);
  assert.match(draft.stderr, /--master needs --final/);
});
