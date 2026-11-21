// Fetch the FREE, openly-licensed faces the engine registers in core/tokens.css into the
// gitignored assets/fonts/. No font binary is committed to the repo (redistribution), a
// fresh clone runs `make gen X=fonts` (or `make build`) to self-heal. Söhne is paid and stays manual in
// assets/fonts/local/ (see tokens.css). Idempotent: skips files already present (--force redownloads).
//
//   node generators/media/fonts.mjs            download any missing free faces, verify every one
//   node generators/media/fonts.mjs --force    redownload everything
//   node generators/media/fonts.mjs --relock   rewrite fonts.lock.json from what is on disk
//
// Sources: Fontsource (npm, via jsDelivr). The canonical open mirror for OFL/Apache webfonts.
//
// EVERY URL CARRIES AN EXACT VERSION, AND EVERY FACE CARRIES A HASH. These used to be unversioned
// `@fontsource-variable/<pkg>/files/…` URLs, so the bytes were whatever the CDN published that day and
// two machines could hold different faces under identical filenames with nothing to tell them apart.
// That is not a theory: GeistMono.woff2 on this machine is 29896 bytes and the unversioned URL serves
// 23128 bytes today, because geist-mono shipped 5.3.0 after the file was fetched. Every text width in
// the library moves with the font set, and `snap-scenes` stamps its baselines with a hash of that set,
// so an unpinned face turns a cross-machine comparison into noise that reads as a code regression.
// The versions below are the ones the CURRENT snap baselines were saved against; the hashes are in
// harness/media/fonts.lock.json. A mismatch FAILS rather than warns, because a warning about a font is
// exactly the line a person scrolls past on the way to the gate result they came for.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEST = path.join(repoRoot, 'assets/fonts');
// The lock did NOT move with this script. `harness/media/fonts.lock.json` is where it lives, which
// the header comment above already said correctly while this line resolved beside the script instead,
// to a file that has never existed there. Anchored to repoRoot so a future move cannot re-break it.
const LOCK = path.join(repoRoot, 'harness/media/fonts.lock.json');
const FORCE = process.argv.includes('--force');
const RELOCK = process.argv.includes('--relock');
const CDN = 'https://cdn.jsdelivr.net/npm';

