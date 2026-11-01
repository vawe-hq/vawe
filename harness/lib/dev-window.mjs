import fs from 'node:fs';
import path from 'node:path';
import { boardFilled, spectacleOf } from './board.mjs';
import { ideasFilled } from './ideas.mjs';
import { statedLength } from '../media/page-duration.mjs';

const WINDOW_S = 2;

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };

/**
 * The window a first `vawe dev` renders while the brief's Ideas or Board is empty: { from, to, line } around the spectacle second (else the
 * middle), or null when the render should run as asked (a range was given, a draft exists, the plan is filled, or the length is not a number).
 * `--from 0 --to <length>` renders the whole film anyway.
 */
export function planWindow(page, { root, from, to }) {
  if (from != null || to != null) return null;
  const name = path.basename(path.dirname(page));
  if (fs.existsSync(path.join(root, 'out', `${name}-draft.mp4`))) return null;
  const brief = read(path.join(path.dirname(page), 'brief.md'));
  if (ideasFilled(brief) !== false && boardFilled(brief) !== false) return null;
  const html = read(page);
  const length = statedLength(html);
  if (typeof length !== 'number' || !(length > WINDOW_S)) return null;
  const at = spectacleOf(html) ?? length / 2;
  const start = Math.min(Math.max(0, at - WINDOW_S / 2), length - WINDOW_S);
  const end = start + WINDOW_S;
  const rel = path.relative(root, page);
  const empty = ideasFilled(brief) === false ? 'Ideas' : 'Board';
  return { from: start, to: end, line: `rendered ${start}-${end} s of ${length} s, small: the brief's ${empty} is empty, so pixels wait for the plan; fill it (bin/vawe storyboard ${rel} lists the advice), or pass --from 0 --to ${length} for the whole film` };
}
