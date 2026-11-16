#!/usr/bin/env node
// `vawe sound <file> --sfx --film <page|name> [--trim a,b] [--fade-in s] [--fade-out s] [--pitch semitones] [--gain dB | --peak dB] [--name x]`:
// trim, pitch, fade and level one sound effect into the film's assets/sfx/ as mp3, then print the <audio> line to paste.
// Pitch moves the speed with it (a rise is shorter), as a sampler does. --peak sets the loudest sample to that dBFS.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sfxFilter } from '../lib/sfx-chain.mjs';

const die = (m) => { console.error(`error: ${m}`); process.exit(2); };
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 24 });

const durationOf = (file) => {
  const d = parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout);
  if (!(d > 0)) die(`cannot read the sound file ${file}`);
  return d;
};

const peakOf = (file, filter) => {
  const r = run('ffmpeg', ['-hide_banner', '-nostdin', '-i', file, '-af', `${filter},volumedetect`, '-f', 'null', '-']);
  const m = /max_volume: (-?[\d.]+) dB/.exec(r.stderr);
  if (!m) die(`cannot measure the peak of ${file}: ${r.stderr.trim().split('\n').slice(-2).join(' ')}`);
  return Number(m[1]);
};

const filmDir = (film) => path.dirname(film.endsWith('.html') ? film : path.join('films', film, 'page.html'));

function main(argv) {
  const valued = ['--film', '--trim', '--fade-in', '--fade-out', '--pitch', '--gain', '--peak', '--name'];
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const input = argv.find((a, i) => !a.startsWith('--') && !valued.includes(argv[i - 1]));
  const usage = 'usage: bin/vawe sound <file> --sfx --film <page|name> [--trim a,b] [--fade-in s] [--fade-out s] [--pitch semitones] [--gain dB | --peak dB] [--name x]';
  if (!input || !flag('--film')) die(`missing <file> or --film; ${usage}`);
  if (!fs.existsSync(input)) die(`no such file: ${input}`);
  if (flag('--gain') !== undefined && flag('--peak') !== undefined) die('give --gain or --peak, not both');
  const num = (n, d = 0) => { const v = flag(n) === undefined ? d : Number(flag(n)); if (!Number.isFinite(v)) die(`${n} is not a number: ${flag(n)}`); return v; };
  const [from, to] = flag('--trim') ? flag('--trim').split(',').map(Number) : [0, null];
  if (flag('--trim') && !(Number.isFinite(from) && (to === null || Number.isFinite(to)))) die(`--trim is a,b in seconds, for example --trim 0.1,0.6`);
  const opts = { from, to: to ?? null, pitch: num('--pitch'), fadeIn: num('--fade-in'), fadeOut: num('--fade-out'), gain: num('--gain') };
  const dur = durationOf(input);
  let filter;
  try {
    filter = sfxFilter(opts, dur);
    if (flag('--peak') !== undefined) filter = sfxFilter({ ...opts, gain: num('--peak') - peakOf(input, filter) }, dur);
  } catch (e) { die(e.message); }
  const film = filmDir(flag('--film'));
  if (!fs.existsSync(film)) die(`no such film folder: ${film}`);
  const dir = path.join(film, 'assets', 'sfx');
  fs.mkdirSync(dir, { recursive: true });
  const name = (flag('--name') || path.basename(input, path.extname(input))).replace(/\.mp3$/, '');
  const out = path.join(dir, `${name}.mp3`);
  const r = run('ffmpeg', ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', input, '-af', filter, '-ar', '44100', '-b:a', '192k', out]);
  if (r.status !== 0) die(`ffmpeg failed: ${r.stderr.trim().split('\n').slice(-2).join(' ')}`);
  const made = durationOf(out);
  const rel = path.relative(film, out);
  console.log(`✓ ${out}: ${made.toFixed(2)} s, peak ${peakOf(out, 'anull').toFixed(1)} dBFS, filter ${filter}`);
  console.log(`<audio src="${rel}" data-on="land:#<id of the element it sounds for>"></audio>   (start: or leave: for its start or exit; data-at alone for a second with no element)`);
}

main(process.argv.slice(2));
