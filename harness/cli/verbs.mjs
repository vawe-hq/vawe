// The verb table for bin/vawe. Each verb names the script it forwards to and the one command to run next.
// build() returns the steps to run in order; a step is { script, args, env }.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError } from './parse.mjs';
import { opt, pageName, PAGE, ASPECT, ASPECT_FLAG, PARAM } from './helpers.mjs';
import { FRAME } from './frame.mjs';
import { causeOf } from '../lib/verb-log.mjs';

import { atProblem } from '../media/see/at-problem.mjs';
import { parseTargets, shotProblem } from '../media/shot-math.mjs';
import { seeProblem } from '../media/see/one-math.mjs';
import { filmKey, freshImages, summaryLines } from '../lib/critique-summary.mjs';
import { readFindings } from '../lib/findings.mjs';
import { scratch } from '../lib/scratch.mjs';
import { refsDir, refsEmpty } from '../lib/refs.mjs';
import { isClipDemo } from '../lib/clip-demo.mjs';
import { planWindow } from '../lib/dev-window.mjs';
import { SAY, WAIT_WORK, nextStep } from '../live/stage-say.mjs';
import { critiqueProblem, critiqueCommand, critiqueFreshCommand } from '../lib/critique-gate.mjs';
export { commitsBehind } from '../lib/stale-checkout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Chrome on macOS prints these to stderr on every launch; they mean nothing for a render.
const CHROME_NOISE = [/task_policy_set/, /CVDisplayLinkCreateWithCGDisplay/];

/** `text` without the known Chrome noise lines. Pure. */
export const stripChromeNoise = (text) => String(text).split('\n').filter((l) => !CHROME_NOISE.some((re) => re.test(l))).join('\n');

/** The sentence for an unknown verb on a checkout that lags main, or '' when it does not. Pure. */
export const staleNote = (behind) => (behind > 0 ? `this checkout is ${behind} commit${behind === 1 ? '' : 's'} behind main: the verb may exist there (git pull or rebase on main)` : '');

export const devFix = (reason, [page]) => {
  if (/render slot|Navigation timeout/i.test(reason)) return `bin/vawe wait ${page}`;
  if (causeOf(reason) === 'browser lost') return `the browser died mid-render: find the heavy second with bin/vawe dev ${page} --from 0 --to 4, then the next 4 s; a page with large images, canvas or WebGL work per frame crashes it`;
  return `bin/vawe frame ${page} --world all`;
};
/** The steps of `dev --animatic` or `dev --studio`, or null for a draft. */
function devModeSteps(v, page) {
  if (v.animatic && v.studio) throw new UsageError('--animatic and --studio are two modes of dev: run one');
  if (v.fps !== undefined && !v.animatic) throw new UsageError('--fps needs --animatic');
  if (v.port !== undefined && !v.studio) throw new UsageError('--port needs --studio');
  if (v.animatic) return [{ script: 'harness/media/animatic.mjs', args: [page, ...opt('--fps', v.fps), ...opt('--out', v.out)] }];
  if (v.studio) return [{ script: 'studio/page-server.mjs', args: [page], env: v.port ? { PORT: String(v.port) } : {} }];
  return null;
}
const devNext = (v, [page]) => {
  if (v.animatic) return 'Watch the mp4: each world holds for its planned time; retime the world starts in the page, then bin/vawe dev';
  if (v.studio) return null;
  if (isClipDemo(page)) return nextStep(path.resolve(page), ROOT).next;
  if (v.from != null || v.to != null) return `bin/vawe frame ${page} --moment <the second you fixed> and Read it; when every named second is fixed: ${SAY.critique(pageName(page), page)}`;
  if (critiqueProblem(page, { root: ROOT })) return `before anything else: ${critiqueFreshCommand(page)} (its own session), or in a separate terminal ${critiqueCommand(page)}`;
  const state = nextStep(path.resolve(page), ROOT);
  if (state.stage === 'draft') return SAY.motion(pageName(page), page);
  return state.stage === 'motion' && !/Motion pass/.test(state.why) ? state.next : `${state.next} (${state.why})`;
};
const readFresh = (file, sinceMs) => (fs.existsSync(file) && fs.statSync(file).mtimeMs >= sinceMs ? readFindings(file) || [] : []);
const critiqueFindingsFile = (page) => path.join(scratch('critique', filmKey(page)), 'findings.json');
function seeSpec(v, film) {
  const specOnly = ['fps', 'elements', 'fast'].find((f) => v[f] !== undefined);
  if (specOnly && !v.spec) throw new UsageError(`--${specOnly} needs --spec`);
  if (!film.endsWith('.mp4')) throw new UsageError('--spec measures a reference mp4: usage: vawe see <ref.mp4> --spec');
  return [{ script: 'harness/media/ref-spec.mjs', args: [film, ...opt('--out', v.out), ...opt('--fps', v.fps), ...opt('--elements', v.elements), ...(v['no-ocr'] ? [] : ['--ocr']), ...(v.fast ? ['--fast'] : []), ...(v['no-cache'] ? ['--no-cache'] : [])] }];
}

