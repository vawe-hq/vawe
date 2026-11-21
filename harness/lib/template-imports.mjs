// A template page must render in another project, where only the engine's core/ sits at ../../core next to films/<name>/.
// So a page and its assets may load files from their own folder and from ../../core/, and nothing else.
import fs from 'node:fs';
import path from 'node:path';

const PATTERNS = [
  /\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  /\bimport\s*['"]([^'"\n]+)['"]/g,
  /@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g,
  /\b(?:src|href)\s*=\s*['"]([^'"\n]+)['"]/g,
  /\burl\(\s*['"]?([^'")\s]+)['"]?\s*\)/g,
];
const CHECKED = new Set(['.html', '.js', '.mjs', '.css']);

// A scheme (https:, data:, blob:), a fragment or a template placeholder is not a path to a file of this repo.
const isLocalPath = (spec) => spec !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(spec) && !spec.startsWith('#') && !spec.includes('${');

const staysInside = (resolved) => resolved.startsWith('../../core/') || (!resolved.startsWith('../') && resolved !== '..' && !resolved.startsWith('/'));

/** The paths `text` loads that leave the template: `dir` is the folder of the file, relative to the template root (`''` for page.html). Pure. */
export function outsideRefs(text, dir = '') {
  const found = new Set();
  for (const pattern of PATTERNS) {
    for (const [, spec] of text.matchAll(pattern)) {
      const clean = spec.split(/[?#]/)[0];
      if (!isLocalPath(clean)) continue;
      const resolved = clean.startsWith('/') ? clean : path.posix.normalize(path.posix.join(dir, clean));
      if (!staysInside(resolved)) found.add(spec);
    }
  }
  return [...found];
}

function filesOf(folder, rel = '') {
  return fs.readdirSync(path.join(folder, rel), { withFileTypes: true }).flatMap((e) => {
    const child = path.posix.join(rel, e.name);
    if (e.isDirectory()) return filesOf(folder, child);
    return CHECKED.has(path.extname(e.name).toLowerCase()) ? [child] : [];
  });
}

/** One line for each file of a template folder that loads something outside it: "assets/a.js loads ../../prompts/x.js". */
export function templateImportProblems(folder) {
  return filesOf(folder).flatMap((file) => outsideRefs(fs.readFileSync(path.join(folder, file), 'utf8'), path.posix.dirname(file) === '.' ? '' : path.posix.dirname(file))
    .map((ref) => `${file} loads ${ref}, which is outside the template: only its own folder and ../../core/ exist in another project`));
}
