// vawe refs list [id] | index | add <mp4-or-url> [--type product|brand] [--title t] | frames [id]: the reference films an agent
// studies and the fresh judge compares a film with (harness/lib/refs.mjs). They live in $VAWE_REFS_DIR (default ~/.vawe/refs),
// never in the repo. `frames` writes the settled full-size frames of each shot, from the 1080p copy in hd/ when there is one.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { refCard } from '../lib/ref-card.mjs';
import { addPlan, positionals, refsDir, ytDlpArgs, downscaleFilter, parseVerified, readRegistry, writeRegistry, listLines, frameManifest, readFrameManifest, frameLines, refVideo, refSharpVideo, refShots, refsEmpty, noRefsLines, FRAMES, FRAMES_MANIFEST, SHEETS, VERIFIED, TYPES } from '../lib/refs.mjs';
import { probeSize } from '../lib/frame-forensics.mjs';
import { contactSheet, durationOf, keyFrameFiles } from '../lib/contact-sheet.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const dir = refsDir();
const [action, source] = positionals(process.argv.slice(2));
const flag = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const die = (m) => { console.error(`vawe refs: ${m}`); process.exit(1); };

const videoOf = (id) => refVideo(dir, id);

function cardLines(id) {
  const spec = path.join(dir, 'spec', id, 'spec.json');
  if (!fs.existsSync(spec)) return [`card ${id}: not measured yet; bin/vawe see ${path.join(dir, `${id}.mp4`)} --spec`];
  return refCard(JSON.parse(fs.readFileSync(spec, 'utf8')), id, path.dirname(spec));
}
const specOf = (id) => (fs.existsSync(path.join(dir, 'spec', id, 'spec.json')) ? path.join('spec', id, 'spec.json') : null);

function sheetOf(id, video) {
  const rel = path.join(SHEETS, `${id}.png`);
  const out = path.join(dir, rel);
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(video).mtimeMs) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    contactSheet(video, durationOf(video), path.dirname(out), `${id}.png`);
  }
  return rel;
}

function recorded(meta, video) {
  return { ...meta, seconds: Number(durationOf(video).toFixed(1)), sheet: sheetOf(meta.id, video), spec: specOf(meta.id) };
}

function index() {
  const verified = path.join(dir, VERIFIED);
  if (!fs.existsSync(verified)) die(`no ${verified}: it names each film's title, studio, type and scope`);
  const known = parseVerified(fs.readFileSync(verified, 'utf8'));
  const kept = (readRegistry(dir) ?? []).filter((r) => !known.some((k) => k.id === r.id));
  const films = known.filter((k) => videoOf(k.id));
  for (const k of known.filter((x) => !videoOf(x.id))) console.error(`vawe refs: ${k.id} is listed but has no video in ${dir}`);
  const registry = [...films.map((k) => recorded(k, videoOf(k.id))), ...kept].sort((a, b) => a.id.localeCompare(b.id));
  writeRegistry(dir, registry);
  console.log(`indexed ${registry.length} films into ${path.join(dir, 'refs.json')}`);
}

function download(url) {
  const args = ytDlpArgs(url, dir);
  const r = spawnSync('yt-dlp', args, { encoding: 'utf8' });
  if (r.error?.code === 'ENOENT') die('yt-dlp is not installed: brew install yt-dlp');
  if (r.status !== 0) die(`yt-dlp failed: ${String(r.stderr).split('\n').filter(Boolean).slice(-2).join(' ')}\n  argv: yt-dlp ${args.join(' ')}`);
  const [file, id, title, studio] = r.stdout.trim().split('\n').at(-1).split('\t');
  downscale(file);
  return { file, id, title, studio };
}

function downscale(file) {
  const { width, height } = probeSize(file);
  const filter = downscaleFilter(width, height);
  if (!filter) return;
  const small = file.replace(/\.mp4$/, '.small.mp4');
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', filter, '-c:a', 'copy', small], { encoding: 'utf8' });
  if (r.status !== 0) die(`ffmpeg could not scale ${file} from ${width}x${height} to a short side of 1080: ${String(r.stderr).trim()}`);
  fs.renameSync(small, file);
}