function seeProbe(v, film) {
  if (!film.endsWith('.html')) throw new UsageError('--probe reads a page: usage: vawe see <page> --probe --sel <css> --at <s>');
  if (!v.sel) throw new UsageError('--probe needs --sel <css>, the elements to read: vawe see <page> --probe --sel ".card" --at 2.4');
  const problem = atProblem(v.at ?? '0');
  if (problem) throw new UsageError(problem);
  return [{ script: 'harness/media/see.mjs', args: [film, '--probe', '--sel', v.sel, ...opt('--at', v.at)] }];
}

function seePage(v, film) {
  const flag = v.plan ? '--plan' : '--sync-brief';
  if (!film.endsWith('.html')) throw new UsageError(`${flag} reads a page: usage: vawe see <page> ${flag}${v.plan ? ' [--json]' : ''}`);
  return v.plan ? [{ script: 'harness/media/timeline.mjs', args: [film, ...(v.json ? ['--json'] : [])] }] : [{ script: 'harness/media/spec-sync.mjs', args: [film] }];
}

const SITE_FLAGS = ['w', 'full', 'base', 'tour', 'fps', 'scale', 'out'];

/** The shot step of `new --from-url`: PNGs of the site (or the tour mp4) into the film's assets, or into out/shot when no film is named. Throws a UsageError for a bad argument. */
export function siteStep(v, name) {
  const problem = shotProblem({ targets: parseTargets(v['from-url']), w: v.w, base: v.base, tour: v.tour, fps: v.fps, scale: v.scale });
  if (problem) throw new UsageError(problem);
  const out = v.out ?? (name ? `films/${name}/assets/${v.tour ? 'tour.mp4' : 'site'}` : undefined);
  return { where: out ?? 'out/shot', script: 'harness/media/shot.mjs', args: [v['from-url'], ...opt('--w', v.w), ...(v.full ? ['--full'] : []), ...opt('--base', v.base), ...opt('--out', out), ...opt('--tour', v.tour), ...(v.tour ? [...opt('--fps', v.fps), ...opt('--scale', v.scale)] : [])] };
}

function newSteps(v, [name]) {
  const siteFlag = SITE_FLAGS.find((f) => v[f] !== undefined);
  if (siteFlag && !v['from-url']) throw new UsageError(`--${siteFlag} needs --from-url`);
  if (v.ref && v['from-url']) throw new UsageError('--ref recreates an mp4 and --from-url captures a website: run one');
  const site = v['from-url'] ? siteStep(v, name) : null;
  if (!name && !site) throw new UsageError('missing <name>; usage: vawe new <name> [flags], or vawe new --from-url <route|url|page.html>');
  if (v.ref) return [{ script: 'harness/dev/recreation-new.mjs', args: [], env: { TYPE: 'recreation', NAME: name, REF: v.ref, ...(v.score ? { SCORE: '1' } : {}) } }];
  return name ? null : [site];
}

