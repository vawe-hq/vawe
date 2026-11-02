#!/usr/bin/env node
// quality/gates/site-typography.mjs: does the site's source still obey site/DESIGN.md "Typography rules"?
//
//   node quality/gates/site-typography.mjs [--json]   ·   vawe-dev check site-typography
//
// A static read, like seo-surface: it cannot see a rendered line length or a computed size (that is
// scripts/site/typography-audit.mjs, run against a live server). It catches what rots in a diff:
//   1. an em dash (U+2014) anywhere in site/ source or the site generators (house rule)
//   2. UI copy with a straight quote or apostrophe, three dots, or a number and its unit on a plain space
//      (copy = JSX text, string literals in site/app and site/lib, string values of site/lib/*.json;
//      lib/typo.mjs is the one transform that writes the curly form)
//   3. a CSS weight of 700 to 900 (headings and titles are --fw-head, 600; body is 400)
//   4. a CSS font size under 12px, and all-caps letterspacing outside 5 to 12 percent
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gateFindings } from '../../harness/lib/findings.mjs';
import { copyNodes, copyProblem } from '../../scripts/site/typo-copy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const f = gateFindings();
const rel = (p) => path.relative(ROOT, p);

const SKIP_DIRS = new Set(['node_modules', '.next', '.next-build', '.next-typo', '.source', 'out']);
const SOURCE_ROOTS = ['site/app', 'site/lib', 'site/content', 'site/og', 'scripts/site'];
const SOURCE_EXT = /\.(tsx?|mjs|js|css|json|md|mdx|html)$/;
const SELF = /scripts\/site\/typography-audit/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !SKIP_DIRS.has(e.name)) walk(full, out);
    else if (e.isFile() && SOURCE_EXT.test(e.name) && !SELF.test(full)) out.push(full);
  }
  return out;
}

const files = SOURCE_ROOTS.flatMap((r) => walk(path.join(ROOT, r)));

// 1. em dash
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const i = text.indexOf('\u2014');
  if (i >= 0) {
    const line = text.slice(0, i).split('\n').length;
    f.fail('typo-em-dash', 'an em dash (house rule: use a colon, comma, period or parentheses)', { at: `${rel(file)}:${line}`, fix: 'rewrite the sentence' });
  }
}

// 2. UI copy
for (const file of files.filter((p) => /site\/(app|lib)\//.test(p) && /\.tsx?$/.test(p))) {
  const seen = new Set();
  for (const { text, at } of copyNodes(file).nodes) {
    const why = copyProblem(text);
    if (!why || seen.has(text)) continue;
    seen.add(text);
    f.fail('typo-copy', `${why}: "${text.trim().slice(0, 60)}"`, { at: `${rel(file)}:${at}`, fix: 'node scripts/site/typo-fix.mjs --write <file>' });
  }
}

// 3 and 4. CSS
const RULE = /([^{}]+)\{([^{}]*)\}/g;

function cssProblems(decls) {
  const out = [];
  if (/font-weight:\s*[789]00/.test(decls)) out.push('a weight of 700 to 900 (headings and titles are var(--fw-head), 600)');
  const size = /font-size:\s*(\d+(?:\.\d+)?)px/.exec(decls);
  if (size && Number(size[1]) < 12) out.push(`a font size of ${size[1]}px (12px is the floor)`);
  const caps = /text-transform:\s*uppercase/.test(decls);
  const ls = /letter-spacing:\s*(-?\.?\d+(?:\.\d+)?)em/.exec(decls);
  if (caps && ls && (Number(ls[1]) < 0.05 || Number(ls[1]) > 0.12)) out.push(`all caps with ${ls[1]}em letterspacing (5 to 12 percent)`);
  return out;
}

for (const file of files.filter((p) => p.endsWith('.css') && p.includes('site/app/'))) {
  const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  for (const m of text.matchAll(RULE)) {
    const line = text.slice(0, m.index).split('\n').length;
    for (const why of cssProblems(m[2])) f.fail('typo-css', `${m[1].trim().slice(0, 40)}: ${why}`, { at: `${rel(file)}:${line}`, fix: 'use the type tokens in site/app/globals.css' });
  }
}

console.log(`\n  SITE TYPOGRAPHY · ${files.length} file(s) read · ${f.count} finding(s)\n`);
f.emit();
if (f.records.some((r) => r.severity === 'error')) process.exit(1);
