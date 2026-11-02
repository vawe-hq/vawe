// quality/gates/judge.mjs: the VISION JUDGE (prep half). Static gates (validate/critique/slop/audit) can't SEE
// composition or asset fidelity; this preps exactly what a vision model must look at + the criteria, and the
// agent-in-the-loop scores it. It renders the KEY frames (each beat's mid + hook + CTA) into one labeled
// sheet and writes the rubric (the brand house-style + the craft rubric (11 dimensions + 2 checks) + a verdict template). The
// AGENT then reads judge/<name>/sheet.png against judge/<name>/rubric.md (under the scratch base) and returns a PASS/FIX verdict.
//
// Usage: node quality/gates/judge.mjs <page.html|mp4> [--vs <brand>] [--ref <ref.mp4>] [--no-measure]
//        vawe-dev judge <file> [VS=<brand>] [REF=<ref.mp4>]
//        vawe-dev judge <file> --verdict PASS|FIX [--at <seconds>] [--top-fix "<fix>"]   writes out/<film>.judge.json
// A page film (films/<name>/page.html) is judged from its render in out/. A reference (--ref, or the page's
// reference.json) makes the sheet frame-locked pairs: reference left, film right.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { writeReceipt, readReceipt } from '../../harness/lib/receipt.mjs';
import path from 'node:path';
import { scratchBase } from '../../harness/lib/scratch.mjs';
import { fileURLToPath } from 'node:url';
import { frameTile, tileGrid, tileBox, baseOf, pageRenderOf, gradeable, evenSamples } from '../../harness/lib/tile.mjs';
import { readPageMeta } from '../../harness/media/render-page.mjs';
import { referenceFor } from '../../harness/lib/motion-stamp.mjs';
import { craftRubric, structuredRubric } from './rubric.mjs';
import { gateFindings, readFindings } from '../../harness/lib/findings.mjs';
import { appendRun } from '../../harness/lib/runlog.mjs';
import { judgeEvent } from '../../harness/lib/run-events.mjs';
import { selfRecordCheck } from '../../harness/lib/judge-self-record.mjs';
import { JUDGE_CODES, isJudgeCode, parseFix } from '../../harness/lib/judge-codes.mjs';
import { structuredCriteria } from '../../harness/lib/judge-axes.mjs';
import { lintCriteriaSet } from '../../harness/lib/evidence-lint.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// sha256 of the RENDERED FILE ITSELF, not the scene JSON. receipt.mjs's own hash already covers the
// scene changing; this covers the render changing under an unchanged scene (a re-render on a fixed
// encoder, a swapped-out asset, a different worktree's `out/`). A receipt that ignores it can outlive
// the exact video it claims to have looked at, which is the stale-artefact class this repo has hit
// before. Missing/unreadable mp4 hashes to null rather than throwing: the caller already refused a
// missing render via `gradeable` before this ever runs.
const renderHashOf = (file) => { try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { return null; } };