export const VERBS = [
  {
    tier: 'core',
    name: 'new', summary: 'use when you start a film, recreate a reference mp4 or capture a website: writes page.html and brief.md, asks for missing facts first',
    positional: [{ name: 'name', help: 'film name, lowercase with dashes; left out with --from-url, the captures go to out/shot and no film is written' }],
    flags: [
      { name: 'from', type: 'path', default: 'the guides/ROUTING.md row that --request, the name and --length point at; a sting when none does', help: 'prompts/<template>.md whose inputs section becomes brief.md', kind: 'file' },
      { name: 'request', type: 'string', help: 'the ask in its own words: picks the template when --from is absent, and goes into brief.md' },
      { name: 'answers', type: 'path', help: 'a markdown or `key: value` file with the details the request leaves open (subject, message, show, format, assets, ending)', kind: 'file' },
      { name: 'detail', type: 'string', repeat: true, help: 'one answer as key=value, repeatable; same keys as --answers' },
      { name: 'defaults', type: 'bool', help: 'unattended run: guess every open detail, marked (guess: change me), instead of printing the questions' },
      { name: 'questions-json', type: 'bool', help: 'print the open details as AskUserQuestion calls (JSON, at most 4 questions each) and write nothing' },
      { name: 'ref', type: 'path', help: 'recreate this reference mp4: writes films/recreations/<name> with SPEC.md', kind: 'file' },
      { name: 'length', type: 'number', help: 'film length in seconds: written to brief.md and the page duration meta' },
      { name: 'aspect', type: 'string', help: 'a W:H ratio of whole numbers (16:9 9:16 1:1 4:5 4:3 are the common ones): written to brief.md and the page aspect meta' },
      { name: 'title', type: 'string', help: 'the starter headline: written to brief.md and the page' },
      { name: 'score', type: 'bool', help: 'with --ref: also render the starter and score it against the reference (slow)' },
      { name: 'from-url', type: 'string', help: 'the website the film shows, or a route (/blog) or a static .html file, a comma list shoots each: with a name, the film is started from prompts/brand-launch-from-url.md and the PNGs of the site go to films/<name>/assets/site/ (an existing film gets only the captures); without a name, only the PNGs, to out/shot' },
      { name: 'w', type: 'string', default: '1440,390', help: 'with --from-url: comma list of viewport widths' },
      { name: 'full', type: 'bool', help: 'with --from-url: the whole page height, not the first screen' },
      { name: 'base', type: 'string', default: 'http://localhost:3080', help: 'with --from-url: the site server for routes; a localhost one that is down is started and stopped by this verb' },
      { name: 'tour', type: 'path', help: 'with --from-url: a steps file (JSON list of { t, move | click | scrollTo | scroll, dur }, see harness/media/tour-math.mjs): drives a drawn macOS cursor with real mouse events through one route or url, at a 16:9 viewport of the first --w, and writes an mp4 to films/<name>/assets/tour.mp4' },
      { name: 'fps', type: 'number', default: 60, help: 'with --tour: the frame rate of the mp4' },
      { name: 'scale', type: 'number', default: 1, help: 'with --tour: the device scale factor (3 gives a 3840 by 2160 mp4 of a 1280 wide page, sharp enough for a macro close-up)' },
      { name: 'out', type: 'path', help: 'with --from-url: the folder for the PNGs, named <route>-<width>.png, or with --tour the mp4 file; overrides the places named above' },
    ],
    example: 'vawe new my-launch --from prompts/story-explainer.md   |   vawe new acme-launch --request "a launch film for acme" --from-url https://acme.com --full   |   vawe new --from-url /,/blog --full   |   vawe new acme-tour --from-url https://acme.com/app --tour tour.json --w 1600',
    build: newSteps,
    next: (v) => (v['from-url'] ? (v.tour ? 'play the mp4 in a film page (prompts/moves/demo/mask-rise.html); vawe frame <film mp4> reads it' : 'Read each PNG at full size; the 390 one shows the phone layout; vawe check links crawls every link of the site') : null),
  },
  {
    tier: 'core',
    name: 'see', summary: 'use when you read a film, page or reference as numbers (shots, motion, light, type, sound); --vs, --plan, --probe, --spec',
    positional: [{ name: 'film', required: true, help: 'a rendered mp4, a page (its draft is rendered first when missing or older than the page), or a reference id from vawe refs list' }],
    flags: [
      { name: 'vs', type: 'string', help: 'a second film (same kinds as <film>), usually the reference: both are read, with a delta per measure, one advice line per delta and paired images of the same moment' },
      { name: 'at', type: 'string', help: 'a moment: adds its native frame, a strip, an onion and an edge zoom (with --vs, the same moment of both)' },
      { name: 'at-b', type: 'string', help: 'with --vs and --at: the second of the second film' },
      { name: 'from', type: 'string', help: 'start second: shots before it are left out of the report and the images' },
      { name: 'to', type: 'string', help: 'end second: shots after it are left out of the report and the images' },
      { name: 'draft', type: 'path', help: 'for a page: read this mp4 as its draft instead of out/<name>-draft.mp4', kind: 'file' },
      { name: 'out', type: 'path', default: 'out/see/<name>', help: 'folder for see.md, see.json and the images' },
      { name: 'no-ocr', type: 'bool', help: 'skip reading the words (OCR runs by default when tesseract is installed)' },
      { name: 'no-cache', type: 'bool', help: 'measure again even if this film and the code were measured before (the result is cached by content hash)' },
      { name: 'spec', type: 'bool', help: 'a reference mp4 only, nothing else is read: measure it into SPEC.md and spec.json (with --out, --no-ocr, --no-cache, --fps, --elements, --fast)' },
      { name: 'fps', type: 'number', default: 'the video rate', help: 'with --spec: frame rate for the tables' },
      { name: 'elements', type: 'number', default: 6, help: 'with --spec: moving elements to track' },
      { name: 'fast', type: 'bool', help: 'with --spec: half the analysis width and OCR samples, for iteration' },
      { name: 'probe', type: 'bool', help: 'a page only, nothing else is read: print the box, opacity, transform, filter and animation progress of every element matching --sel at --at; use it instead of a throwaway page.evaluate script' },
      { name: 'sel', type: 'string', help: 'with --probe: the CSS selector of the elements to read' },
      { name: 'plan', type: 'bool', help: 'a page only, nothing else is read: no render, the worlds, the cut rhythm, the spectacle and every audio cue as text (3 s)' },
      { name: 'json', type: 'bool', help: 'with --plan: print the same data as JSON' },
      { name: 'sync-brief', type: 'bool', help: 'a page only, nothing else is read: write the times the last draft measured into the brief\'s Words and Objects tables (after you retimed on purpose)' },
    ],
    example: 'vawe see out/my-launch.mp4   |   vawe see films/my-launch/page.html --vs <ref-id>   |   vawe see <ref-id> --at 2.4   |   vawe see refs/ad.mp4 --spec',
    build: (v, [film]) => {
      if (v.json && !v.plan) throw new UsageError('--json needs --plan');
      if (v.sel && !v.probe) throw new UsageError('--sel needs --probe');
      if (v.spec || ['fps', 'elements', 'fast'].some((f) => v[f] !== undefined)) return seeSpec(v, film);
      if (v.probe) return seeProbe(v, film);
      if (v.plan || v['sync-brief']) return seePage(v, film);
      const problem = seeProblem({ at: v.at, atB: v['at-b'], from: v.from, to: v.to, vs: v.vs });
      if (problem) throw new UsageError(problem);
      return [{ script: 'harness/media/see/one.mjs', args: [film, ...opt('--vs', v.vs), ...opt('--at', v.at), ...opt('--at-b', v['at-b']), ...opt('--from', v.from), ...opt('--to', v.to), ...opt('--draft', v.draft), ...opt('--out', v.out), ...(v['no-ocr'] ? ['--no-ocr'] : []), ...(v['no-cache'] ? ['--no-cache'] : [])] }];
    },
    next: (v, [film]) => (v.plan ? `fix a flagged rhythm or a cue in the wrong world, then bin/vawe sound ${film} --waveform to check each sound on its event` : v.probe ? 'compare the numbers with the move you meant; vawe frame <page> --moment <s> shows the frames through that second' : v.spec ? 'mark every SPEC.md line KEEP or CHANGE, then vawe new <name> and rebuild' : v['sync-brief'] ? `bin/vawe dev ${film}; the changed cells end in *` : v.vs ? 'Read see.md, then every image path in it at full size, each with the numbers under it; act on the advice lines (each names the page literal), then vawe see again' : 'Read see.md, then every image path in it at full size, each with the numbers under it; vawe see <film> --vs <ref id> puts a reference beside it'),
  },
  FRAME,
  {
    tier: 'core',
    name: 'footage', summary: 'use when the film holds your own clips: add makes seekable proxies in films/<film>/footage/, log writes footage.md (shots, contact sheet, transcript)',
    positional: [{ name: 'action', required: true, help: 'add (clips or folders into proxies) or log (footage.md)' }, { name: 'film', required: true, help: 'film name or films/<name> folder' }],
    rest: true,
    flags: [{ name: 'full', type: 'bool', help: 'with add: keep up to 3840 wide (2160 high for a portrait clip) instead of 1920 by 1080' }],
    example: 'vawe footage add my-film ~/Movies/trip/   |   vawe footage log my-film',
    build: (v, [action, film, ...clips]) => {
      if (!['add', 'log'].includes(action)) throw new UsageError(`unknown action "${action}": add or log`);
      if (v.full && action !== 'add') throw new UsageError('--full goes with add');
      return [{ script: 'harness/media/footage-cli.mjs', args: [action, film, ...clips, ...(v.full ? ['--full'] : [])] }];
    },
    next: (v, [action, film]) => (action === 'add' ? `bin/vawe footage log ${film}` : `fill the brief's "Cut list" in films/${film}/brief.md from footage.md, then point each <video src="footage/<slug>.mp4"> at it`),
  },
  {
    tier: 'core',
    name: 'dev', summary: 'draft render: half size, 30 fps, with sound; also writes a key-frame sheet PNG next to it; --animatic, --studio',
    positional: [PAGE],
    flags: [
      { name: 'from', type: 'number', help: 'start second' },
      { name: 'to', type: 'number', help: 'end second' },
      ASPECT_FLAG,
      { name: 'lock-length', type: 'bool', help: 'write the found length of a duration="auto" page into its meta, so a cut to music can fix it' },
      { name: 'silent', type: 'bool', help: 'picture-only draft: leave the audio tags out of the mix (faster)' },
      { name: 'whole', type: 'bool', help: 'render the whole film even with an empty plan (while the brief\'s Ideas or Board is empty and no full draft exists, every dev renders a 2 s window around the spectacle, small, to out/<name>-plan-window.mp4)' },
      { name: 'small', type: 'bool', help: 'encode the draft about 5x smaller for a file to post, such as an og:video share loop (x264 preset fast, CRF 24; about 0.2 s more encode for 5 s)' },
      PARAM,
      { name: 'out', type: 'path', default: 'out/<name>-draft.mp4, or out/<name>-draft-<from>-<to>.mp4 for a range (out/<name>-animatic.mp4 with --animatic)', help: 'output file' },
      { name: 'animatic', type: 'bool', help: 'instead of a draft: the key frame of each world held for its planned span, hard cuts, silent, in a few seconds, to check the timing before you animate' },
      { name: 'fps', type: 'number', default: 10, help: 'with --animatic: frame rate of the animatic' },
      { name: 'studio', type: 'bool', help: 'instead of a draft: a live scrubbable preview that edits the page literals in place (Ctrl-C stops it)' },
      { name: 'port', type: 'number', default: 8799, help: 'with --studio: http port' },
      { name: 'fast', type: 'bool', help: 'run only the fast checks (page errors, text size and collisions, still windows, tail tiles, smoothness, motion lint on declared animations)' },
      { name: 'full', type: 'bool', help: 'also run the ship-tier checks: per-frame box motion lint, object tracks, loudness and peak' },
      { name: 'taste', type: 'bool', help: 'also print the taste lines (they are always in out/<name>.dev.md)' },
      { name: 'no-judge', type: 'bool', help: 'skip the stills judge that dev runs on the three directions, once per change of directions.html or their brief lines (about 25 s)' },
    ],
    example: 'vawe dev films/my-launch/page.html --from 2 --to 6   |   vawe dev films/my-launch/page.html --animatic   |   vawe dev films/my-launch/page.html --studio',
    build: (v, [page]) => {
      const mode = devModeSteps(v, page);
      if (mode) return mode;
      const planned = planWindow(path.resolve(page), { root: ROOT, from: v.from, to: v.to, out: v.out, whole: v.whole });
      const range = planned ?? v;
      const planEnv = planned ? { VAWE_PLAN_WINDOW: '1' } : {};
      return [
      { script: 'harness/live/dev-warn.mjs', args: [page] },
      { label: planned?.line, env: planEnv, script: 'harness/media/render-page.mjs', args: [page, ...(planned ? [planned.out] : v.out ? [v.out] : []), ...opt('--aspect', v.aspect), ...opt('--from', range.from), ...opt('--to', range.to), ...(v.silent ? ['--silent'] : []), ...(v.small || planned ? ['--small'] : []), ...(v['lock-length'] ? ['--lock-length'] : []), ...(v.fast ? ['--fast'] : []), ...(v.full ? ['--full'] : []), ...(v.taste ? ['--taste'] : [])] },
      ...(v['no-judge'] ? [] : [{ script: 'harness/media/directions-judge.mjs', args: [page] }]),
      { script: 'harness/live/dev-end.mjs', args: [page] },
      ];
    },
    next: devNext,
    fix: devFix,
  },
  {
    tier: 'core',
    name: 'ship', summary: 'final render: 60 fps, motion blur, audio mixed; refused until a fresh review and the owner approval',
    positional: [{ name: 'page', required: true, help: 'films/<name>/page.html' }],
    flags: [
      { name: 'aspect', type: 'string', default: 'the page meta, else 16:9', help: `${ASPECT}, or all for one file each` },
      PARAM,
      { name: 'out', type: 'path', default: 'out/<name>.mp4', help: 'output file (not with --aspect all)' },
      { name: 'wait', type: 'bool', help: 'block until the render ends instead of running it in the background' },
      { name: 'status', type: 'bool', retired: 'wait for the render with bin/vawe wait <page> (it returns within about 3.5 minutes; on STILL RUNNING run it again)' },
      { name: 'profile', type: 'bool', help: 'print a cost table: frames, subframes, screenshots, capture and encode seconds, the 5 costliest seconds' },
    ],
    example: 'vawe ship films/my-launch/page.html --aspect all   (then: vawe wait films/my-launch/page.html)',
    build: (v, [page]) => {
      const args = [page, ...(v.out ? [v.out] : []), ...(v.profile ? ['--profile'] : [])];
      const before = [{ script: 'harness/live/ship-approval.mjs', args: [page] }, { script: 'harness/live/ship-warn.mjs', args: [page] }];
      if (v.wait) return [...before, { script: 'harness/media/render-page.mjs', args: [...args, '--final', ...opt('--aspect', v.aspect)] }];
      return [...before, { script: 'harness/media/ship-job.mjs', args: ['start', ...args, ...opt('--aspect', v.aspect)] }];
    },
    fix: (reason, [page]) => (page?.endsWith('.html') && !/ship refused/.test(reason) ? `bin/vawe dev ${page}` : null),
    next: (v, [page]) => {
      if (v.wait) return critiqueFreshCommand(page);
      return `rendering in the background: bin/vawe wait ${page} (one call waits up to 3.5 minutes, then says STILL RUNNING: call it again; run it alone, not in parallel); ${WAIT_WORK}`;
    },
  },
  {
    tier: 'core',
    name: 'wait', summary: 'use when a draft, clip or final render or a critique is running, instead of sleep, ps or an until loop: prints its result line',
    positional: [{ name: 'page|film', required: true, help: 'films/<name>/page.html, or the film name; a call returns after about 3.5 minutes with a STILL RUNNING line and a progress line a minute: call it again' }],
    flags: [],
    example: 'vawe wait films/my-launch/page.html   |   vawe wait my-launch',
    build: (v, [film]) => [{ script: 'harness/media/ship-job.mjs', args: ['wait', film] }],
    next: (v, [film]) => `${WAIT_WORK}`,
  },
  {
    tier: 'core',
    name: 'critique', summary: 'use when a draft is ready for fresh eyes: phone sheet, strip, loop seam, measured deltas; --fresh starts a critic session',
    positional: [PAGE],
    flags: [
      { name: 'ref', type: 'path', help: 'reference mp4 to measure against (default: the reference the brief names)', kind: 'file' },
      { name: 'at', type: 'string', default: 'auto', help: 'seconds for the strip, or auto' },
      { name: 'from', type: 'number', help: 'with --ref: match only from this second' },
      { name: 'to', type: 'number', help: 'with --ref: match only to this second' },
      { name: 'final', type: 'bool', help: 'with --ref: match the full-size render; a pass unlocks vawe ship' },
      { name: 'fresh', type: 'bool', help: 'after the views, start a separate headless claude session (Read tool only) that critiques the draft and writes out/<film>.critique-<n>.md ending in REJECT or PASS; about 1 to 5 min; exit 2 when the claude CLI is missing; the ship gate accepts it from your own session' },
      { name: 'model', type: 'string', default: 'the claude CLI default', help: 'with --fresh: the model the critic session runs' },
    ],
    defaultRef: (v, [page]) => page,
    example: 'vawe critique films/my-launch/page.html --ref refs/ad.mp4 --at 4.2   |   vawe critique films/my-launch/page.html --fresh',
    build: (v, [page]) => (v.model && !v.fresh ? (() => { throw new UsageError('--model needs --fresh'); })() : [
      { label: 'page code traps', script: 'quality/gates/anim-traps.mjs', args: [page] },
      { label: 'phone sheet, strip and loop seam (renders a draft with audio when the last one is stale or silent; 1 to 3 min)', script: 'harness/media/see.mjs', args: [page, '--phone', '--strip', v.at || 'auto', '--loop'] },
      v.ref
        ? { label: 'motion against the reference (1 to 3 min)', advice: true, script: 'harness/media/see.mjs', args: [page, '--dom', '--ref', v.ref, ...opt('--from', v.from), ...opt('--to', v.to), ...(v.final ? ['--final'] : [])] }
        : { label: 'measured deltas', script: 'harness/media/see.mjs', args: [page, '--measure'] },
      { label: 'page-check: text, cues, spectacle, cuts (1 to 3 min)', script: 'quality/gates/page-check.mjs', args: [page, ...opt('--ref', v.ref)], env: { VAWE_FINDINGS_OUT: critiqueFindingsFile(page) } },
      ...(v.fresh ? [{ label: 'fresh critic session (1 to 15 min)', script: 'harness/media/critic-fresh.mjs', args: [page, '--since', String(Date.now()), ...opt('--ref', v.ref), ...opt('--model', v.model)] }] : []),
    ]),
    report: (v, [page], sinceMs) => summaryLines(
      readFresh(critiqueFindingsFile(page), sinceMs),
      freshImages(scratch('see', filmKey(page)), sinceMs),
    ),
    next: (v, [page]) => (v.fresh
      ? `Read the critique file above, fix its top five with bin/vawe dev ${page} --from s --to s`
      : `look at the sheets above, or start a critic session with ${SAY.critique(pageName(page), page)}`),
  },
  {
    tier: 'core',
    name: 'refs', summary: 'use when you study references before you design: list them, print the settled frame of every shot, add a film',
    positional: [{ name: 'action', required: true, help: 'list, index (build refs.json from the folder), add, or frames (the settled full-size frame of each shot, into frames/<id>/ with a frames.json manifest; prints every absolute path)' }, { name: 'source', help: 'with add: an mp4 file or a URL (yt-dlp, 360p); with frames: one film id (default: every film in scope); with list: one film id, whose frame paths it prints' }],
    flags: [
      { name: 'type', type: 'string', help: 'with add: product (product and UI launch films) or brand (idents, brand and studio films); left out, the film is added with no type and a brief does not pick it' },
      { name: 'title', type: 'string', help: 'with add: the film title' },
      { name: 'no-measure', type: 'bool', help: 'with add: only download and record the film (no ref-spec, no OCR); measure it later with vawe see <id>' },
    ],
    example: 'vawe refs list [id]   |   vawe refs frames u6iro1jHujs   |   vawe refs add https://youtu.be/xxxx --type product --title "Linear Agent"   |   vawe refs add <url> --no-measure',
    build: (v, [action, source]) => [{ script: 'harness/dev/refs.mjs', args: [action, ...(source ? [source] : []), ...opt('--type', v.type), ...opt('--title', v.title), ...(v['no-measure'] ? ['--no-measure'] : [])] }],
    next: (v, [action]) => (action === 'add' && v['no-measure'] ? 'bin/vawe see <id> measures it (the id is on the added line); bin/vawe refs list' : action === 'list' && refsEmpty(refsDir()) ? 'bin/vawe frame films/examples/colour-sting/page.html --world all --full, then Read the stills at full size before you design' : action === 'list' ? 'bin/vawe refs frames, then Read the absolute paths it prints (one per frame) at full size before you design; bin/vawe frame <id> --cuts shows how the film moves through each cut' : action === 'frames' ? 'Read the frames at full size; write what you take from which frame before you design' : 'bin/vawe refs list'),
  },
  {
    tier: 'core',
    name: 'check', summary: 'use when you run one named gate or report; bare lists the gates',
    positional: [{ name: 'name', help: 'gate name, then that gate\'s own args' }],
    flags: [], raw: true,
    example: 'vawe check anim-traps films/my-launch/page.html',
    build: (v, args) => [{ script: 'harness/lib/check-gate.mjs', args }],
  },
  {
    tier: 'core',
    name: 'sound', summary: 'use when you choose, check or cut to sound: voices, beat grid, cues of a page, --sfx, --lab',
    positional: [{ name: 'input', required: false, help: 'an audio file (m4a, mp3, wav), an mp4 with audio, a reference id from vawe refs list, or a page (reads its <audio loop> bed, the synth cues as separate rows, and the page\'s own cuts); none: list the synth voices for <audio data-synth>' }],
    flags: [
      { name: 'cuts', type: 'string', help: 'a page (exact worlds from the DOM), an mp4 or a reference id (shot cuts): a table per cut with the nearest hit and beat line, offset in ms and frames, verdict, and the second to move each off cut to' },
      { name: 'from', type: 'number', help: 'start second of the window' },
      { name: 'to', type: 'number', help: 'end second of the window' },
      { name: 'at', type: 'string', help: 'a page: comma-separated seconds, for example 0.8,2.75: the cues sounding there, how far into each and its level in dB' },
      { name: 'waveform', type: 'bool', help: 'a page: one PNG of the mixed waveform, loudness curve, world starts and a tick per cue; prints LUFS and true peak' },
      { name: 'out', type: 'path', default: 'out/see/<name>, or out/<film>-waveform.png with --waveform', help: 'folder for sound.md, sound.json and sound.png, or the PNG path with --waveform' },
      { name: 'no-cache', type: 'bool', help: 'read the track again even if this file and the code were read before' },
      { name: 'sfx', type: 'bool', help: 'instead of reading: trim, pitch, fade and level the <input> effect file into the film\'s assets/sfx/ as mp3 and print the <audio> line to paste; needs --film' },
      { name: 'film', type: 'string', help: 'with --sfx: the page or film name that gets the file in its assets/sfx/' },
      { name: 'trim', type: 'string', help: 'with --sfx: a,b in seconds of the source, for example 0.1,0.6' },
      { name: 'fade-in', type: 'number', help: 'with --sfx: seconds of fade in' },
      { name: 'fade-out', type: 'number', help: 'with --sfx: seconds of fade out' },
      { name: 'pitch', type: 'number', help: 'with --sfx: semitones, 12 is an octave up; the speed moves with the pitch' },
      { name: 'gain', type: 'number', help: 'with --sfx: dB added to the level' },
      { name: 'peak', type: 'number', help: 'with --sfx: set the loudest sample to this dBFS, for example -6 (not with --gain)' },
      { name: 'name', type: 'string', help: 'with --sfx: the output name (default: the input name)' },
      { name: 'lab', type: 'bool', help: 'instead of reading: render every synth cue to out/sound-lab/*.wav and open the lab to listen and mark verdicts' },
    ],
    example: 'vawe sound assets/bed.m4a --cuts films/my-launch/page.html   |   vawe sound films/my-launch/page.html   |   vawe sound films/my-launch/page.html --at 0.8,2.75   |   vawe sound ~/Downloads/click.wav --sfx --film films/my-launch/page.html --trim 0.05,0.4 --fade-out 0.08 --pitch 3 --peak -6 --name click-high   |   vawe sound   |   vawe sound --lab',
    build: (v, [input]) => {
      if (v.lab) return [{ script: 'harness/dev/sound-lab.mjs', args: [] }];
      const sfxFlag = ['film', 'trim', 'fade-in', 'fade-out', 'pitch', 'gain', 'peak', 'name'].find((f) => v[f] !== undefined);
      if (v.sfx) {
        if (!input) throw new UsageError('missing <input>; usage: vawe sound <file> --sfx --film films/my-launch/page.html [--trim a,b] [--fade-in s] [--fade-out s] [--pitch st] [--gain dB | --peak dB]');
        if (!v.film) throw new UsageError('missing --film <page|name>; usage: vawe sound <file> --sfx --film films/my-launch/page.html [--trim a,b] [--fade-in s] [--fade-out s] [--pitch st] [--gain dB | --peak dB]');
        return [{ script: 'harness/media/sfx.mjs', args: [input, '--film', v.film, ...opt('--trim', v.trim), ...opt('--fade-in', v['fade-in']), ...opt('--fade-out', v['fade-out']), ...opt('--pitch', v.pitch), ...opt('--gain', v.gain), ...opt('--peak', v.peak), ...opt('--name', v.name)] }];
      }
      if (sfxFlag) throw new UsageError(`--${sfxFlag} needs --sfx`);
      const view = Boolean(v.at || v.waveform);
      if (!input) {
        if (view || v.cuts) throw new UsageError('give a page: usage: vawe sound <page> --at 0.8,2.75 | --waveform');
        return [{ script: 'harness/dev/list-assets.mjs', args: ['sounds'] }];
      }
      if (view) {
        if (!input.endsWith('.html')) throw new UsageError('--at and --waveform read a page: usage: vawe sound <page> --at 0.8,2.75 | --waveform');
        return [{ script: 'harness/media/audio-view.mjs', args: [input, ...opt('--at', v.at), ...(v.waveform ? ['--waveform'] : []), ...opt('--out', v.out)] }];
      }
      return [{ script: 'harness/media/sound.mjs', args: [input, ...opt('--cuts', v.cuts), ...opt('--from', v.from), ...opt('--to', v.to), ...opt('--out', v.out), ...(v['no-cache'] ? ['--no-cache'] : [])] }];
    },
    next: (v, [input]) => (v.lab ? 'verdicts are kept in quality/baselines/sound-verdicts.json' : v.sfx ? 'set data-at on the <audio> line, then bin/vawe sound <page> --at <s> to check the cue sounds on its event' : !input ? 'a voice goes in <audio data-synth="name" data-at="s">; vawe sound <track> gives the beat grid and hits of a music file the user gave'
      : v.at || v.waveform ? (v.waveform ? 'Read the PNG: each orange tick must sit on the dashed world line of its visual event; move a cue with data-at or data-on' : 'a cue 0 s into itself starts at that second; move one that is off its event with data-at')
        : 'Read sound.md and sound.png; put each cut on a hit or a beat line at the frame the cut table names, then vawe sound <track> --cuts <page> again'),
  },
];

