// quality/gates/site-build-check.mjs: run the site's REAL build steps locally before they can fail
// silently on the deploy host.
//
//   node quality/gates/site-build-check.mjs [range]
//
// WHY. vawe.dev was dead for ten days (2026-09-06 to 2026-09-16) behind three stacked breaks, and every
// one would have shown up the moment someone ran the site's own build commands:
//   1. `COPY assets/plinth ./assets/plinth` copied a directory a commit had untracked. Caught today by
//      `vawe-dev check docker-check` (quality/gates/docker-context-check.mjs), which reads COPY lines against git.
//   2. `generators/media/fonts.mjs` needs `harness/media/fonts.lock.json`; a rename moved the lock and
//      no COPY followed it. docker-check only understands COPY sources, not what a RUN step opens, so
//      this slipped past it. The fix here is not a smarter parser, it is running the same command the
//      Dockerfile runs: `node generators/media/fonts.mjs` fails immediately, and loudly, without the lock.
//   3. `next build` runs `tsc`, and a page under site/app had a type error that two review passes wrote
//      off as pre-existing. `next build` was never actually run locally, so nothing ever disagreed.
// Nobody noticed because the OLD container kept serving: the push succeeded, the deploy died quietly
// after. `vawe-dev check docker-check` already catches (1) and would have caught (2) had it understood RUN
// inputs; this file closes the remaining gap by running the real commands instead of parsing them.
//
// WHAT RUNS, AND WHY EACH ONE MADE THE CUT:
//   - scripts/site/vendor-assets.mjs the site's own `prebuild`. Copies the fonts into site/public and
//                                    REFUSES on a missing tree. ~0.5s.
//   - generators/media/fonts.mjs     the exact command the Dockerfile RUNs after the lock COPY. Skips
//                                    files already on disk, so a repeat run is near-instant (~0.05s
//                                    measured here); it is the lock file's existence and hash match that
//                                    make it fail, which is exactly what broke in incident 2.
//   - `tsc --noEmit` in site/        the type-check half of `next build`, measured at ~7s here against
//                                    ~31s for the full `next build` on this machine (and CI reports the
//                                    full build runs to several minutes). It reproduces incident 3's
//                                    exact failure category for a fraction of the cost. A full `next
//                                    build` would also re-verify bundling and static generation, which
//                                    have not been the failure mode twice, so it is not run here; if that
//                                    changes, this is the line to change.
//
// WHEN IT RUNS AT ALL. A push that touches nothing the site build reads (a film JSON, a doc, an
// unrelated gate) pays nothing. The trigger set is DERIVED from the Dockerfile's own COPY lines
// rather than hand-typed, so it cannot drift the
// way a maintained list would.
//
// HOW IT DEGRADES. `site/node_modules` will not exist in a fresh clone or a freshly created worktree,
// and this check cannot run `tsc` without it. It refuses
// to pass silently: it prints that it was SKIPPED and names the fix (`npm ci` in site/), and exits 0,
// because a missing local install is an environment gap, not a code defect this push introduced.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gateFindings } from '../../harness/lib/findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const f = gateFindings();
const t0 = Date.now();

const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8').split('\n');
const triggers = new Set(['Dockerfile', '.dockerignore']);
for (const line of dockerfile) {
  const m = line.match(/^COPY\s+(?!--from)(.+)$/);
  if (!m) continue;
  const parts = m[1].split(/\s+/).filter((p) => !p.startsWith('--'));
  for (const s of parts.slice(0, -1)) {
    triggers.add(s.replace(/\/+$/, ''));
  }
}

const range = process.argv[2];
let changed = null; // null = "check unconditionally" (manual `node quality/gates/site-build-check.mjs`)
if (range) {
  changed = execFileSync('git', ['diff', '--name-only', range], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
}

const touches = (p) => changed === null || changed.some((c) => c === p || c.startsWith(p + '/'));
const triggered = [...triggers].some(touches);

if (!triggered) {
  console.log('· deploy-check: this push touches none of the site build\'s inputs, skipping');
  f.emit();
  process.exit(0);
}

if (!fs.existsSync(path.join(ROOT, 'site', 'node_modules'))) {
  console.log('~ deploy-check: SKIPPED, site/ dependencies are not installed here.');
  console.log('  This push touches the site build and was NOT verified. Run `npm ci` in site/, then');
  console.log('  `node quality/gates/site-build-check.mjs`, before you push for real.');
  f.warn('deploy-check-skipped', 'site/node_modules missing, site build not verified locally');
  f.emit();
  process.exit(0);
}

const run = (label, cmd, args, cwd) => {
  const started = Date.now();
  try {
    execFileSync(cmd, args, { cwd, stdio: 'inherit' });
    console.log(`✓ ${label} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    return true;
  } catch {
    console.error(`✗ ${label} failed`);
    f.fail('deploy-check-failed', `${label} failed`, { at: label });
    return false;
  }
};

console.log('▶ deploy-check: running the site\'s real build steps (touched: '
  + [...triggers].filter(touches).join(', ') + ')');

const ok = run('vendor-assets (prebuild)', 'node', ['scripts/site/vendor-assets.mjs'], ROOT)
  && run('fonts lock + verify', 'node', ['generators/media/fonts.mjs'], ROOT)
  && run('tsc --noEmit', 'npx', ['tsc', '--noEmit', '-p', '.'], path.join(ROOT, 'site'));

console.log(ok
  ? `✓ deploy-check: site builds clean (${((Date.now() - t0) / 1000).toFixed(1)}s total)`
  : '✗ deploy-check: the site build would have failed. Fix it before you push.');
f.emit();
process.exit(ok ? 0 : 1);