// out/<film>.judge.json: the latest verdict, one small file `vawe check review` reads back into its header.
function writeJudgeResult(mp4, result) {
  const file = path.resolve('out', `${baseOf(mp4).replace(/-draft$/, '')}.judge.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...result, recorded: new Date().toISOString().slice(0, 10) }, null, 1));
  return file;
}

// judge.mjs is a PREP step, not a pass/fail check: its product is a rendered sheet + rubric for the
// agent to score, so there is nothing to emit under --json when it succeeds. The one real finding is
// "cannot prep" (bad usage, or a stale/missing render), which --json now has a record for.
const f = gateFindings();
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
// every occurrence of a repeated flag, in order: `--fix a@1 --fix b@2` -> ['a@1', 'b@2'].
const argAll = (k) => process.argv.reduce((acc, v, i) => (v === k ? [...acc, process.argv[i + 1]] : acc), []);

// --compare <verdict-A.json> <verdict-B.json>: a single vision judge repeats its own rating on the
// same clip only ~two times in three (Video-Bench), so one structured run alone is not the signal,
// agreement across two INDEPENDENT ones is. Diffs every criterion the two runs share and flags any
// where the scores disagree by more than 2 points. Needs no film/render/prep at all, so it runs
// before `inp` is even resolved: the two files are exactly what `structuredRubric`'s instructions
// told each judge to write.
const compareIdx = process.argv.indexOf('--compare');
if (compareIdx >= 0) {
  const [fileA, fileB] = [process.argv[compareIdx + 1], process.argv[compareIdx + 2]];
  if (!fileA || !fileB || !fs.existsSync(fileA) || !fs.existsSync(fileB)) {
    console.error('usage: node quality/gates/judge.mjs --compare <verdict-A.json> <verdict-B.json>');
    process.exit(2);
  }
  const a = JSON.parse(fs.readFileSync(fileA, 'utf8'));
  const b = JSON.parse(fs.readFileSync(fileB, 'utf8'));
  const codes = [...new Set([...Object.keys(a.criteria || {}), ...Object.keys(b.criteria || {})])].sort();
  const disagreements = codes
    .map((code) => ({ code, a: a.criteria?.[code]?.score, b: b.criteria?.[code]?.score }))
    .filter((d) => typeof d.a === 'number' && typeof d.b === 'number' && Math.abs(d.a - d.b) > 2);
  console.log(`\n  compare · run ${a.run || 'A'} (${fileA}) vs run ${b.run || 'B'} (${fileB})`);
  if (!disagreements.length) {
    console.log('  ✓ no criterion disagrees by more than 2 points');
  } else {
    for (const d of disagreements) {
      console.log(`  ⚠ ${d.code}: ${d.a} vs ${d.b} (Δ${Math.abs(d.a - d.b)})`);
      f.warn('judge-disagreement', `${d.code}: run ${a.run || 'A'} scored ${d.a}, run ${b.run || 'B'} scored ${d.b}`, { code: d.code });
    }
    console.log('  a disagreement this large means the two eyes saw different things: get a third opinion on those criteria before trusting either.');
  }
  process.exit(0);
}

const inp = process.argv[2];
if (!inp) {
  console.error('usage: node quality/gates/judge.mjs <page.html|mp4> [--vs <brand>] [--ref <ref.mp4>]');
  f.fail('judge-usage', 'usage: node quality/gates/judge.mjs <page.html|mp4> [--vs <brand>] [--ref <ref.mp4>]');
  process.exit(2);
}

const isPage = inp.endsWith('.html');
const mp4 = isPage ? pageRenderOf(inp) : inp;
// A STALE RENDER IS THE ANSWER TO THE PREVIOUS QUESTION, and it grades clean. `gradeable` asks both
// halves: is there a video, and was it made after the film was last edited.
const ready = gradeable(inp, mp4);
if (!ready.ok) {
  console.error(`✗ ${ready.why}.\n  fix: ${ready.fix}`);
  f.fail('judge-not-ready', ready.why, { fix: ready.fix });
  process.exit(1);
}
const declaredRef = isPage ? referenceFor(inp) : null;
const ref = arg('--ref', null) || (declaredRef ? path.resolve(repoRoot, declaredRef) : null);
if (ref && !fs.existsSync(ref)) { console.error(`✗ no such reference: ${ref}`); process.exit(2); }
const brand = arg('--vs', '');

// RECORD THE VERDICT (taste loop, phase 1+4). The prep run below produces the sheet and writes a
// "looked at this content" receipt. But looking is not judging: the receipt that gates `ledger-add`
// must carry the agent's actual verdict. So `--verdict PASS|FIX` records it against THIS render (the
// `gradeable` check above already refused a stale one), and PASS is the film's definition of done: the
// eye scored every frame and had nothing left to fix. FIX records that the loop is not converged, so
// the receipt does not read as done. This is the honest limit stated in the plan: the score is the
// agent's, written down, not something a script can verify, and the critic panel cross-checks it.
const verdictArg = arg('--verdict', null);
if (verdictArg) {
  const v = String(verdictArg).toUpperCase();
  if (v !== 'PASS' && v !== 'FIX') { console.error('--verdict must be PASS or FIX'); process.exit(2); }
  // A verdict may only be recorded against a sheet THIS tool actually produced for THIS cut. Without
  // this, `--verdict PASS` could be called first, with no sheet ever rendered and nothing ever looked
  // at, and ledger-add would accept it. So require a prior, non-stale prep receipt whose sheet exists on
  // disk (the prep branch below runs ffprobe + renders the frames, so a garbage mp4 cannot have produced
  // one). This cannot prove the agent LOOKED, a script never can, but it forces the real render of the
  // frames the agent is meant to score, and the critic panel cross-checks the eye.
  const prep = readReceipt('judge', inp);
  const sheet = prep.exists && prep.receipt && prep.receipt.sheet;
  if (!prep.exists || prep.stale || !sheet || !fs.existsSync(sheet)) {
    console.error(`✗ no sheet to judge${prep.exists && prep.stale ? ' for this cut (the prep is for an older edit)' : ''}. Run \`vawe-dev judge ${inp}\` first to render the key frames, LOOK at them against the rubric, then record the verdict.`);
    process.exit(1);
  }
  // The prep receipt's own render hash must still match `out/<name>.mp4` on disk RIGHT NOW: the scene
  // JSON hash alone cannot catch a re-render that changed the video without touching the JSON (a
  // reprint on a different machine, a corrupted/truncated write). Without this, `--verdict PASS` could
  // be recorded against a sheet made from a video that is no longer the one sitting in out/.
  const renderHash = renderHashOf(mp4);
  if (!renderHash || prep.receipt.renderHash !== renderHash) {
    console.error(`✗ ${mp4} has changed since the sheet was made (its content no longer matches). Re-run \`vawe-dev judge ${inp}\` first.`);
    process.exit(1);
  }
  // The judge is meant for a SEPARATE agent (guides/judge.md: "the PASS is not the author's
  // to self-record"), refused by AGENT, not merely by session: see selfRecordCheck above for why a
  // shared session does not mean a shared agent. A FIX still records, since only PASS claims the
  // independent eye agreed.
  if (v === 'PASS') {
    const { selfRecorded, thisSession } = selfRecordCheck(inp);
    if (selfRecorded) {
      console.error(`✗ refused: this PASS would be self-recorded. Session ${thisSession} both rendered ${path.basename(mp4)} and is now trying to pass it. Hand ${sheet} and its rubric to a fresh agent that did not author this film, and have it record PASS with VAWE_AGENT=<its-name> set (a subagent shares this session and process id).`);
      f.fail('judge-self-recorded', 'a PASS was attempted by the same agent that rendered this cut', { fix: 'record PASS from a separate agent' });
      process.exit(1);
    }
  }
  // --fix <code>@<beat>, repeated: the structured replacement for the free-text --fixes string
  // (guides/judge.md's own complaint: a finding written as a sentence can never become a
  // rule, because nothing parses it). Each one is a record, {code, beat}, checked against the closed
  // set in harness/lib/judge-codes.mjs so a typo cannot silently mint a new dimension. An unknown code
  // is refused here (a determinism concern), but a FIX verdict still records and the film still ships:
  // this gate asks whether the eye ran, never whether it liked what it saw.
  const rawFixes = argAll('--fix');
  const fixRecords = rawFixes.map(parseFix);
  const bad = fixRecords.find((r) => !isJudgeCode(r.code));
  if (bad) {
    console.error(`✗ "${bad.code}" is not a judge fix code. Valid codes: ${JUDGE_CODES.join(', ')}`);
    f.fail('judge-bad-code', `"${bad.code}" is not a judge fix code`, { fix: `use one of: ${JUDGE_CODES.join(', ')}` });
    process.exit(2);
  }
  for (const { code, beat } of fixRecords) f.warn(code, `beat ${beat}: flagged by the eye`, { beat });

  // Backward compatible for one release: free-text --fixes still records and still ships, and the
  // caller is told what replaces it rather than left to find --fix by reading this file.
  const fixesProse = arg('--fixes', '');
  if (fixesProse) console.error('  note: --fixes is free text and will not be parsed. Use --fix <code>@<beat> (repeated) instead.');

  writeReceipt('judge', inp, {
    verdict: v, fixes: fixRecords.length ? fixRecords : fixesProse, sheet, renderHash, mp4,
    at: new Date().toISOString().slice(0, 10),
  });
  const time = arg('--at', null), topFix = arg('--top-fix', null);
  if (v === 'FIX' && (time == null || !topFix)) console.error('  note: a FIX names one time stamp and one concrete fix: --at <seconds> --top-fix "<the fix>". Neither was fully given.');
  const resultFile = writeJudgeResult(mp4, { verdict: v, pass: v === 'PASS', time: time == null ? null : Number(time), topFix, renderHash });
  console.log(`  judge result: ${resultFile}`);
  // Logged here, and only here: this is the agent's actual verdict, written down after the eye looked,
  // never a verdict the prep step invents for itself (a judge PASS is never self-recorded).
  appendRun(inp, judgeEvent({ stage: 'manual', verdict: v }));
  const fixSummary = fixRecords.length
    ? ` (${fixRecords.map((r) => `${r.code}@${r.beat}`).join(', ')})`
    : (fixesProse ? ` (${fixesProse})` : '');
  console.log(v === 'PASS'
    ? `  ✓ judge verdict recorded: PASS. The eye is satisfied, this cut is done (record it with the judge run).`
    : `  ✓ judge verdict recorded: FIX${fixSummary}. Fix it, re-render, and re-judge before shipping. The loop is not done until the eye stops finding fixes.`);
  process.exit(0);
}

