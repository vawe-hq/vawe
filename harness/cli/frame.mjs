// `vawe frame`: every picture of a film. One mode flag picks the owner script; the steps come from the builders below.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError } from './parse.mjs';
import { opt, needsPage, pageName } from './helpers.mjs';
import { isUrl } from '../lib/url.mjs';
import { compareProblem, CUTS } from '../media/compare-frames.mjs';
import { STRIP_FPS, STRIP_SPAN, stripProblem } from '../media/see/strip-math.mjs';
import { stillProblem } from '../media/see/still-math.mjs';
import { ONION_FRAMES, ONION_SPAN, onionProblem } from '../media/see/onion-math.mjs';
import { ZOOM_SCALE, zoomProblem } from '../media/see/zoom-math.mjs';
import { VELOCITY_SPAN, velocityProblem } from '../media/see/velocity-math.mjs';
import { looksProblem } from '../lib/looks.mjs';
import { SAY, nextStep } from '../live/stage-say.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The compare-frames step of a sheet with a reference: a page is seeked, an mp4 is read; the reference is always beside it. */
function versus(v, input) {
  if (v.labels || v.cols !== undefined) throw new UsageError('--labels and --cols do not go with --vs');
  const page = input.endsWith('.html');
  const at = v.at ?? CUTS;
  const problem = compareProblem({ ours: page ? undefined : input, page: page ? input : undefined, ref: v.vs, at });
  if (problem) throw new UsageError(problem);
  return [{ script: 'harness/media/compare-frames.mjs', args: [...(page ? ['--page', input] : [input]), '--ref', v.vs, '--at', at, ...opt('--from', v.from), ...opt('--out', v.out)] }];
}

export const STEPS = {
  still(v, input) {
    const problem = stillProblem({ source: input, at: v.at, size: v.size });
    if (problem) throw new UsageError(problem);
    needsPage(v, input, 'frame');
    return [{ script: 'harness/media/still.mjs', args: [input, '--at', v.at, ...opt('--size', v.size), ...opt('--out', v.out)] }];
  },
  sheet(v, input) {
    needsPage(v, input, 'frame');
    if (v.vs) return versus(v, input);
    return [{ script: 'harness/media/sheet.mjs', args: [input, ...opt('--at', v.at), ...opt('--from', v.from), ...(v.labels ? ['--labels'] : []), ...opt('--cols', v.cols), ...opt('--out', v.out)] }];
  },
  world(v, page) {
    return [{ script: 'harness/media/frames.mjs', args: [page, ...(v.full ? ['--full'] : []), ...(v.zoom ? ['--zoom'] : []), ...(v.world ?? []).flatMap((w) => ['--world', w])] }];
  },
  looks(v, page) {
    const problem = looksProblem({ at: v.at, only: v.only });
    if (problem) throw new UsageError(problem);
    return [{ script: 'harness/media/looks.mjs', args: [page, ...opt('--at', v.at), ...opt('--only', v.only), ...opt('--out', v.out)] }];
  },
  strip(v, film) {
    if (v.onion) {
      const span = v.span ?? ONION_SPAN;
      const n = v.n ?? ONION_FRAMES;
      const problem = onionProblem({ at: v.at, span, n });
      if (problem) throw new UsageError(problem);
      return [{ script: 'harness/media/see.mjs', args: [film, '--onion', v.at, '--span', String(span), '--n', String(n), ...opt('--out', v.out)] }];
    }
    if (v.velocity) {
      const span = v.span ?? VELOCITY_SPAN;
      const problem = velocityProblem({ at: v.at, span, sel: v.sel, ids: v.ids });
      if (problem) throw new UsageError(problem);
      return [{ script: 'harness/media/see.mjs', args: [film, '--velocity', v.at, '--span', String(span), ...opt('--sel', v.sel), ...opt('--ids', v.ids), ...opt('--out', v.out)] }];
    }
    const span = v.span ?? STRIP_SPAN;
    const fps = v.fps ?? STRIP_FPS;
    const problem = stripProblem({ at: v.at, cuts: v.cuts, span, fps });
    if (problem) throw new UsageError(problem);
    return [{ script: 'harness/media/see.mjs', args: [film, ...(v.cuts ? ['--cuts'] : ['--moment', v.at]), '--span', String(span), '--fps', String(fps), ...opt('--out', v.out)] }];
  },
  zoom(v, film) {
    const scale = v.scale ?? ZOOM_SCALE;
    const problem = zoomProblem({ at: v.at, box: v.box, auto: v.auto, scale, vs: v.vs, atB: v['at-b'] });
    if (problem) throw new UsageError(problem);
    return [{ script: 'harness/media/see/zoom.mjs', args: [film, '--at', v.at, ...(v.auto ? ['--auto'] : ['--box', v.box]), '--scale', String(scale), ...opt('--vs', v.vs), ...opt('--at-b', v['at-b']), ...opt('--out', v.out)] }];
  },
  board(v, input) {
    return [{ script: 'harness/media/storyboard.mjs', args: [input, ...opt('--page', v.page), ...opt('--out', v.out), ...(v.all ? ['--all'] : [])] }];
  },
  directions(v, input) {
    if (!input.endsWith('.html')) throw new UsageError('--directions reads a page: usage: vawe frame <page> --directions [--out file.html]');
    return [{ script: 'harness/media/directions-board.mjs', args: [input, ...opt('--out', v.out)] }];
  },
};