// dest filename (as referenced in core/tokens.css) → npm package · exact version · file in that package.
const FONTS = [
  ['InterVariable.woff2',           '@fontsource-variable/inter',               '5.3.0', 'inter-latin-wght-normal.woff2',               'OFL 1.1'],
  ['Geist.woff2',                   '@fontsource-variable/geist',               '5.3.0', 'geist-latin-wght-normal.woff2',               'OFL 1.1'],
  // 5.2.8, not 5.3.0: 5.3.0 re-subset this face and it is NOT the one the snap baselines were saved
  // against. Bump it deliberately, re-save the baselines, never as a side effect of a fetch.
  ['GeistMono.woff2',               '@fontsource-variable/geist-mono',          '5.2.8', 'geist-mono-latin-wght-normal.woff2',          'OFL 1.1'],
  ['JetBrainsMono.woff2',           '@fontsource-variable/jetbrains-mono',      '5.3.0', 'jetbrains-mono-latin-wght-normal.woff2',      'OFL 1.1'],
  // STATIC .woff INSTANCES, for the OG cards only. The vawe.dev site (vawe-hq/vawe-site) renders its share cards with
  // next/og (Satori), which needs real font BYTES and reads ttf, otf and woff but NOT woff2, which
  // is the only format the variable packages above ship. The first attempt cut static TTFs out of
  // those woff2 files with fonttools and COMMITTED them, which breaks this repo's oldest asset rule:
  // "no font binary ships from this repo, paid or not" (.gitignore:10). Fontsource's non-variable
  // packages already publish exactly these instances as .woff, so they are fetched here like every
  // other face, land in the gitignored assets/fonts/, and are vendored into the site by vawe-hq/vawe-site
  // (its vendor-assets script). Nothing is converted and nothing is committed.
  ['JetBrainsMono-400.woff',        '@fontsource/jetbrains-mono',              '5.3.0', 'jetbrains-mono-latin-400-normal.woff',        'OFL 1.1'],
  ['Archivo-800.woff',              '@fontsource/archivo',                     '5.3.0', 'archivo-latin-800-normal.woff',               'OFL 1.1'],
  ['Archivo-400.woff',              '@fontsource/archivo',                     '5.3.0', 'archivo-latin-400-normal.woff',               'OFL 1.1'],
  ['Geist-400.woff',                '@fontsource/geist',                       '5.3.0', 'geist-latin-400-normal.woff',                 'OFL 1.1'],
  ['Geist-600.woff',                '@fontsource/geist',                       '5.3.0', 'geist-latin-600-normal.woff',                 'OFL 1.1'],
  ['GeistMono-400.woff',            '@fontsource/geist-mono',                  '5.3.0', 'geist-mono-latin-400-normal.woff',            'OFL 1.1'],
  ['IBMPlexMono-400.woff',          '@fontsource/ibm-plex-mono',               '5.3.0', 'ibm-plex-mono-latin-400-normal.woff',         'OFL 1.1'],
  ['IBMPlexMono-400.woff2',         '@fontsource/ibm-plex-mono',               '5.3.0', 'ibm-plex-mono-latin-400-normal.woff2',        'OFL 1.1'],
  ['IBMPlexMono-500.woff2',         '@fontsource/ibm-plex-mono',               '5.3.0', 'ibm-plex-mono-latin-500-normal.woff2',        'OFL 1.1'],
  ['PlusJakartaSans.woff2',         '@fontsource-variable/plus-jakarta-sans',   '5.3.0', 'plus-jakarta-sans-latin-wght-normal.woff2',   'OFL 1.1'],
  ['HankenGrotesk.woff2',           '@fontsource-variable/hanken-grotesk',      '5.3.0', 'hanken-grotesk-latin-wght-normal.woff2',      'OFL 1.1'],
  ['BricolageGrotesque.woff2',      '@fontsource-variable/bricolage-grotesque', '5.3.0', 'bricolage-grotesque-latin-wght-normal.woff2', 'OFL 1.1'],
  ['Archivo.woff2',                 '@fontsource-variable/archivo',             '5.3.0', 'archivo-latin-wght-normal.woff2',             'OFL 1.1'],
  ['Unbounded.woff2',               '@fontsource-variable/unbounded',             '5.3.0', 'unbounded-latin-wght-normal.woff2',             'OFL 1.1'],
  ['Caveat.woff2',                  '@fontsource-variable/caveat',              '5.3.0', 'caveat-latin-wght-normal.woff2',              'OFL 1.1'],
  ['space-500.woff2',               '@fontsource/space-grotesk',                '5.3.0', 'space-grotesk-latin-500-normal.woff2',        'OFL 1.1'],
  ['space-700.woff2',               '@fontsource/space-grotesk',                '5.3.0', 'space-grotesk-latin-700-normal.woff2',        'OFL 1.1'],
  ['InstrumentSerif-Regular.woff2', '@fontsource/instrument-serif',             '5.3.0', 'instrument-serif-latin-400-normal.woff2',     'OFL 1.1'],
  ['InstrumentSerif-Italic.woff2',  '@fontsource/instrument-serif',             '5.3.0', 'instrument-serif-latin-400-italic.woff2',     'OFL 1.1'],
  // Anybody = the vawe landing page's real sans. Manrope + Fraunces = tpot.cc's real pair.
  ['Anybody.woff2',                 '@fontsource-variable/anybody',             '5.3.0', 'anybody-latin-wght-normal.woff2',             'OFL 1.1'],
  ['Manrope.woff2',                 '@fontsource-variable/manrope',             '5.3.0', 'manrope-latin-wght-normal.woff2',             'OFL 1.1'],
  ['BigShoulders.woff2',            '@fontsource-variable/big-shoulders',       '5.3.0', 'big-shoulders-latin-wght-normal.woff2',       'OFL 1.1'],
  ['Fraunces.woff2',                '@fontsource-variable/fraunces',            '5.3.0', 'fraunces-latin-wght-normal.woff2',            'OFL 1.1'],
];

const urlOf = (pkg, ver, file) => `${CDN}/${pkg}@${ver}/files/${file}`;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
// woff2 files start with the ASCII magic "wOF2"; woff1 starts with "wOFF". The check reads the MAGIC
// and compares it to what the destination filename claims, so a CDN serving an HTML error page or the
// wrong format under the right name is caught either way. It used to accept woff2 alone, which was
// correct until the OG cards needed static .woff instances (Satori reads woff, never woff2).
const magic = (buf) => (buf.length > 4 ? String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) : '');
const formatOk = (name, buf) => (name.endsWith('.woff2') ? magic(buf) === 'wOF2' : magic(buf) === 'wOFF');

// A MISSING LOCK IS NOT AN EMPTY LOCK. This used to swallow the read and return {}, so a wrong path
// read as "no face is locked" and every font then failed as unlocked: a stale path hidden by a silent
// catch, which is the pair of mistakes this repo logs most. --relock is the one caller allowed to
// proceed without it, because writing the lock is its whole job.
const lock = (() => {
  try { return JSON.parse(fs.readFileSync(LOCK, 'utf8')).faces || {}; } catch (err) {
    if (RELOCK) return {};
    console.error(`fonts: cannot read the lock at ${path.relative(repoRoot, LOCK)}: ${err.message}`);
    console.error('Every face would read as unlocked. Fix the path, or run --relock to write a new lock.');
    process.exit(2);
  }
})();

