import fs from 'node:fs';
import path from 'node:path';
import { spectacleOf } from './board.mjs';
import { emptyPlanParts } from './plan-parts.mjs';
import { fullDraftPath } from './approval.mjs';
import { paramsFilm } from './page-params.mjs';
import { statedLength } from '../media/page-duration.mjs';

const WINDOW_S = 2;

const round = (x) => Math.round(x * 100) / 100;

/** Where the plan window is written: a name no draft lookup (fullDraftPath, lastDraft, strip input) matches. */
export const planWindowPath = (page, root) => path.join(root, 'out', `${paramsFilm(path.basename(path.dirname(page)))}-plan-window.mp4`);

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };

/**
 * The window every `vawe dev` renders while the brief's plan (Ideas or Board, for an edit the Cut list) is empty and no full draft exists: { from, to, out, line } around the spectacle
 * second (else the middle), or null when the render should run as asked (--whole, a range or an output file was given, a full draft exists, the
 * plan is filled, or the length is not a number).
 */
export function planWindow(page, { root, from, to, out, whole }) {
  if (whole || out || from != null || to != null) return null;
  if (fs.existsSync(fullDraftPath(page, root))) return null;
  const brief = read(path.join(path.dirname(page), 'brief.md'));
  const [gap] = emptyPlanParts(brief);
  if (!gap) return null;
  const html = read(page);
  const length = statedLength(html);
  if (typeof length !== 'number' || !(length > WINDOW_S)) return null;
  const at = spectacleOf(html) ?? length / 2;
  const start = round(Math.min(Math.max(0, at - WINDOW_S / 2), length - WINDOW_S));
  const end = round(start + WINDOW_S);
  const rel = path.relative(root, page);
  return { from: start, to: end, out: planWindowPath(page, root), line: `rendered ${start}-${end} s of ${length} s, small: the brief's ${gap.title} is empty, so pixels wait for the plan; fill it (bin/vawe frame ${rel} --board lists the advice), or pass --whole for the whole film` };
}