// --verdict-json <file> --run <A|B|...>: the STRUCTURED judge. Same freshness guard as --verdict (a
// prep receipt for THIS render, sheet still on disk, render hash unchanged), but the payload is JSON,
// one entry per criterion, and a criterion with no {score, evidence, t} is refused outright: a
// receipt without evidence per criterion is not a verdict, it's the same free-text problem --fixes
// had, wearing JSON. Recorded under its own stage per run (`judge-struct-<run>`) so two independent
// judges never overwrite each other's receipt.
const verdictJsonArg = arg('--verdict-json', null);
if (verdictJsonArg) {
  const run = arg('--run', null);
  if (!run) { console.error('--verdict-json needs --run <A|B|...> (which of the independent judges this is)'); process.exit(2); }
  if (!fs.existsSync(verdictJsonArg)) { console.error(`✗ no such file: ${verdictJsonArg}`); process.exit(2); }
  let payload;
  try { payload = JSON.parse(fs.readFileSync(verdictJsonArg, 'utf8')); }
  catch (e) { console.error(`✗ ${verdictJsonArg} is not valid JSON: ${e.message}`); process.exit(2); }

  const prep = readReceipt('judge', inp);
  const sheet = prep.exists && prep.receipt && prep.receipt.sheet;
  if (!prep.exists || prep.stale || !sheet || !fs.existsSync(sheet)) {
    console.error(`✗ no sheet to judge${prep.exists && prep.stale ? ' for this cut (the prep is for an older edit)' : ''}. Run \`vawe-dev judge ${inp} --struct\` first.`);
    process.exit(1);
  }
  const renderHash = renderHashOf(mp4);
  if (!renderHash || prep.receipt.renderHash !== renderHash) {
    console.error(`✗ ${mp4} has changed since the sheet was made. Re-run \`vawe-dev judge ${inp} --struct\` first.`);
    process.exit(1);
  }

  const missing = structuredCriteria().filter((c) => {
    const entry = payload.criteria && payload.criteria[c.code];
    return !entry || typeof entry.score !== 'number' || entry.score < 1 || entry.score > 5
      || typeof entry.evidence !== 'string' || !entry.evidence.trim() || typeof entry.t !== 'number';
  }).map((c) => c.code);
  if (missing.length) {
    console.error(`✗ refused: ${missing.length} criterion/criteria missing {score, evidence, t}: ${missing.join(', ')}`);
    console.error('  a receipt without evidence per criterion is not a verdict. Score every criterion and name what you SEE.');
    f.fail('judge-struct-incomplete', `${missing.length} criterion/criteria missing evidence`, { missing });
    process.exit(1);
  }
  // `overall`: this judge's own holistic 1-10 read of the cut, never averaged with the other judge's
  // (guides/judge.md still refuses to aggregate PER-DIMENSION scores across judges; this is a
  // single judge's own number, compared independently against the other run's own number). `vawe ship`
  // requires both of the two latest fresh structured runs at 7 or above (harness/lib/judge-consensus.mjs).
  const overall = payload.overall;
  if (typeof overall !== 'number' || !Number.isInteger(overall) || overall < 1 || overall > 10) {
    console.error('✗ refused: "overall" must be an integer 1-10, this judge\'s own holistic score.');
    f.fail('judge-struct-incomplete', '"overall" missing or out of range 1-10');
    process.exit(1);
  }
  // Non-empty is not the same as specific: "beat 1: readability looks fine" clears the check above and
  // says nothing a fix could act on. lintCriteriaSet asks each entry to name a real element/text plus a
  // position/size/colour/motion/timing observation, forbids echoing the criterion's own name, checks a
  // low score names an actual defect, and catches two criteria sharing one templated string.
  const labeled = Object.fromEntries(structuredCriteria()
    .filter((c) => payload.criteria[c.code])
    .map((c) => [c.code, { ...payload.criteria[c.code], label: c.label }]));
  const lintIssues = lintCriteriaSet(labeled);
  const lintCodes = Object.keys(lintIssues);
  if (lintCodes.length) {
    console.error(`✗ refused: ${lintCodes.length} criterion/criteria carry non-specific evidence:`);
    for (const code of lintCodes) console.error(`  - ${code}: ${lintIssues[code].join('; ')}`);
    console.error('  evidence must name a concrete visual observation (an element or text, plus position/size/colour/motion/timing), never filler.');
    f.fail('judge-struct-filler-evidence', `${lintCodes.length} criterion/criteria carry non-specific evidence`, { codes: lintCodes });
    process.exit(1);
  }
  const v = String(payload.verdict || '').toUpperCase();
  if (v !== 'PASS' && v !== 'FIX') { console.error('the JSON\'s "verdict" must be PASS or FIX'); process.exit(2); }
  if (v === 'PASS') {
    const { selfRecorded, thisSession } = selfRecordCheck(inp);
    if (selfRecorded) {
      console.error(`✗ refused: this PASS would be self-recorded (session ${thisSession} both rendered and is judging ${path.basename(mp4)}).`);
      f.fail('judge-self-recorded', 'a PASS was attempted by the same agent that rendered this cut');
      process.exit(1);
    }
  }
  const stage = `judge-struct-${String(run).replace(/[^A-Za-z0-9_-]/g, '')}`;
  const fixes = Array.isArray(payload.fixes) ? payload.fixes.slice(0, 5) : [];
  if (v === 'FIX' && !fixes.some((x) => x && x.fix)) {
    console.error('  note: a FIX verdict should carry "fixes": each with shot, frame, wrong, why and the exact fix. None recorded.');
  }
  writeReceipt(stage, inp, { run, verdict: v, overall, criteria: payload.criteria, fixes, sheet, renderHash, mp4, at: new Date().toISOString().slice(0, 10) });
  appendRun(inp, judgeEvent({ stage: 'struct', verdict: v, scores: { overall } }));
  const first = fixes.find((x) => x && x.fix);
  const time = first && [first.t, first.time, first.at].find((x) => typeof x === 'number');
  writeJudgeResult(mp4, { verdict: v, pass: v === 'PASS', time: time ?? null, topFix: first ? first.fix : null, overall, run, renderHash });
  console.log(`  ✓ structured verdict recorded: run ${run}, ${v}, overall ${overall}/10. Every criterion carries evidence.`);
  process.exit(0);
}

