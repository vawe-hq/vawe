// quality/gates/skill-reach.mjs: is every skills/*/SKILL.md actually ROUTED to, by something an
// agent reads before it would need it?
//
//   node quality/gates/skill-reach.mjs      ·   vawe-dev check skill-reach
//
// WHY THIS EXISTS. `vawe-dev check doc-refs` checks that a doc link resolves; `vawe-dev check discovery` checks that a
// registry entry can be found through the search corpus. Neither checked whether a SKILL could be
// found at all. `vawe-review-loop` carried the judge loop's stopping rule (STOP-done ·
// STOP-converged · STOP-hand-it-back) and nothing pointed at it: not AGENTS.md's skill router table,
// not `guides/ROUTING.md`, not another skill. A skill nobody routes to is a skill
// nobody loads, which for Claude Code (autoloaded only by description match) or a by-hand reader
// (who opens a doc only when something told them to) is the same failure as not having written it.
//
// WHAT COUNTS AS ROUTED. AGENTS.md, `guides/ROUTING.md`, the Makefile, or another
// skill's SKILL.md naming the skill's directory. A generated index would not count, because it lists
// every skill whether or not an agent is told to open it, and the gate could then never fail.
//
// Pure: reads files, no render, no network.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gateFindings } from '../../harness/lib/findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const read = (root, rel) => {
  const abs = path.join(root, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
};

/** Every skills/<dir>/SKILL.md, as {dir, file}. Discovered from the tree, never listed, so a skill
 *  added tomorrow is in scope tomorrow. `git ls-files` when the root is a git repo (the real
 *  library, where an untracked draft skill should not yet be judged); a plain directory walk
 *  otherwise, which is what lets a test point this at a bare fixture tree with no .git of its own. */
function skills(root) {
  if (fs.existsSync(path.join(root, '.git'))) {
    const ls = cp.execSync("git ls-files 'skills/*/SKILL.md'", { cwd: root }).toString().trim();
    return (ls ? ls.split('\n') : []).map((file) => ({ dir: file.split('/')[1], file }));
  }
  const dirs = fs.existsSync(path.join(root, 'skills')) ? fs.readdirSync(path.join(root, 'skills')) : [];
  return dirs
    .filter((dir) => fs.existsSync(path.join(root, 'skills', dir, 'SKILL.md')))
    .map((dir) => ({ dir, file: `skills/${dir}/SKILL.md` }));
}

/** run({root}) -> {total, unrouted}. `root` defaults to this repo, and is the injection point a test
 *  uses to point the gate at a small fixture tree instead of the real 18-skill library. */
export function run({ root = ROOT } = {}) {
  const all = skills(root);
  // The search surface: AGENTS.md, the routing table, the Makefile, and every skill's own SKILL.md.
  const sources = [
    'AGENTS.md',
    'guides/ROUTING.md',
    'Makefile',
    ...all.map((s) => s.file),
  ];
  const text = new Map(sources.map((rel) => [rel, read(root, rel)]));

  const unrouted = [];
  for (const { dir, file } of all) {
    const NAME = new RegExp(`\\b${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const hits = sources.filter((rel) => rel !== file && NAME.test(text.get(rel)));
    if (!hits.length) unrouted.push({ dir, file });
  }
  return { total: all.length, unrouted };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { total, unrouted } = run();
  const f = gateFindings();
  console.log(`── skill reach · ${total} skill(s)\n`);
  if (!unrouted.length) console.log('✓ every skill is routed from AGENTS.md, guides/ROUTING.md, the Makefile, or another skill');
  for (const u of unrouted) {
    const msg = `${u.dir}: nothing routes to it. Add it to AGENTS.md's skill router table or guides/ROUTING.md, or name it from the skill that should hand off to it.`;
    console.log(`   ✗ ${u.file}  ${msg}`);
    f.fail('skill-unrouted', msg, { at: u.file });
  }
  if (unrouted.length) {
    console.log(`\n✗ ${unrouted.length} skill(s) nothing points at. A skill nobody routes to is a skill nobody loads.`);
  }
  process.exit(unrouted.length ? 1 : 0);
}
