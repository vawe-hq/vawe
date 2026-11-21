// A flat patch must decode to the colour the page painted. A player reads an untagged HD stream as
// BT.709, so every encode converts with the 709 matrix and says so in the tags. The page is
// tests/fixtures/pages/colour-patches.html: five flat stripes, rendered as a draft and as a final with
// the web copy and the ProRes master. The score is the largest 8-bit channel error at a stripe centre.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, 'harness/media/render-page.mjs');
const PAGE = path.join(ROOT, 'tests/fixtures/pages/colour-patches.html');
const W = 320, H = 180, STRIPE = W / 5;
const PATCHES = [['red', [255, 0, 0]], ['green', [0, 255, 0]], ['blue', [0, 0, 255]], ['brand blue', [0x3b, 0x82, 0xf6]], ['mid grey', [128, 128, 128]]];
const TOLERANCE = 2;

function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,profile,pix_fmt,color_space,color_primaries,color_transfer,color_range', '-of', 'json', file], { encoding: 'utf8' });
  return JSON.parse(out).streams[0];
}

function decodePatches(file) {
  const tag = probe(file).color_space;
  const matrix = tag === 'bt470bg' || tag === 'smpte170m' ? 'bt601' : 'bt709';
  const px = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-frames:v', '1', '-vf', `scale=${W}:${H}:flags=area+accurate_rnd+full_chroma_int:in_color_matrix=${matrix}:in_range=tv:out_range=pc,format=rgb24`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 24 });
  return PATCHES.map(([name, want], i) => {
    const o = ((H / 2) * W + i * STRIPE + STRIPE / 2) * 3;
    const got = [px[o], px[o + 1], px[o + 2]];
    return { name, want, got, error: Math.max(...want.map((v, c) => Math.abs(v - got[c]))) };
  });
}

function assertColour(file) {
  const t = probe(file);
  const name = path.basename(file);
  for (const key of ['color_space', 'color_primaries', 'color_transfer']) assert.equal(t[key], 'bt709', `${name} ${key}`);
  // A mov stores no range flag, and ProRes is always limited range.
  assert.ok(t.color_range === 'tv' || (name.endsWith('.mov') && t.color_range !== 'pc'), `${name} color_range ${t.color_range}`);
  const rows = decodePatches(file);
  const report = rows.map((r) => `${r.name}: want ${r.want}, got ${r.got}, error ${r.error}`).join('; ');
  assert.ok(rows.every((r) => r.error <= TOLERANCE), `${name}: ${report}`);
}

const render = (args) => execFileSync('node', [SCRIPT, PAGE, ...args, '--w', String(W), '--h', String(H), '--silent'], { encoding: 'utf8' });

test('the draft decodes to the page colours and carries bt709 tags', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-colour-'));
  try {
    const out = path.join(dir, 'draft.mp4');
    render([out, '--fps', '10']);
    assertColour(out);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the final, its web copy and the ProRes master decode to the page colours and carry bt709 tags', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-colour-'));
  try {
    const out = path.join(dir, 'final.mp4');
    render([out, '--final', '--fps', '10', '--blur', '1', '--master', 'prores']);
    const prores = path.join(dir, 'final.prores.mov');
    for (const f of [out, path.join(dir, 'final.web.mp4'), prores]) assertColour(f);
    const p = probe(prores);
    assert.equal(p.codec_name, 'prores');
    assert.equal(p.profile, 'HQ');
    assert.equal(p.pix_fmt, 'yuv422p10le');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('--master takes only prores, and only on a final', () => {
  const bad = (args) => assert.throws(() => execFileSync('node', [SCRIPT, PAGE, path.join(os.tmpdir(), 'x.mp4'), ...args], { encoding: 'utf8', stdio: 'pipe' }), /--master/);
  bad(['--final', '--master', 'dnxhr']);
  bad(['--master', 'prores']);
});
