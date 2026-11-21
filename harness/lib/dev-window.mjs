import fs from 'node:fs';
import path from 'node:path';
import { emptyPlanParts } from './plan-parts.mjs';
import { fullDraftPath } from './approval.mjs';

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };

/**
 * The one line `vawe dev` prints while the brief's plan (Ideas or Board, for an edit the Cut list) is empty and no full draft exists, or null.
 * The draft renders the whole film either way: the plan never holds pixels back.
 */
export function planAdvice(page, { root }) {
  if (fs.existsSync(fullDraftPath(page, root))) return null;
  const [gap] = emptyPlanParts(read(path.join(path.dirname(page), 'brief.md')));
  if (!gap) return null;
  return `the brief's ${gap.title} is empty: the whole film renders anyway; fill it before the next draft (bin/vawe frame ${path.relative(root, page)} --board lists the advice)`;
}
