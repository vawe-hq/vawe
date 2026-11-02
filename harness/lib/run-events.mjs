// The four events of out/<film>.runs.jsonl, one per step of the loop. Each builder returns the
// fields that harness/lib/runlog.mjs appendRun adds after the common ones (at, film, agent, model, git).
import { acceptanceCounts } from './acceptance.mjs';
import { PARAMS_ENV, aspectOverride } from './page-params.mjs';

const tenths = (s) => Math.round(s * 10) / 10;
// The page options of the render (--param, --aspect), so `vawe-dev runs` tells the looks and aspects of one page apart.
const paramsField = (env = process.env) => ({ ...(env[PARAMS_ENV] ? { params: env[PARAMS_ENV] } : {}), ...(aspectOverride(env) ? { aspect: aspectOverride(env) } : {}) });

/** `vawe new`: which details the ask answered and which the brief guessed, and the signature dial ranges offered ({ dial, range }) with any chosen values. */
export const newEvent = ({ template, length, answered, guessed, ranges = [], chosen = {} }) => ({
  cmd: 'new', template: template ?? null, length: length ?? null, answered: [...answered], guessed: [...guessed],
  signature: { offered: Object.fromEntries(ranges.map((d) => [d.dial, d.range])), chosen },
});

/** The seconds of `phases` (start, slot, chrome, load, prepass, capture, verify, encode, audio) and of the checks, with `otherS` the wall time none of them cover. The `sheet` check is the key-frame sheet written after the render. */
const phaseFields = (wallS, phases, checks) => {
  const sheet = checks.filter(([name]) => name === 'sheet').reduce((a, [, s]) => a + s, 0);
  const checksTotal = checks.reduce((a, [, s]) => a + s, 0) - sheet;
  const covered = Object.values(phases).reduce((a, s) => a + s, 0) + checksTotal + sheet;
  return {
    startS: tenths(phases.start), slotS: tenths(phases.slot), chromeS: tenths(phases.chrome), loadS: tenths(phases.load), prepassS: tenths(phases.prepass),
    captureS: tenths(phases.capture), verifyS: tenths(phases.verify), encodeS: tenths(phases.encode), audioS: tenths(phases.audio),
    checksTotalS: tenths(checksTotal), sheetS: tenths(sheet), otherS: tenths(wallS - covered),
  };
};

/** `vawe dev`: the seconds of every phase (phaseFields) beside the wall time, what was rendered (`shape`: chrome 'launched' or 'reused', frames, reused, fps, width, height, workers, slices, durS), the check seconds by name, the tier and cache use, the acceptance rows (null for a window), the chosen signature dials, what the moves measured for them, and the rules the draft fired ({ id, value, t }). */
export const devEvent = ({ file, tier, wallS, phases, shape, checks, cache, rows, signature = {}, measured = {}, fired = [], worlds = null }) => ({
  cmd: 'dev', file, ...(process.env.VAWE_PLAN_WINDOW ? { planWindow: true } : {}), ...paramsField(), tier, wallS: tenths(wallS), ...phaseFields(wallS, phases, checks),
  chrome: shape.chrome, frames: shape.frames, reusedFrames: shape.reused, fps: shape.fps, width: shape.width, height: shape.height,
  workers: shape.workers, slices: shape.slices, durS: tenths(shape.durS),
  checksS: Object.fromEntries(checks.map(([name, s]) => [name, tenths(s)])),
  cache, acceptance: rows ? acceptanceCounts(rows) : null,
  signature, measured, rules_fired: fired, worlds: worlds?.length ? worlds : null,
});

/** A `vawe dev` that failed or was killed: `reason` is the first error line or the signal; no checks ran. */
export const devFailedEvent = ({ reason, wallS }) => ({ cmd: 'dev', failed: true, reason, wallS: tenths(wallS) });

const scoreTotal = (scores) => { const v = Object.values(scores ?? {}).filter(Number.isFinite); return v.length > 1 ? v.reduce((a, b) => a + b, 0) : null; };

/** A judge run: `stage` is stills, draft, final, manual or struct; `ledger` is mergeLedger counts; `bar` is the side-by-side answers as [{ ref, dial, winner }] (judge-bar.mjs barEvent); `findings` is { notes: [{ rule, t, verdict }], waivers: [{ code, earned }], sameness, template } (judge-findings.mjs findingsEvent). `pageHash` is the digest of the page a fresh judge read (the ship gate reads it). */
export const judgeEvent = ({ stage, verdict, scores = null, anchor = null, bar = null, ledger = null, seconds = null, findings = null, pageHash = null }) => ({
  cmd: 'judge', stage, verdict, scores, total: scoreTotal(scores),
  ...(pageHash ? { pageHash } : {}),
  anchorYes: anchor ? anchor.filter((a) => a.yes).length : null,
  anchorTotal: anchor ? anchor.length : null,
  bar, ledger, seconds,
  notes: findings?.notes ?? null, waivers: findings?.waivers ?? null, sameness: findings?.sameness ?? null, template: findings?.template ?? null,
});

/** A final render: `verdict` PASS, FIX, failed, or null when no judge ran; `acceptance` as acceptanceCounts. A failed one also records `failedAt` (percent of subframes captured), `reason` and `page`. */
export const shipEvent = ({ verdict, renderS, acceptance, failure = null }) => ({
  cmd: 'ship', ...paramsField(), verdict: verdict ?? null, renderS: tenths(renderS), acceptance: acceptance ?? null,
  ...(failure ? { failedAt: failure.pct, reason: failure.reason, page: failure.page } : {}),
});

/** The owner's verdict on a draft (`/vawe-approve`): `verdict` is approve or reject, `draft` the draft path and `draftMtime` its mtime (ISO) when it exists, `step` is plan or draft, `pageHash` the page digest at that moment. */
export const approveEvent = ({ verdict, note = null, step = 'draft', draft = null, draftMtime = null, pageHash }) => ({
  cmd: 'approve', verdict, step, note, draft, draftMtime, pageHash,
});
