// quality/gates/threshold-provenance.mjs · does every new verdict-deciding constant name its source?
//
//   node quality/gates/threshold-provenance.mjs            ·   vawe-dev check provenance
//   node quality/gates/threshold-provenance.mjs --list     ·   every sourceless constant found
//   node quality/gates/threshold-provenance.mjs --stamp    ·   record today's sourceless count as the new ceiling
//
// WHY THIS EXISTS. A constant that names its source, converts its units and argues a choice when two
// sources disagree tells a reader whether a number is a measured fact or a guess wearing a threshold's
// clothes. A second, undocumented owner of a number (a pacing table sourced from one film doubled) once
// grew beside a documented one. Nothing stopped that from happening again in a different gate, on a
// different Tuesday. This does.
//
// THE RULE. A `const SCREAMING_SNAKE = <number>;` that this file can see being COMPARED (`<`, `>`,
// `<=`, `>=`, `===`, `!==`) or handed to a `.fail`/`.warn`/`.push` call is a verdict-deciding constant.
// It is SOURCED when a `//` comment anywhere in the file mentions its name inside a short window that
// also carries a citation: a URL, or one of the four legitimate categories this repo's threshold plan
// names (human perception, the medium, a published or cited craft source, a measured EXTERNAL
// reference). The rule is read off real, already-good code, not invented here.
//
// THE LINE BETWEEN A THRESHOLD AND A FORMULA CONSTANT. A unit conversion, a grid or tile size, a loop
// bound, a display cap, a decode sample rate for an analysis pipeline: none of these decide whether a
// FILM passes or fails, so none of them need a citation. They decide how the gate LOOKS at the film, not
// what it demands of it. `FORMULA` below is that list, one entry per name, each with the one-line
// reason it is not a quality bar, found and hand-checked during the audit this gate enforces
// during the audit. A name reaches this list by being read, not
// by looking short or boring; `SPECTACLE_MIN_BOUNDARIES` and `CAMERA_COVERAGE_FLOOR` look exactly as
// small and boring and are NOT on it, because both decide a verdict and both are tuned off this
// library's own films, which is the finding the audit exists to surface.
//
// THE RATCHET, same shape as `rung.mjs`. The sourceless count MAY FALL and MAY NEVER RISE. It is not a
// wall: the audit found roughly ninety sourceless constants already standing, and demanding a citation
// for all of them today would block every push tomorrow over a backlog nobody has triaged. What the
// ratchet enforces is the one thing worth enforcing on day one: a NEW threshold cannot arrive with no
// source and make the backlog bigger. Lower the bar as constants get real sources, with --stamp.
//
// Pure: reads gate and lib source files. No render, no network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gateFindings } from '../../harness/lib/findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RATCHET = path.join(ROOT, 'quality/baselines/threshold-provenance-ratchet.json');

const DIRS = ['quality/gates', 'harness/lib'];
// A test runner's own fixture constants are not gate thresholds. The test suite now lives under
// tests/, outside DIRS, so nothing needs excluding here any more.
const EXCLUDE_FILES = new Set();

// FORMULA constants: read and confirmed during the Task 3 audit. Each is a unit conversion, a grid or
// display size, a loop bound, a port, or a decode/downsample rate for THIS gate's own analysis, never a
// bar the film is held to. Adding a name here is the same kind of claim as a `rung` tag: it needs the
// read, not the instinct that a short name must be harmless.
const FORMULA = new Set([
  'harness/lib/frame-forensics.mjs#N',              // sample grid cell count (32*18), not a bar
  'harness/lib/resolve-range.mjs#GRID',              // 1/60s time-snap grid, a unit conversion
  'quality/gates/beat-check.mjs#STEP',               // search-loop step size
  'quality/gates/motion-split.mjs#GRID',             // grid subdivision count
  'quality/gates/motion-split.mjs#SUB',              // grid subdivision count
  'quality/gates/snap-blocks.mjs#CTX',               // diff display context lines
  'quality/gates/snap-blocks.mjs#CAP',               // diff display line cap
  'quality/gates/snap-scenes.mjs#BATCH',             // parallel batch size, a perf dial
  'quality/gates/snap-signature.mjs#UNIT_CAP',       // downsample cap for a signature diff
  'quality/gates/sweep-static.mjs#TILE',             // pixel tile grid for sampling
  'quality/gates/block-schema.mjs#PROBE',            // a probe server port number
  'quality/gates/audio-render-check.mjs#SR',         // decode sample rate for THIS gate's own analysis
  'harness/lib/worktree-landed.mjs#CAP_COMMITS',     // scope cutoff for this module's own commit-by-commit
                                                      // check; a worktree past it is reported unverified,
                                                      // never judged landed or stranded by this number
  'quality/gates/canvas-purity.mjs#THREE_TOLERANCE',  // per-channel byte slack for THIS gate's own pixel
                                                      // comparison, accounting for known GPU float-order
                                                      // variance in a `three` canvas; not a bar on the film
]);

