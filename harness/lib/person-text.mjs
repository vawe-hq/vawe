// What bin/vawe prints, as a person who installed the package reads it: they run `npx vawe`, and the docs live in the package.
// A checkout prints the text unchanged.
import path from 'node:path';

const DOCS = /(?<![\w./-])((?:taste|prompts|guides|skills)\/[\w./-]*[\w/]|AGENTS\.md)/g;

/** Where the package sits as the person names it: relative to their folder, or absolute when it is outside it (an npx cache). Pure. */
export function engineFrom(work, engine) {
  const rel = path.relative(work, engine);
  return rel.startsWith('..') || path.isAbsolute(rel) ? engine : rel;
}

/** `text` with bin/vawe as npx vawe and each engine doc path under `engineAt`. Pure. */
export const personText = (text, engineAt) => text.replace(/\bbin\/vawe\b/g, 'npx vawe').replace(DOCS, (doc) => `${engineAt}/${doc}`);