const MODES = ['world', 'cuts', 'moment', 'looks', 'board', 'directions', 'crop'];
const MODE_FLAGS = '--world, --cuts, --moment, --looks, --board, --directions, --box';
const NAME = { still: '--at <one second>', sheet: '--at s,s,s', world: '--world', cuts: '--cuts', moment: '--moment', looks: '--looks', board: '--board', directions: '--directions', crop: '--box or --auto' };
const ONLY = {
  labels: ['sheet'], cols: ['sheet'], from: ['sheet'], sheet: ['sheet'],
  size: ['still'],
  aspect: ['still', 'sheet'], param: ['still', 'sheet'],
  span: ['moment', 'cuts'], fps: ['moment', 'cuts'],
  onion: ['moment'], velocity: ['moment'],
  full: ['world'], sharp: ['world'],
  scale: ['crop'], only: ['looks'], page: ['board'], all: ['board'],
  vs: ['sheet', 'crop'], 'at-b': ['crop'],
  at: ['still', 'sheet', 'crop', 'looks'],
};
const oneSecond = (at) => /^\s*\d+(\.\d+)?\s*$/.test(String(at));

/** The mode a call asks for: world, cuts, moment, looks, board, directions, crop (box or auto), still (one frame) or sheet. Pure; throws a UsageError for two modes. */
export function modeOf(v) {
  const given = [['world', v.world?.length > 0], ['cuts', v.cuts], ['moment', v.moment !== undefined], ['looks', v.looks], ['board', v.board], ['directions', v.directions], ['crop', v.box !== undefined || v.auto]]
    .filter(([, on]) => on).map(([mode]) => mode);
  if (given.length > 1) throw new UsageError(`give one of ${MODE_FLAGS}, not ${given.map((m) => NAME[m]).join(' and ')}`);
  if (given.length) return given[0];
  return v.at !== undefined && oneSecond(v.at) && !v.sheet && !v.vs ? 'still' : 'sheet';
}

/** The flags with --ref folded into --vs: the same flag under two names. */
function withVs(v) {
  if (v.ref && v.vs && v.ref !== v.vs) throw new UsageError('give --vs once (--ref is the same flag)');
  return { ...v, vs: v.vs ?? v.ref };
}

function outsideMode(v, mode) {
  for (const [flag, modes] of Object.entries(ONLY)) {
    const on = v[flag] !== undefined && v[flag] !== false;
    if (on && !modes.includes(mode)) return `--${flag} needs ${modes.map((m) => NAME[m]).join(' or ')}`;
  }
  return null;
}