async function grab([name, pkg, ver, file]) {
  const dest = path.join(DEST, name);
  const want = lock[name];
  const present = fs.existsSync(dest) && fs.statSync(dest).size > 0;

  if (present && !FORCE) {
    const got = sha256(fs.readFileSync(dest));
    if (!want) return { name, status: 'unlocked', got };
    if (got !== want.sha256) return { name, status: 'mismatch', want: want.sha256, got };
    return { name, status: 'skip' };
  }

  try {
    const res = await fetch(urlOf(pkg, ver, file), { redirect: 'follow' });
    if (!res.ok) return { name, status: 'fail', why: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (!formatOk(name, buf)) return { name, status: 'fail', why: `not a ${name.endsWith('.woff2') ? 'woff2' : 'woff'} file (magic "${magic(buf)}")` };
    const got = sha256(buf);
    // The pin is only worth what the check is worth: refuse to WRITE bytes the lock does not name,
    // so a re-published version cannot enter the tree and be discovered later as 57 changed scenes.
    if (want && got !== want.sha256) return { name, status: 'mismatch', want: want.sha256, got, remote: true };
    const part = `${dest}.${process.pid}.part`;
    fs.writeFileSync(part, buf);
    fs.renameSync(part, dest);
    return { name, status: 'ok', kb: Math.round(buf.length / 1024), got };
  } catch (e) {
    return { name, status: 'fail', why: e.message };
  }
}

fs.mkdirSync(DEST, { recursive: true });

if (RELOCK) {
  const faces = {};
  const missing = [];
  for (const [name, pkg, ver, file] of FONTS) {
    const dest = path.join(DEST, name);
    if (!fs.existsSync(dest)) { missing.push(name); continue; }
    const buf = fs.readFileSync(dest);
    faces[name] = { pkg, version: ver, file, bytes: buf.length, sha256: sha256(buf) };
  }
  if (missing.length) { console.error(`✗ cannot relock: ${missing.length} face(s) absent from assets/fonts/ · ${missing.join(', ')}`); process.exit(1); }
  fs.writeFileSync(LOCK, JSON.stringify({
    _why: 'sha256 of every face `make gen X=fonts` fetches. Pinned so two machines hold identical bytes and a snap baseline means something across them. Regenerate with `node generators/media/fonts.mjs --relock` ONLY when a version bump is intended, and re-save the snap baselines in the same pass.',
    faces,
  }, null, 2) + '\n');
  console.log(`✓ relocked ${Object.keys(faces).length} faces → harness/media/fonts.lock.json`);
  process.exit(0);
}

const results = await Promise.all(FONTS.map(grab));

let ok = 0, skip = 0, fail = 0, bad = 0, unlocked = 0;
for (const r of results) {
  if (r.status === 'ok') { ok++; console.log(`  ✓ ${r.name}  (${r.kb} KB)`); }
  if (r.status === 'skip') skip++;
  if (r.status === 'unlocked') { unlocked++; console.error(`  ? ${r.name}  · present but not in fonts.lock.json (sha256 ${r.got.slice(0, 12)})`); }
  if (r.status === 'fail') { fail++; console.error(`  ✗ ${r.name}  · ${r.why}`); }
  if (r.status === 'mismatch') {
    bad++;
    console.error(`  ✗ ${r.name}, HASH MISMATCH (${r.remote ? 'downloaded bytes' : 'file on disk'})`);
    console.error(`      locked   ${r.want}`);
    console.error(`      measured ${r.got}`);
  }
}
console.log(`fonts: ${ok} downloaded, ${skip} verified, ${fail} failed, ${bad} hash-mismatched${fail || bad || unlocked ? '' : ' · all free faces ready'}`);
console.log('note: Sohne is paid (Klim) · drop your own copy in assets/fonts/local/Sohne.woff2 (gitignored).');
if (bad) {
  console.error('\nA face on this machine is NOT the one the library was measured against, so every text width\n'
    + 'is suspect and `make check GATE=snap-all` cannot tell a code change from a font change. Delete the named file\n'
    + 'and re-run `make gen X=fonts` to restore the pinned bytes. If the new bytes are the ones you MEAN to have,\n'
    + 'run `node generators/media/fonts.mjs --relock` and re-save the snap baselines in the same pass.');
}
if (fail || bad || unlocked) process.exit(1);
