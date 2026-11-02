#!/usr/bin/env node
// `vawe dev <page> --animatic`: the key frame of each world held for its planned span, hard cuts, silent, so timing is checked before motion is written.
//   node harness/media/animatic.mjs <page.html> [--fps n] [--out file.mp4]
// Writes out/<film>-animatic.mp4 (half size, 10 fps by default) and prints each world's hold, the total length and the wall time.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openPage, settle, resolveFrame, ffmpegEncode, frameFormat } from './render-page.mjs';
import { shootWorlds } from './frames.mjs';
import { cutSpans } from '../lib/artboard.mjs';
import { animaticHolds } from '../lib/animatic.mjs';
import { resolveDuration } from './page-duration.mjs';

const die = (m) => { console.error(`error: ${m}`); process.exit(2); };

function parseArgs(argv) {
  const out = { fps: 10 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--fps') out.fps = Number(argv[++i]);
    else if (argv[i] === '--out') out.out = argv[++i];
    else if (argv[i].startsWith('--')) die(`unknown flag ${argv[i]}`);
    else out.page = argv[i];
  }
  if (!(out.fps > 0)) die('--fps needs a positive number');
  return out;
}

function encode(tmp, shots, holds, frame, fps, outFile) {
  const ext = frameFormat(true).ext;
  let n = 0;
  shots.forEach((s, i) => { for (let k = 0; k < holds[i].frames; k++) fs.linkSync(s.png, path.join(tmp, `f${String(n++).padStart(6, '0')}.${ext}`)); });
  const starts = Array.from({ length: n + 1 }, (_, i) => i);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const r = ffmpegEncode(tmp, fps, Array(n).fill(1), starts, outFile, { final: true, size: [frame.outWidth, frame.outHeight] });
  if (r.status !== 0 || !fs.existsSync(outFile)) die(`ffmpeg encode failed (exit ${r.status}): ${(r.stderr || '').trim().slice(0, 600)}`);
  return n;
}

const holdLine = (h) => `  ${h.id}  ${h.frames === 0 ? 'under one frame' : `${h.hold.toFixed(2)} s`}`;

async function main(argv) {
  const t0 = Date.now();
  const args = parseArgs(argv);
  if (!args.page) die('missing <page>; usage: node harness/media/animatic.mjs <page.html> [--fps n] [--out file.mp4]');
  if (!fs.existsSync(args.page)) die(`no such page: ${args.page}`);
  const abs = path.resolve(args.page);
  const film = path.basename(path.dirname(abs));
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'vawe-animatic-'));
  const frame = resolveFrame(abs, {});
  const opened = await openPage(abs, frame, { warm: true });
  let shots, frames, holds, duration, outFile;
  try {
    if (!opened.reused) {
      await opened.page.goto(opened.url, { waitUntil: 'load' });
      await settle(opened.page);
      await opened.markWarm?.();
    }
    shots = await shootWorlds(opened, abs, tmp, { ids: [], suffix: '', zoom: false, layout: false });
  } finally {
    await opened.close();
  }
  try {
    duration = await resolveDuration(abs);
    holds = animaticHolds(shots, cutSpans(shots, duration), args.fps);
    outFile = path.resolve(args.out || path.join('out', `${film}-animatic.mp4`));
    frames = encode(tmp, shots.filter((_, i) => holds[i].frames > 0), holds.filter((h) => h.frames > 0), frame, args.fps, outFile);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log([`animatic: ${outFile}`, ...holds.map(holdLine), `total: ${(frames / args.fps).toFixed(2)} s at ${args.fps} fps (page ${duration} s)`, `time: ${((Date.now() - t0) / 1000).toFixed(1)} s`].join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).catch((e) => die(e.stack || String(e)));