function fromFile(file) {
  const dest = path.join(dir, path.basename(file));
  if (path.resolve(file) !== dest) fs.copyFileSync(file, dest);
  return { file: dest, id: path.basename(file).replace(/\.[^.]+$/, ''), title: null, studio: null };
}

function add() {
  const noMeasure = process.argv.includes('--no-measure');
  const plan = addPlan({ noMeasure });
  const type = flag('--type');
  if (type !== null && !TYPES.includes(type)) die(`--type is ${TYPES.join(' or ')}, not "${type}"; for example: vawe refs add ${source ?? '<mp4-or-url>'} --type ${TYPES[0]}`);
  if (!source) die('usage: vawe refs add <mp4-or-url> [--type product|brand] [--title t] [--no-measure]');
  fs.mkdirSync(dir, { recursive: true });
  const got = /^https?:\/\//.test(source) ? download(source) : fromFile(source);
  if (plan.includes('measure')) {
    const spec = spawnSync(process.execPath, [path.join(root, 'harness/media/ref-spec.mjs'), got.file, '--out', path.join(dir, 'spec', got.id), '--ocr'], { stdio: 'inherit' });
    if (spec.status !== 0) console.error('vawe refs: the measure failed; the film is registered without a spec');
  }
  const meta = { id: got.id, title: flag('--title') ?? got.title ?? got.id, studio: got.studio, type, inScope: true, why: null };
  const registry = (readRegistry(dir) ?? []).filter((r) => r.id !== got.id);
  writeRegistry(dir, [...registry, recorded(meta, got.file)].sort((a, b) => a.id.localeCompare(b.id)));
  console.log(`added ${got.id} (${type ?? 'no type'}) to ${path.join(dir, 'refs.json')}`);
  if (!type) console.log(`type not set: a brief picks the film by type; run vawe refs add ${source} --type ${TYPES.join('|')} to set it`);
  console.log(`video: ${got.file}`);
  if (!plan.includes('measure')) console.log(`not measured; measure it later: bin/vawe see ${got.id}`);
}

const FRAMES_PER_FILM = 8;

function frames() {
  const registry = readRegistry(dir);
  if (!registry) die(`no registry in ${dir}; run: bin/vawe refs index`);
  const films = registry.filter((r) => r.inScope && (!source || r.id === source));
  if (!films.length) die(source ? `no film ${source} in scope` : 'no film in scope');
  for (const r of films) {
    const video = refSharpVideo(dir, r.id);
    const out = path.join(dir, FRAMES, r.id);
    fs.rmSync(out, { recursive: true, force: true });
    const got = keyFrameFiles(video, durationOf(video), out, { shots: refShots(dir, r.id), count: FRAMES_PER_FILM });
    const manifest = frameManifest(r.id, got);
    fs.writeFileSync(path.join(out, FRAMES_MANIFEST), `${JSON.stringify(manifest, null, 1)}\n`);
    console.log([`${r.id}: ${got.length} frames from ${path.relative(dir, video)}, manifest ${path.join(out, FRAMES_MANIFEST)}`, ...frameLines(manifest), ...(source ? cardLines(r.id) : [])].join('\n'));
  }
}

function list() {
  if (refsEmpty(dir)) return console.log(noRefsLines(dir).join('\n'));
  const registry = readRegistry(dir);
  if (!registry) die(`no registry in ${dir}; run: bin/vawe refs index`);
  const shown = registry.filter((r) => !source || r.id === source);
  if (!shown.length) die(`no film ${source} in the registry`);
  const rows = listLines(shown);
  console.log(shown.flatMap((r, i) => [rows[i], ...(readFrameManifest(dir, r.id) ? frameLines(readFrameManifest(dir, r.id)) : []), ...(source ? cardLines(r.id) : [])]).join('\n'));
  console.log(`${registry.filter((r) => r.inScope).length} in scope of ${registry.length}, in ${dir}; a film with no frame lines needs: vawe refs frames <id>`);
}

const actions = { list, index, add, frames };
if (!actions[action]) die('usage: vawe refs list [id] | index | add <mp4-or-url> --type product|brand [--title t] | frames [id]');
actions[action]();
