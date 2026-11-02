import fs from 'node:fs';
import path from 'node:path';

const IMPORT = /(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g;
const EXTENSIONS = ['', '.ts', '.tsx', '.mjs', '/index.ts'];

function resolve(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  for (const ext of EXTENSIONS) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext;
  return null;
}

// The page file plus every module under a lib/content folder it imports, directly or through another
// content module. Those modules hold the copy of a page, so an edit to one is an edit to the page.
export function routeSources(pageFile) {
  const seen = new Set([pageFile]);
  const queue = [pageFile];
  while (queue.length) {
    const file = queue.pop();
    for (const [, spec] of fs.readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const dep = resolve(file, spec);
      if (!dep || seen.has(dep) || !dep.split(path.sep).slice(-3, -1).join('/').endsWith('lib/content')) continue;
      seen.add(dep);
      queue.push(dep);
    }
  }
  return [...seen];
}

export const newest = (dates) => dates.filter(Boolean).sort().at(-1) ?? null;
