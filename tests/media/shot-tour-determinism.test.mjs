// tests/media/shot-tour-determinism.test.mjs: `vawe new --from-url --tour` on a fixture page, run twice. Launches Chrome and ffmpeg.
//   node tests/media/shot-tour-determinism.test.mjs
// The two mp4 hold the same frame hashes, so a frame depends on its second alone: the hover transition, the looping
// animation and the scroll all ran at the time of the frame, not at the time of the screenshot.
// The plain shot of a smooth-scrolling page starts at the top (the first-screen capture used to start mid-page).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOT = path.join(ROOT, 'harness/media/shot.mjs');
const PAGE = path.join(ROOT, 'tests/fixtures/tour/tour-hover.html');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-tour-'));
const assert = (cond, msg) => { if (!cond) throw new Error(`FAIL: ${msg}`); };

const steps = path.join(tmp, 'steps.json');
fs.writeFileSync(steps, JSON.stringify({ dur: 2.4, cursor: [300, 200], steps: [
  { t: 0.2, move: '#card', dur: 0.4 },
  { t: 1.0, click: '#card' },
  { t: 1.4, scrollTo: '#low', dur: 0.6, offset: 20 },
] }));

const tour = (name) => {
  const out = path.join(tmp, name);
  execFileSync('node', [SHOT, PAGE, '--tour', steps, '--w', '320', '--fps', '10', '--out', out], { encoding: 'utf8' });
  return out;
};
const hashes = (mp4) => execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'framemd5', '-'], { encoding: 'utf8' })
  .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(',').pop().trim());

try {
  const [a, b] = [hashes(tour('a.mp4')), hashes(tour('b.mp4'))];
  assert(a.length === 24, `24 frames expected, got ${a.length}`);
  assert(a.join() === b.join(), 'two runs of one tour gave different frames');
  assert(new Set(a).size > 12, `the tour barely moves: ${new Set(a).size} different frames of 24`);

  const bad = path.join(tmp, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ cursor: [300, 200], steps: [{ t: 0.5, click: '#card' }] }));
  const r = spawnSync('node', [SHOT, PAGE, '--tour', bad, '--w', '320', '--fps', '10', '--out', path.join(tmp, 'c.mp4')], { encoding: 'utf8' });
  assert(r.status !== 0 && /outside the element; add a move step/.test(r.stderr), `a click away from its element must fail loudly: ${r.stderr}`);

  const png = path.join(tmp, 'first');
  execFileSync('node', [SHOT, PAGE, '--w', '400', '--out', png], { encoding: 'utf8' });
  const pixel = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(png, 'tour-tour-hover-400.png'), '-vf', 'crop=1:1:80:60', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: null });
  assert(pixel[0] === 0x33 && pixel[2] === 0x77, `the first screen must start at the top of a smooth-scrolling page: pixel ${[...pixel]}`);
  console.log('shot --tour determinism: ok');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
