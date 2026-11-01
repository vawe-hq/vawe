import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { stillArgs, stillPath, stillProblem } from '../../harness/media/see/still-math.mjs';

const still = path.join(import.meta.dirname, '../../harness/media/still.mjs');
const run = (...args) => spawnSync(process.execPath, [still, ...args], { encoding: 'utf8' });

test('stillProblem names the argument at fault', () => {
  assert.equal(stillProblem({ source: 'a.mp4', at: '2' }), null);
  assert.match(stillProblem({ at: '2' }), /missing <page\|mp4>/);
  assert.match(stillProblem({ source: 'a.mp4' }), /missing --at/);
  assert.match(stillProblem({ source: 'a.mp4', at: 'x' }), /not a number/);
  assert.match(stillProblem({ source: 'a.mp4', at: '-1' }), /not a number/);
  assert.match(stillProblem({ source: 'a.mp4', at: '0.5,3,6' }), /takes one second.*vawe frame <page\|mp4> --at 0\.5,3,6/);
});

test('stillPath names a page by its folder and an mp4 by its file', () => {
  assert.equal(path.basename(stillPath('films/my-launch/page.html', '4.2')), 'my-launch-4.2s.png');
  assert.equal(path.basename(stillPath('out/clip.mp4', '3')), 'clip-3s.png');
});

test('still of an mp4 writes the exact frame at the file size and clamps a second past the end', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-still-'));
  const mp4 = path.join(dir, 'clip.mp4');
  const made = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=10:duration=3', '-pix_fmt', 'yuv420p', mp4]);
  assert.equal(made.status, 0);
  const png = path.join(dir, 'f.png');
  const ok = run(mp4, '--at', '1.5', '--out', png);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /640x360, the frame at 1\.5s/);
  const expected = path.join(dir, 'expected.png');
  spawnSync('ffmpeg', ['-v', 'error', '-i', mp4, '-vf', 'select=eq(n\\,15)', '-frames:v', '1', expected]);
  assert.deepEqual(fs.readFileSync(png), fs.readFileSync(expected));
  const past = run(mp4, '--at', '99', '--out', png);
  assert.equal(past.status, 0, past.stderr);
  assert.match(past.stdout, /past the last frame; the still is the last frame \(2\.9s\)/);
  assert.notEqual(run(mp4, '--out', png).status, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('still of a page writes one PNG at the final render size', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-still-page-'));
  const page = path.join(dir, 'page.html');
  fs.writeFileSync(page, '<!doctype html><html data-aspect="16:9"><head><meta charset="utf-8"><meta name="duration" content="2"><style>html,body{margin:0;background:#123456}</style></head><body data-world="a"></body></html>');
  const png = path.join(dir, 'p.png');
  const r = run(page, '--at', '1', '--out', png);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /1920x1080, the frame at 1s/);
  const head = fs.readFileSync(png);
  assert.equal(head.readUInt32BE(16), 1920);
  assert.equal(head.readUInt32BE(20), 1080);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("stillArgs puts -ss before -i for a URL and after it for a local file", () => {
  const url = stillArgs("https://x.test/a.mp4", 1.5, "o.png");
  assert.ok(url.indexOf("-ss") < url.indexOf("-i"));
  const local = stillArgs("a.mp4", 1.5, "o.png");
  assert.ok(local.indexOf("-i") < local.indexOf("-ss"));
  assert.equal(local.at(-1), "o.png");
});

test("stillPath names a URL by its file, without the query", () => {
  assert.match(stillPath("https://x.test/d/clip.mp4?sig=1", "2"), /out\/still\/clip-2s\.png$/);
});

test('still --at 0 of a page with no duration is one frame; a later --at still refuses', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-still-nodur-'));
  const page = path.join(dir, 'kit.html');
  fs.writeFileSync(page, '<!doctype html><html data-aspect="16:9"><head><meta charset="utf-8"><style>html,body{margin:0;background:#123456}</style></head><body></body></html>');
  const ok = run(page, '--at', '0', '--out', path.join(dir, 'k.png'));
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /1920x1080, the frame at 0s/);
  const late = run(page, '--at', '1', '--out', path.join(dir, 'k1.png'));
  assert.notEqual(late.status, 0);
  assert.match(late.stderr, /no <meta name="duration">/);
  fs.rmSync(dir, { recursive: true, force: true });
});
