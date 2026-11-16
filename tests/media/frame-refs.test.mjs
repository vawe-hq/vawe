// `vawe frame` on a reference film: one resolver for a bare ref id in every mode, a window clamped to the film, every frame of a
// grid seen once, --out as a file or a folder in the same way everywhere, and --cuts of a reference read from its measured spec.
// The clip paints its own frame number as 7 black or white cells, so a pixel row of a grid cell names the frame it shows.
// Needs ffmpeg.   node --test tests/media/frame-refs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const VAWE = path.resolve('bin/vawe');
const ID = '9990001';
const FPS = 30;
const FRAMES = 90;
const W = 640, H = 360, BITS = 7, CELL = 40;
const TILE_W = 522;
const TILE_H = Math.round((TILE_W * H) / W);

function makeRefs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-refs-'));
  const refs = path.join(dir, 'refs');
  fs.mkdirSync(path.join(refs, 'spec', ID), { recursive: true });
  const mp4 = path.join(refs, `${ID}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:r=${FPS}:d=${FRAMES / FPS}`,
    '-vf', `geq=lum='if(between(Y,150,210),255*mod(floor(N/pow(2,floor(X/${CELL}))),2),0)':cb=128:cr=128`,
    '-c:v', 'libx264', '-crf', '10', '-g', '15', '-bf', '0', '-pix_fmt', 'yuv420p', mp4]);
  fs.writeFileSync(path.join(refs, 'spec', ID, 'spec.json'), JSON.stringify({
    shots: [{ t0: 0, t1: 1 }, { t0: 1, t1: 2 }, { t0: 2, t1: 3 }],
    cuts: [{ t: 1, transition: { startT: 1, type: 'cut', frames: 0 } }, { t: 2, transition: { startT: 2, type: 'cut', frames: 0 } }],
  }));
  return { dir, refs, mp4 };
}

const run = (refs, args, cwd) => spawnSync(process.execPath, [VAWE, 'frame', ...args], { encoding: 'utf8', cwd, env: { ...process.env, VAWE_REFS_DIR: refs } });

function framesOfGrid(png, cells) {
  const rows = Math.ceil(cells / 3);
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 });
  const gridW = TILE_W * 3;
  assert.equal(raw.length, gridW * rows * TILE_H, 'the grid has the size of its cells');
  const scale = TILE_W / W;
  return Array.from({ length: cells }, (_, i) => {
    const x0 = (i % 3) * TILE_W;
    const y0 = Math.floor(i / 3) * TILE_H + Math.round(180 * scale);
    let n = 0;
    for (let bit = 0; bit < BITS; bit++) if (raw[y0 * gridW + x0 + Math.round((bit * CELL + CELL / 2) * scale)] > 127) n += 2 ** bit;
    return n;
  });
}

test('a bare reference id is a film in every mode of frame', () => {
  const { dir, refs } = makeRefs();
  const out = path.join(dir, 'out');
  const still = run(refs, [ID, '--at', '1', '--out', path.join(out, 'one.png')], dir);
  assert.equal(still.status, 0, still.stderr + still.stdout);
  assert.ok(fs.existsSync(path.join(out, 'one.png')));
  const sheet = run(refs, [ID, '--at', '0.5,1.5', '--out', path.join(out, 'sheet.png')], dir);
  assert.equal(sheet.status, 0, sheet.stderr + sheet.stdout);
  assert.ok(fs.existsSync(path.join(out, 'sheet.png')));
  const moment = run(refs, [ID, '--moment', '1.5', '--out', out], dir);
  assert.equal(moment.status, 0, moment.stderr + moment.stdout);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a window past the end or before the start is moved inside the film, with one line', () => {
  const { dir, refs } = makeRefs();
  const late = run(refs, [ID, '--moment', '2.9', '--span', '1', '--out', path.join(dir, 'late')], dir);
  assert.equal(late.status, 0, late.stderr + late.stdout);
  assert.match(late.stdout, /window moved to 2\.00-3\.00 s to stay inside the film/);
  const early = run(refs, [ID, '--moment', '0.1', '--span', '1', '--out', path.join(dir, 'early')], dir);
  assert.equal(early.status, 0, early.stderr + early.stdout);
  assert.match(early.stdout, /window moved to 0\.00-1\.00 s to stay inside the film/);
  const fits = run(refs, [ID, '--moment', '1.5', '--span', '1', '--out', path.join(dir, 'fits')], dir);
  assert.doesNotMatch(fits.stdout, /window moved/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('every cell of a 30 fps grid shows its own frame', () => {
  const { dir, refs } = makeRefs();
  const out = path.join(dir, 'grids');
  const r = run(refs, [ID, '--moment', '1.5', '--span', '0.6', '--fps', '30', '--out', out], dir);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const shot = path.join(out, 'shot-1.2-1.8');
  const shown = [...framesOfGrid(path.join(shot, 'grid-01.png'), 9), ...framesOfGrid(path.join(shot, 'grid-02.png'), 9)];
  assert.deepEqual(shown, Array.from({ length: 18 }, (_, i) => 36 + i));
  fs.rmSync(dir, { recursive: true, force: true });
});