const NUMERIC_VALUE = /^[0-9_.eE+\-*/() ]+$/;
function isNumericish(expr) {
  const e = expr.trim();
  if (NUMERIC_VALUE.test(e)) return true;
  const m = /^Math\.(round|max|min|floor|ceil)\(([^)]*)\)$/.exec(e);
  if (m) return m[2].split(',').every((p) => NUMERIC_VALUE.test(p.trim()) || /^[A-Z][A-Z0-9_]*$/.test(p.trim()));
  if (/^[0-9A-Z_.]+\s*[/*]\s*[0-9A-Z_.]+$/.test(e)) return true; // e.g. `25 / FPS`, a unit conversion
  if (/^10 \*\* \([0-9.\-/ ]+\)$/.test(e)) return true;          // dB -> linear conversions
  return false;
}

// A citation is a URL, or a name from one of the four legitimate categories
// (the provenance principle): perception, the medium, a named
// published/craft source, or "reference"/"sample" language pointing at an EXTERNAL measured bank.
// "our own films", "this library", "percentile" are deliberately absent: the plan's whole point is that
// those name the defect, not the fix.
const CITATION_KEYWORDS = [
  'http://', 'https://',
  'netflix', 'bbc', 'ssw.com',
  'reading speed', 'fixation', 'flicker fusion', 'contrast ratio',
  'frame rate', 'fps', 'safe area', 'aspect ratio', 'colour space', 'color space',
];

const CONST_RE = /^\s*(?:export\s+)?const\s+(.+);/;

function candidatesIn(rel) {
  const abs = path.join(ROOT, rel);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = CONST_RE.exec(lines[i]);
    if (!m) continue;
    for (const part of m[1].split(/,(?![^(]*\))/)) {
      const dm = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+)\s*$/.exec(part);
      if (!dm) continue;
      const [, name, valueExpr] = dm;
      if (!isNumericish(valueExpr)) continue;
      if (FORMULA.has(`${rel}#${name}`)) continue;

      const usageRe = new RegExp(`\\b${name}\\b`, 'g');
      let verdictDeciding = false;
      for (let j = 0; j < lines.length; j++) {
        if (j === i || !usageRe.test(lines[j])) continue;
        if (/[<>]=?|===|!==/.test(lines[j]) || /\.(fail|warn|push)\(/.test(lines[j])) { verdictDeciding = true; break; }
      }
      if (!verdictDeciding) continue;

      const nameRe = new RegExp(`\\b${name}\\b`);
      let cited = false;
      for (let k = 0; k < lines.length && !cited; k++) {
        const c = /^\s*\/\/(.*)$/.exec(lines[k]);
        if (!c || !nameRe.test(c[1])) continue;
        const win = [];
        for (let w = Math.max(0, k - 2); w <= Math.min(lines.length - 1, k + 4); w++) {
          const cw = /^\s*\/\/(.*)$/.exec(lines[w]);
          if (cw) win.push(cw[1]);
        }
        cited = CITATION_KEYWORDS.some((kw) => win.join(' ').toLowerCase().includes(kw));
      }

      out.push({ file: rel, line: i + 1, name, value: valueExpr.trim().slice(0, 40), cited });
    }
  }
  return out;
}

export function run() {
  const files = [];
  for (const d of DIRS) {
    for (const f of fs.readdirSync(path.join(ROOT, d))) {
      if (!f.endsWith('.mjs') || f.endsWith('.test.mjs')) continue;
      const rel = path.join(d, f);
      if (EXCLUDE_FILES.has(rel)) continue;
      files.push(rel);
    }
  }
  const candidates = files.flatMap(candidatesIn);
  const none = candidates.filter((c) => !c.cited);
  return { files, candidates, none, count: none.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const r = run();
  const list = process.argv.includes('--list');
  const f = gateFindings({ line: (rec) => rec.summary });

  if (list) {
    console.log(`── the sourceless worklist · ${r.count} verdict-deciding constant(s) with no cited source\n`);
    for (const c of r.none) console.log(`   ${c.file}:${c.line}  ${c.name} = ${c.value}`);
    console.log('\n  Each of these decides a pass/fail and cannot point to perception, the medium, a published');
    console.log('  source, or an external measured reference. Give it one, or move it to FORMULA with the read\n  that earns it.\n');
    process.exit(0);
  }

  console.log(`── threshold provenance · ${r.candidates.length} verdict-deciding constant(s) across ${r.files.length} file(s)`);
  console.log(`   ${r.candidates.length - r.count} cited · ${r.count} sourceless`);
  console.log(`\n   the sourceless worklist: node quality/gates/threshold-provenance.mjs --list`);

  const prior = (() => { try { return JSON.parse(fs.readFileSync(RATCHET, 'utf8')); } catch { return null; } })();
  if (process.argv.includes('--stamp')) {
    fs.mkdirSync(path.dirname(RATCHET), { recursive: true });
    fs.writeFileSync(RATCHET, `${JSON.stringify({ sourceless: r.count }, null, 1)}\n`);
    console.log(`\n  ✓ ratchet stamped at ${r.count} sourceless constant(s)${prior ? `, ${r.count <= prior.sourceless ? 'down' : 'UP'} from ${prior.sourceless}` : ''}\n`);
    f.emit();
  } else if (prior && r.count > prior.sourceless) {
    console.log(`\n  ⚠ ${r.count} verdict-deciding constant(s) have no cited source, up from ${prior.sourceless}. ` +
      'Cite perception, the medium, a published source, or an external measured reference, ' +
      'or move the constant to FORMULA in this gate with the one-line read that earns it. ' +
      'To accept the new count: node quality/gates/threshold-provenance.mjs --stamp');
  } else if (prior && r.count < prior.sourceless) {
    console.log(`\n  ~ ${prior.sourceless - r.count} fewer sourceless constant(s) than the ratchet allows. Lower it:`
      + ' node quality/gates/threshold-provenance.mjs --stamp');
  } else if (!prior) {
    console.log('\n  no ratchet baseline yet: node quality/gates/threshold-provenance.mjs --stamp');
  } else {
    console.log('\n  ✓ at the ratchet');
  }
  console.log('');
}