function modifierProblem(v) {
  if (v.n !== undefined && !v.onion) return '--n needs --onion';
  if (v.onion && v.velocity) return 'give --onion or --velocity, not both';
  if ((v.sel !== undefined || v.ids !== undefined) && !v.velocity) return '--sel and --ids need --velocity';
  if (v['at-b'] !== undefined && !v.vs) return '--at-b needs --vs';
  if (v.moment !== undefined && v.at !== undefined) return '--moment takes its own second: drop --at';
  return null;
}

/** Throws a UsageError when a file the call names is missing; a reference id or a cut of an mp4 is not checked here. */
function requireFiles(v0, [input]) {
  const v = withVs(v0);
  const mode = modeOf(v);
  const found = ['cuts', 'moment', 'crop'].includes(mode) || (mode === 'still' && isUrl(input)) || fs.existsSync(input);
  if (!found) throw new UsageError(`no such ${mode === 'sheet' ? 'page, mp4 or folder' : mode === 'still' ? 'page or mp4' : 'page'}: ${input}`);
  if (mode === 'sheet' && v.vs && !fs.existsSync(v.vs)) throw new UsageError(`no such file for --vs: ${v.vs}`);
}

function stepsOf(v0, [input]) {
  const v = withVs(v0);
  const mode = modeOf(v);
  const problem = modifierProblem(v) ?? outsideMode(v, mode);
  if (problem) throw new UsageError(problem);
  if (mode === 'moment') return STEPS.strip({ ...v, at: v.moment }, input);
  if (mode === 'cuts') return STEPS.strip(v, input);
  if (mode === 'crop') return STEPS.zoom(v, input);
  if (mode === 'world') return STEPS.world({ ...v, zoom: v.sharp, world: v.world.filter((w) => w !== 'all') }, input);
  return STEPS[mode](v, input);
}

const FRAME_NEXT = {
  still: 'Read the PNG at full size; vawe frame <page|mp4> --at <s> --box x,y,w,h enlarges one region',
  sheet: 'Read the PNG at full size; vawe frame <page> --moment <s> shows the frames through one moment',
  looks: 'Read each grid at full size, pick a look by sight, then put `look: \'<name>\'` in the lens options of the page (prompts/moves/lens.md lists the numbers); the page options still win over the look',
  crop: 'Read the PNG at full size: left is a, right is b; name the pixel pattern you see (colour fringes, a stripe mask, halo width) and then vawe see <film> for the numbers',
};

function nextOf(v, [input]) {
  const mode = modeOf(v);
  if (mode === 'sheet' && v.vs) return `look at the PNG: ${v.at === CUTS || v.at === undefined ? 'one frame per world change, at its middle' : 'one frame per --at second'}, reference left, yours right; fix the worst row first`;
  if (FRAME_NEXT[mode]) return FRAME_NEXT[mode];
  if (mode === 'world') return v.full ? `Read the stills at full size and fix the states; then bin/vawe frame ${input} --world all for the sheet` : nextStep(path.resolve(input), ROOT).next;
  if (mode === 'moment') {
    if (v.onion) return 'Read the PNG at full size: evenly spaced ghosts mean a linear move, ghosts bunched at one end mean an ease, a ghost past the final position means an overshoot; vawe frame <page> --moment <s> --velocity gives the numbers for a page';
    if (v.velocity) return 'Read the PNG, then fix the move the summary names: the page literal that sets its ease, its duration or its overshoot';
    return 'Read each grid path above at full size: frames run left to right, top to bottom, and the motion line gives the seconds the move starts and settles; then bin/vawe frame <page|mp4> --vs <ref.mp4> --at <s> to put the reference beside yours';
  }
  if (mode === 'cuts') return `Read each grid path above at full size: frames run left to right, top to bottom, and the motion line gives the seconds the move starts and settles; compare how the outgoing and incoming parts overlap at each cut${input.endsWith('.html') ? `; ${SAY.motionRows(pageName(input))}, then ${SAY.critique(pageName(input), input)}` : '; then name 3 moves in "Taken from" (ref id, cut second) and the pattern of taste/craft/film-structure.md (The motion grammar) the ref uses'}`;
  if (mode === 'directions') return `Read the board, ask the person to pick one direction, then write \`picked: <A, B or C>, because <reason>\` in ${path.join(path.dirname(input), 'brief.md')}`;
  return `read the plan advice (bin/vawe frame ${input} --board --all, or the board) and fix it or keep it on purpose; open the HTML from disk to present or review the board; the Board and Motion pass in brief.md fill the move, handoff and note fields`;
}

