#!/usr/bin/env node
// `vawe sound <page.html> --at <s,s,...>` and `--waveform`: what sounds at a second, and the mix as one picture.
//   node harness/media/audio-view.mjs <page.html> --at 0.8,2.75     the tracks sounding at each second, how far into the cue, level in dB
//   node harness/media/audio-view.mjs <page.html> --waveform [--out file.png]   mixed waveform, loudness curve, world lines, a tick per cue
// The mix is rendered once into out/<film>-audio/ and reused while the page, its sound files and the synth kit are unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readTimeline } from './timeline.mjs';
import { renderMixCached } from './page-audio.mjs';
import { launchPage } from '../lib/render-harness.mjs';
import { worldAt, worldRows, cueRows } from '../lib/timeline.mjs';
import { parseSeconds, activeAt, levelDb, waveformSvg } from '../lib/audio-view.mjs';
import { isMain } from '../lib/is-main.mjs';

const RATE = 48000;
const die = (m) => { console.error(`error: ${m}`); process.exit(2); };

function decodeMono(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(RATE), '-'], { maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`cannot decode ${file}: ${String(r.stderr).trim()}`);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.byteLength));
}

function describeAt(t, { tracks, spans, duration }) {
  const hits = activeAt(tracks, t, duration);
  const head = `${t} s  world ${worldAt(spans, t) ?? 'none'}`;
  if (!hits.length) return [head, '  silence'];
  const rows = hits.map((hit) => {
    const { spec } = tracks[hit.index];
    const level = levelDb({ samples: tracks[hit.index].samples, rate: RATE, spec, hit });
    return `  ${hit.voice}${hit.role === 'music' ? ' (bed)' : ''}: ${hit.into.toFixed(2)} s into ${hit.length.toFixed(2)} s, ${level} dB`;
  });
  return [head, ...rows];
}

async function waveformPng({ mixWav, measured, read, out }) {
  const svg = waveformSvg({
    samples: decodeMono(mixWav), rate: RATE, duration: read.duration,
    worlds: worldRows(read.spans), cues: cueRows(read.specs, read.spans).filter((c) => c.role !== 'music'),
    title: `${measured.I.toFixed(1)} LUFS, ${measured.TP.toFixed(1)} dBTP (mix as written)  |  orange: cue starts, dashed: world starts`,
  });
  const { page, close } = await launchPage({ width: 1600, height: 700 });
  try {
    await page.setContent(`<body style="margin:0">${svg}</body>`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await (await page.$('svg')).screenshot({ path: out });
  } finally {
    await close();
  }
}

async function main(argv) {
  const t0 = Date.now();
  const flag = (name) => argv.indexOf(`--${name}`);
  const value = (name) => (flag(name) >= 0 ? argv[flag(name) + 1] : undefined);
  const skip = new Set([value('at'), value('out')]);
  const [pagePath] = argv.filter((a) => !a.startsWith('--') && !skip.has(a));
  if (!pagePath) die('missing <page>; usage: node harness/media/audio-view.mjs <page.html> --at <s,s,...> | --waveform');
  const waveform = flag('waveform') >= 0;
  if (!waveform && flag('at') < 0) die('give --at <s,s,...> or --waveform');
  let times = [];
  try { if (flag('at') >= 0) times = parseSeconds(value('at')); } catch (e) { die(e.message); }
  const read = await readTimeline(pagePath).catch((e) => die(e.message));
  if (!read.specs.length) die(`${pagePath} has no <audio> tag`);
  const film = path.basename(path.dirname(path.resolve(pagePath)));
  const mix = renderMixCached({ specs: read.specs, duration: read.duration, dir: path.resolve('out', `${film}-audio`) });
  const lines = [`mix as written: ${mix.measured.I.toFixed(1)} LUFS, ${mix.measured.TP.toFixed(1)} dBTP${mix.cached ? ' (mix kept from the last run)' : ''}`];
  if (times.length) {
    const tracks = mix.tracks.map((t) => ({ ...t, samples: decodeMono(t.file) }));
    for (const t of times) lines.push(...describeAt(t, { tracks, spans: read.spans, duration: read.duration }));
  }
  if (waveform) {
    const out = path.resolve(value('out') ?? path.join('out', `${film}-waveform.png`));
    await waveformPng({ mixWav: mix.mixWav, measured: mix.measured, read, out });
    lines.push(`waveform: ${out}`);
  }
  console.log([...lines, `time: ${((Date.now() - t0) / 1000).toFixed(1)} s`].join('\n'));
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).catch((e) => die(e.stack || String(e)));
