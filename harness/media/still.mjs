#!/usr/bin/env node
// `vawe frame <page|mp4> --at <s> [--out file.png]`: one PNG at the full render size.
//   node harness/media/still.mjs films/my-launch/page.html --at 4.2
// A page renders that one frame at its final size (1920x1080 for 16:9), or at --size WxH when that has the page's aspect; an mp4 gives the exact frame at its own size.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openPage, seekAll, resolveFrame, settle, readPageMeta } from './render-page.mjs';
import { clampToLastFrame, probe } from './see-views.mjs';
import { isUrl } from '../lib/url.mjs';
import { stillArgs, stillPath, stillProblem, sizeProblem } from './see/still-math.mjs';
import { resolveDuration } from './page-duration.mjs';

const die = (m) => { console.error(`error: ${m}`); process.exit(2); };

export async function pageStill(pagePath, at, out, { final = true, size } = {}) {
  const dur = await resolveDuration(pagePath);
  const fps = Number(readPageMeta(pagePath, 'fps')) || 30;
  if (!(dur > 0) && at > 0) die(`${pagePath} has no <meta name="duration">`);
  const last = dur > 0 ? clampToLastFrame(at, dur, fps) : { t: 0, clamped: false }; // no length: a one-frame page
  const [w] = size ? size.split('x').map(Number) : [];
  const frame = resolveFrame(pagePath, { final: true, w });
  const wrongSize = size && sizeProblem(size, frame.aspect);
  if (wrongSize) die(wrongSize);
  const opened = await openPage(pagePath, frame, { warm: true, final });
  try {
    if (!opened.reused) {
      await opened.page.goto(opened.url, { waitUntil: 'load' });
      await settle(opened.page);
      await opened.markWarm?.();
    }
    await seekAll(opened.page, last.t * 1000);
    await opened.page.screenshot({ path: out });
  } finally {
    await opened.close();
  }
  const png = fs.readFileSync(out);
  const got = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
  if (size && got !== size) { fs.rmSync(out, { force: true }); die(`the screenshot is ${got}, not the ${size} asked for`); }
  return { ...last, size: got };
}

export function videoStill(mp4, at, out) {
  const { width, height, fps, dur } = probe(mp4);
  const last = clampToLastFrame(at, dur, fps);
  const n = Math.round(last.t * fps);
  // The first frame with a time at or after -ss: a quarter frame early lands on frame n and not on n + 1.
  const seek = Math.max(0, (n - 0.25) / fps);
  const r = spawnSync('ffmpeg', stillArgs(mp4, seek, out), { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(out)) die(`ffmpeg could not write frame ${n} of ${mp4}: ${String(r.stderr).trim().split('\n').slice(-2).join(' ')}`);
  return { ...last, t: +(n / fps).toFixed(3), size: `${width}x${height}` };
}

async function main(argv) {
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const valued = new Set(['--at', '--out', '--size']);
  const source = argv.find((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]));
  const at = flag('--at');
  const size = flag('--size');
  const problem = stillProblem({ source, at, size });
  if (problem) die(problem);
  if (!isUrl(source) && !fs.existsSync(source)) die(`no such file: ${source}`);
  const out = path.resolve(flag('--out') || stillPath(source, at, size));
  if (source.endsWith('.html') && path.extname(out) !== '.png') die(`a page still is a PNG: --out ${path.basename(out)} must end in .png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  let got;
  try { got = source.endsWith('.html') ? await pageStill(source, Number(at), out, { size }) : videoStill(source, Number(at), out); } catch (e) { die(e.message); }
  if (got.clamped) console.log(`note: ${at}s is past the last frame; the still is the last frame (${got.t}s)`);
  console.log(`✓ ${out}: ${got.size}, the frame at ${got.t}s`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).catch((e) => die(e.stack || String(e)));