const SUMMARY = 'use when you want a picture of a film: --at s one frame, --at s,s,s a sheet, --world, --cuts, --moment s, --box, --looks, --board';

const HELP = `usage: vawe frame <page|mp4|ref-id|folder> [one mode] [flags]

one frame or a sheet (no mode flag):
  --at 4.2                  one full-size frame. --size WxH, --aspect, --param k=v
  --at 0.5,1.2,3            a labelled sheet; --at cuts, or no --at, picks the cuts. --labels --cols --from
  --vs ref.mp4 --at 2.5,3   the reference left, yours right, same seconds
key states and cuts:
  --world all | s3,s5       the key state of each world and a sheet. --full full size, --sharp
  --cuts                    one grid per cut
a move:
  --moment 8.4              frames through that second. --span --fps
  --moment 8.4 --onion      one blended image of the path. --n
  --moment 8.4 --velocity   speed graph per element. --sel css | --ids a,b
a region:
  --at 2.4 --box x,y,w,h    pixels enlarged; --auto finds the densest edge. --scale, --vs ref, --at-b
looks and boards:
  --looks --at 4.5,9        every lens look in a grid. --only crt,anamorphic
  --board                   HTML board, a card per world. --all every advice line, --page
  --directions              the directions board, A, B, C side by side, to show a person

all: --out path. A flag outside its mode gets a one-line error.
example: vawe frame films/my-launch/page.html --world all   |   vawe frame films/my-launch/page.html --cuts`;

const FLAGS = [
  { name: 'at', type: 'string' }, { name: 'sheet', type: 'bool' }, { name: 'vs', type: 'string' }, { name: 'ref', type: 'string' }, { name: 'at-b', type: 'string' },
  { name: 'world', type: 'string', repeat: true }, { name: 'cuts', type: 'bool' }, { name: 'moment', type: 'string' },
  { name: 'onion', type: 'bool' }, { name: 'velocity', type: 'bool' }, { name: 'box', type: 'string' }, { name: 'auto', type: 'bool' },
  { name: 'looks', type: 'bool' }, { name: 'board', type: 'bool' }, { name: 'directions', type: 'bool' },
  { name: 'out', type: 'path' }, { name: 'aspect', type: 'string' }, { name: 'param', type: 'string', repeat: true }, { name: 'size', type: 'string' },
  { name: 'labels', type: 'bool' }, { name: 'cols', type: 'number' }, { name: 'from', type: 'number' },
  { name: 'span', type: 'number' }, { name: 'fps', type: 'number' }, { name: 'n', type: 'number' }, { name: 'sel', type: 'string' }, { name: 'ids', type: 'string' },
  { name: 'full', type: 'bool' }, { name: 'sharp', type: 'bool' }, { name: 'scale', type: 'number' }, { name: 'only', type: 'string' },
  { name: 'page', type: 'path' }, { name: 'all', type: 'bool' },
];

export const FRAME = {
  tier: 'core',
  name: 'frame',
  summary: SUMMARY,
  help: HELP,
  positional: [{ name: 'film', required: true, help: 'a page, an mp4, an https mp4, a reference id or a folder of images' }],
  flags: FLAGS,
  example: 'vawe frame films/my-launch/page.html --world all',
  exists: requireFiles,
  build: stepsOf,
  next: nextOf,
};