/** Verbs that are no longer in the table: only an alias in aliases.mjs reaches them, so they stay out of --help and the list of valid verbs. */
export const ALIAS_TARGETS = [
  {
    tier: 'alias',
    name: 'fonts', summary: 'the free font faces, one line each, with the file to copy into films/<name>/assets/; with --system the faces installed on this machine, usable through local() in a film you render yourself',
    positional: [], flags: [{ name: 'system', type: 'bool', help: 'list the installed system faces (Tahoma, Verdana, ...) with their local() name; never copy or commit the font file' }],
    example: 'vawe fonts --system',
    build: (v) => [{ script: 'harness/dev/list-assets.mjs', args: ['fonts', ...(v.system ? ['--system'] : [])] }],
  },
  {
    tier: 'alias',
    name: 'palette', summary: 'one OKLCH brand seed with its mood, and how to compose a full palette around it; the same key always gives the same seed',
    positional: [],
    flags: [
      { name: 'from', type: 'string', help: 'hash this key (a film name, a brand) to a seed: deterministic; with neither flag the seed is random' },
      { name: 'id', type: 'string', help: 'a specific seed, for example seed-021' },
    ],
    example: 'vawe palette --from my-launch',
    build: (v) => [{ script: 'harness/dev/palette.mjs', args: [...opt('--id', v.id), ...opt('--from', v.from)] }],
    next: () => 'write the palette into films/<name>/DESIGN.md as OKLCH roles',
  },
];
