// The engine broke its own no-em-dash rule 7,345 times before this check existed.
import { spawnSync } from 'node:child_process';
import { isMain } from '../lib/is-main.mjs';

export const EM = String.fromCharCode(0x2014);   // never write the literal here: this file is in scope
const QUIET = process.argv.includes('--quiet');

// Exported so harness/live's write-time twin can tell which files this scan already reaches, and stay quiet on them instead of repeating the same finding at push time.
export const SCOPE = [
  'core', 'blocks', 'scripts', 'harness', 'quality', 'generators', 'research', 'tools', 'films', 'scene', 'films',
  'blueprints', 'cli', 'guides', 'Makefile', '*.md', 'studio',
  'cmd', 'internal', 'mcp', 'themes', 'directions', 'registry', 'taste',
];

// Exported so harness/live's write-time twin checks the same allowlist instead of growing its own copy.
export const EXCLUDE = [
  (f) => f.startsWith('assets/vendor/') || f.includes('/vendor/') || f.includes('node_modules/'),
];

// Only run the CLI scan when this file is the entrypoint: harness/live's write-time twin imports EM and EXCLUDE above and must not pay for a repo-wide git grep just to reuse the matcher.
if (isMain(import.meta.url)) {
  // No shell: cmd.exe keeps the quotes of a POSIX command line, so the old string matched nothing on Windows. Exit 1 is "no match".
  const raw = spawnSync('git', ['grep', '-nI', EM, '--', ...SCOPE], { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout || '';

  const hits = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const m = /^([^:]+):(\d+):(.*)$/s.exec(line);
    if (!m) continue;
    const [, file, no, text] = m;
    if (EXCLUDE.some((f) => f(file))) continue;
    hits.push({ file, no, text: text.trim() });
  }

  if (!QUIET) {
    for (const h of hits) {
      const i = h.text.indexOf(EM);
      console.log(`${h.file}:${h.no}: ${h.text.slice(Math.max(0, i - 60), i + 60)}`);
    }
  }
  if (hits.length) {
    console.error(`\nno-emdash: ${hits.length} em dash(es) in scope. Use a colon, a comma, a `
      + 'period, or parentheses, or split the sentence. The choice is per site, not one character swap.');
    process.exit(1);
  }
  console.log(`no-emdash: clean (every allowlisted path is vendored, none is debt)`);
}
