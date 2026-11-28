// harness/dev/recreation-new.mjs: the recreation starter, run by `vawe new <name> --ref <ref.mp4>`
// (env TYPE, NAME, REF, OUT_ROOT, NO_ROUND_TRIP). Measures the reference (harness/media/ref-spec.mjs),
// turns the numbers into a starter (harness/media/spec-to-page.mjs) and writes
// films/recreations/<name>/{page.html, GUIDE.md, TEXT.md, SPEC.md, spec.json, audio.m4a, reference.json, see/},
// plus build.js and one chapter-N.js per group of shots when the film is long. With env SCORE (`--score`)
// it also renders the starter and scores it against the reference on six axes (a round trip).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { specToFiles } from '../media/spec-to-page.mjs';
import { isMain } from '../lib/is-main.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const die = (msg) => { console.error(`✗ ${msg}`); process.exit(2); };
const PREFERRED_FONTS = ['Geist', 'PlusJakartaSans', 'Manrope', 'HankenGrotesk', 'ModernEra-Bold', 'Anybody', 'Archivo', 'BricolageGrotesque', 'Inter'];

function ffprobeDuration(video) {
  const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', video], { encoding: 'utf8' });
  const dur = Number(String(p.stdout).trim());
  return dur > 0 ? dur : 10;
}

function fontCandidates() {
  const have = new Set(fs.readdirSync(path.join(ROOT, 'assets/fonts')).filter((f) => f.endsWith('.woff2')).map((f) => f.slice(0, -6)));
  const found = PREFERRED_FONTS.filter((f) => have.has(f));
  return found.length ? found : ['Anybody'];
}

function extractAudio(ref, out) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', ref, '-vn', '-c:a', 'aac', '-b:a', '160k', out], { encoding: 'utf8' });
  return r.status === 0 && fs.existsSync(out);
}

function measureReference(refAbs, outDir) {
  const hasOcr = !spawnSync('tesseract', ['-version'], { encoding: 'utf8' }).error;
  const args = [path.join(ROOT, 'harness/media/ref-spec.mjs'), refAbs, '--out', outDir, ...(hasOcr ? ['--ocr'] : [])];
  const spec = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: ROOT });
  if (spec.status) die(`ref-spec.mjs failed on ${refAbs}`);
  return JSON.parse(fs.readFileSync(path.join(outDir, 'spec.json'), 'utf8'));
}

// The reference spec is already measured: hand it to the round trip as its cache, so the reference is read once.
function seedRoundTrip(outDir, refAbs) {
  const dir = path.join(outDir, 'round-trip', 'ref-spec');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(outDir, 'spec.json'), path.join(dir, 'spec.json'));
  const now = new Date(Math.max(Date.now(), fs.statSync(refAbs).mtimeMs + 1000));
  fs.utimesSync(path.join(dir, 'spec.json'), now, now);
  return path.join(outDir, 'round-trip');
}

async function roundTrip(pagePath, refAbs, outDir) {
  const { runMeasure } = await import('../media/see/compare.mjs');
  await runMeasure(pagePath, refAbs, seedRoundTrip(outDir, refAbs));
}

async function main() {
  const env = process.env;
  const type = env.TYPE || 'recreation';
  if (type !== 'recreation') die(`unknown TYPE=${type}. Only TYPE=recreation is built.`);
  const name = env.NAME;
  const ref = env.REF;
  if (!name || !ref) die('usage: vawe new <name> --ref <ref.mp4>');
  const refAbs = path.resolve(ref);
  if (!fs.existsSync(refAbs)) die(`no such reference file: ${ref}`);

  const outDir = path.join(env.OUT_ROOT ? path.resolve(env.OUT_ROOT) : path.join(ROOT, 'films/recreations'), name);
  if (fs.existsSync(outDir)) die(`${path.relative(ROOT, outDir)} already exists`);
  fs.mkdirSync(outDir, { recursive: true });

  const spec = measureReference(refAbs, outDir);
  const files = specToFiles(spec, { name, refBase: path.basename(ref), fonts: fontCandidates() });
  for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(outDir, file), text);
  if (spec.audio) extractAudio(refAbs, path.join(outDir, 'audio.m4a'));
  // reference.json: the folder's own declaration that this page is a recreation of `ref`, read by
  // render-page.mjs to refuse a FINAL render until the required motion check has passed.
  fs.writeFileSync(path.join(outDir, 'reference.json'), JSON.stringify({ ref: path.relative(ROOT, refAbs) }, null, 1) + '\n');

  const r = spawnSync(process.execPath, [path.join(ROOT, 'harness/media/see.mjs'), refAbs, path.join(outDir, 'see')], { stdio: 'inherit', cwd: ROOT });
  if (r.status) die(`see.mjs failed on ${ref}`);

  const pagePath = path.join(outDir, 'page.html');
  if (env.SCORE && !env.NO_ROUND_TRIP) await roundTrip(pagePath, refAbs, outDir);
  const relPage = path.relative(ROOT, pagePath);
  console.log(`\nGUIDE: ${path.relative(ROOT, path.join(outDir, 'GUIDE.md'))}; SPEC: ${path.relative(ROOT, path.join(outDir, 'SPEC.md'))} (edit its KEEP/CHANGE block)`);
  console.log(`${env.SCORE ? '' : 'score the starter: '}vawe critique ${relPage} --ref ${ref}`);
  return 0;
}

if (isMain(import.meta.url)) main().then((code) => process.exit(code));
export { ffprobeDuration };