const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', mp4]).toString().trim());
const dims = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', mp4]).toString().trim().split(',').map(Number);
const landscape = dims[0] >= dims[1];
const { tw: TW, th: TH } = tileBox(landscape);

// A page has no beat table: eight even samples, plus the moment of its declared spectacle.
const pageSamples = () => {
  const s = Number(readPageMeta(inp, 'spectacle'));
  const even = evenSamples(dur, 8);
  return Number.isFinite(s) ? [...even, { i: even.length, start: s, t: s + 0.2, label: 'spectacle' }].sort((a, b) => a.t - b.t) : even;
};
const mids = isPage ? pageSamples() : evenSamples(dur);

// Per-scene directory. A bare shared judge dir wiped on every run made judging a second film
// destroyed the first, which makes comparing two cuts, the entire point of a judging campaign, impossible.
const dir = path.join(scratchBase(), 'judge', baseOf(mp4));
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const fps = (() => { const [n, d] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate', '-of', 'csv=p=0', mp4]).toString().trim().split('/').map(Number); return n / (d || 1) || 30; })();
const refDur = ref ? parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', ref]).toString().trim()) : 0;
const tileAt = (m, i) => {
  const id = String(i).padStart(2, '0');
  const label = `${m.label} f${Math.round(m.t * fps)}`;
  const film = frameTile(mp4, m.t, path.join(dir, `f${id}.png`), { tw: TW, th: TH, label: ref ? `FILM ${label}` : label });
  if (!ref) return [film];
  return [frameTile(ref, Math.min(m.t, refDur - 0.05), path.join(dir, `r${id}.png`), { tw: TW, th: TH, label: `REF ${label}` }), film];
};
const tiles = mids.flatMap(tileAt);
tileGrid(tiles, { cols: landscape ? 2 : (ref ? 4 : 3), tw: TW, th: TH, out: `${dir}/sheet.png` });

// MEASURED FINDINGS, HANDED TO THE EYE. page-check.mjs measures the page's pixel and timing defects;
// `vawe ship` already pays for it and its output never reached this rubric, so the agent scored
// against a blank card next to findings a script had already made. Reuse VAWE_FINDINGS_OUT, the
// channel every gate already writes structured records to (harness/lib/findings.mjs). Only for a
// page input: an mp4-only `judge <file>.mp4` run still preps a sheet with no measured findings.
const runFindings = (script, args) => {
  const out = path.join(dir, `.findings-${path.basename(script, '.mjs')}.json`);
  spawnSync(process.execPath, [path.join(repoRoot, script), ...args],
    { encoding: 'utf8', env: { ...process.env, VAWE_FINDINGS_OUT: out } });
  return readFindings(out) || [];
};
const measuredBy = 'quality/gates/page-check.mjs';
let measured = [];
if (isPage && !process.argv.includes('--no-measure')) measured = runFindings('quality/gates/page-check.mjs', [inp, ...(ref ? ['--ref', ref] : [])]);

// Numbers about the page's own timing, size and colour (against the reference when there is one), measured
// by code on both sides so the judge does not eyeball them. Same channel as the findings above: a child process.
let deltas = '';
if (isPage && !process.argv.includes('--no-measure')) {
  const out = path.join(dir, 'measured');
  spawnSync(process.execPath, [path.join(repoRoot, 'harness/media/see.mjs'), inp, out, '--measure', ...(ref ? ['--ref', ref] : [])], { encoding: 'utf8' });
  const file = path.join(out, 'deltas.md');
  if (fs.existsSync(file)) deltas = fs.readFileSync(file, 'utf8');
  else console.error('  ! see.mjs --measure wrote no deltas.md: the judge gets no measured deltas');
}

fs.writeFileSync(`${dir}/rubric.md`, craftRubric({
  name: path.basename(mp4), frames: tiles.length, landscape, brand, dir, findings: measured, deltas,
  reference: ref && path.relative(repoRoot, ref), measuredSource: measuredBy,
}));

// --struct: also write a STRUCTURED rubric per independent run (--runs A,B by default), whose
// required answer is JSON, one entry per criterion, split LOOK/MOTION. Two files, not one, because a
// single vision judge repeats its own rating on the same clip only ~two times in three (Video-Bench):
// the second file is what `--compare` above needs to exist at all.
if (process.argv.includes('--struct')) {
  const runs = arg('--runs', 'A,B').split(',').map((s) => s.trim()).filter(Boolean);
  fs.mkdirSync(`${dir}/verdicts`, { recursive: true });
  for (const run of runs) {
    const outFile = `${dir}/verdicts/${run}.json`;
    fs.writeFileSync(`${dir}/structured-${run}.md`, structuredRubric({
      name: path.basename(mp4), subject: inp, frames: tiles.length, landscape, dir, run, outFile,
      reference: ref && path.relative(repoRoot, ref), deltas,
    }));
  }
  console.log(`  → structured: ${runs.map((r) => `${dir}/structured-${r}.md`).join(', ')} `
    + `(${runs.length} independent run(s), LOOK + MOTION axes, JSON verdict required)`);
}

console.log(`\n  judge · ${path.basename(mp4)} · ${tiles.length} key frames · brand: ${brand || '(none)'}`);
console.log(`  → sheet:  ${dir}/sheet.png`);
console.log(`  → rubric: ${dir}/rubric.md  (house-style + 11 craft dimensions + 2 checks + verdict template)`);
console.log(`  → measured: ${measured.length} finding(s) from ${measuredBy}, folded into the rubric`);
if (ref) console.log(`  → reference: ${ref}, tiles are frame-locked pairs (REF left, FILM right)`);
console.log(`\n  AGENT: Read ${dir}/sheet.png AGAINST the rubric, score each frame per dimension, return PASS/FIX + fixes.`);
// Same contract as the beats receipt: producing the sheet for THIS scene content is the checkable
// proxy for having looked at it. Editing the scene withdraws it, which is the whole point. renderHash
// pins it to THIS render's bytes too, so `--verdict` above can refuse a video that moved under it.
writeReceipt('judge', inp, { sheet: `${dir}/sheet.png`, renderHash: renderHashOf(mp4), mp4 });
console.log(`  Be adversarial: this is the gate that SEES what validate/critique/slop/audit cannot.\n`);
