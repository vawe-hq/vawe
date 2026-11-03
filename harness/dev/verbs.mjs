// The verbs of bin/vawe-dev: tools for working on the framework, not for making a film.
// build() returns the steps to run in order; a step is { script, args } or { node: [argv] }. A verb with `caller: true` runs in the caller's directory, any other in the repo root.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError } from '../cli/parse.mjs';
import { opt, needsPage, PAGE, ASPECT_FLAG, PARAM } from '../cli/helpers.mjs';
import { renderEnv, paramsFlags } from '../lib/page-params.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// A test that compares seconds with a stamped budget reads a slowdown from the other test files as a slow check, so it runs alone, last.
export const SERIAL_TESTS = ['tests/media/check-budget.test.mjs'];

const testFiles = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? testFiles(path.join(dir, e.name)) : e.name.endsWith('.test.mjs') ? [path.join(dir, e.name)] : []));

/** The two node --test runs of `vawe-dev test`: every test file in parallel except the serial ones, then the serial ones alone. */
export const testSteps = () => [{ node: ['--test', ...testFiles('tests').filter((f) => !SERIAL_TESTS.includes(f)).sort()] }, { node: ['--test', ...SERIAL_TESTS] }];

export const DEV_VERBS = [
  {
    name: 'worktrees',
    summary: 'list the agent worktrees with their activity and unlanded work; with --prune, list the merged clean unlocked ones to remove (dry run; --yes removes them and deletes the branch with git branch -d)',
    positional: [],
    caller: true,
    flags: [
      { name: 'prune', type: 'bool', help: 'plan the removal of merged worktrees and say why each other one stays' },
      { name: 'yes', type: 'bool', help: 'with --prune: do the removal' },
    ],
    example: 'vawe-dev worktrees --prune   |   vawe-dev worktrees --prune --yes',
    build: (v) => [v.prune
      ? { script: 'harness/dev/worktree-prune.mjs', args: v.yes ? ['--yes'] : [] }
      : { script: 'harness/dev/worktree-status.mjs', args: [] }],
  },
  {
    name: 'bots',
    summary: 'read the site bot log (BOT_LOG_DIR of vawe.dev): hits, pages, 404s, markdown share, verified IPs and AI referrals per bot',
    caller: true,
    positional: [{ name: 'log', required: true, help: 'a log directory (bots-YYYY-MM-DD.jsonl files) or one file' }],
    flags: [
      { name: 'days', type: 'number', help: 'only the last n days' },
      { name: 'offline', type: 'bool', help: 'use the cached vendor IP lists only' },
    ],
    example: 'vawe-dev bots ./bots --days 7',
    build: (v, positional = []) => [{
      script: 'harness/dev/bots.mjs',
      args: [...positional, ...(v.days !== undefined ? ['--days', String(v.days)] : []), ...(v.offline ? ['--offline'] : [])],
    }],
  },
  {
    name: 'seo',
    summary: 'the weekly SEO report for vawe.dev: Search Console plus the bot log, a dated snapshot, the change since the last one, past changes judged, and the next actions',
    positional: [],
    flags: [
      { name: 'days', type: 'number', help: 'the window in days, ending 3 days ago', default: 28 },
      { name: 'no-save', type: 'bool', help: 'dry run: print the report, write nothing' },
      { name: 'log', type: 'string', help: 'append a change to the change log (SEO_DIR/changes.jsonl) and stop' },
      { name: 'pages', type: 'string', help: 'with --log: the pages it touched, comma separated' },
    ],
    example: 'GSC_SA_JSON=key.json VAWE_BOT_LOG_TOKEN=... vawe-dev seo   |   vawe-dev seo --log "new title" --pages /easing,/moves',
    build: (v) => [{
      script: 'harness/dev/seo.mjs',
      args: [...(v.days !== undefined ? ['--days', String(v.days)] : []), ...(v['no-save'] ? ['--no-save'] : []),
        ...(v.log !== undefined ? ['--log', v.log] : []), ...(v.pages !== undefined ? ['--pages', v.pages] : [])],
    }],
  },
  {
    name: 'land', summary: 'put the current branch on main: fetch, rebase onto origin/main (stops on a conflict), scan for files over 5 MB, run tests/lib and tests/hooks, push with ssh keep-alive, print the e2e line and the pushed range',
    positional: [],
    flags: [],
    example: 'vawe-dev land   (from a worktree branch with every change committed)',
    build: () => [{ script: 'harness/dev/land.mjs', args: [] }],
    next: () => 'delete the merged branch and its worktree (git branch -d <topic>)',
  },
  {
    name: 'claim', summary: 'declare or release the scope a worktree works in: add <name> [branch] [scope ...] | rm <name>',
    positional: [{ name: 'args', help: 'the arguments of the script, as in the example' }],
    flags: [], raw: true,
    example: 'vawe-dev claim add my-fix wt-my-fix harness/media',
    build: (v, args) => [{ script: 'harness/dev/worktree-claim.mjs', args }],
    next: () => 'vawe-dev claim rm <name> when the work lands',
  },
  {
    name: 'e2e', summary: 'page tests plus a parallel half-size draft of every film (about 5 s)',
    positional: [], flags: [],
    example: 'vawe-dev e2e',
    build: () => [{ script: 'harness/dev/e2e.mjs', args: [] }],
  },
  {
    name: 'test', summary: 'run every tests/**/*.test.mjs with node --test; the timing test runs alone at the end',
    positional: [], flags: [],
    example: 'vawe-dev test',
    build: () => testSteps(),
  },
  {
    name: 'runs', summary: 'where a film\'s time went (per stage and verb, slot wait), what failed (by cause) and the draft series; or, with --all, one row per film of the last 30 days',
    positional: [{ name: 'film', help: 'film name or films/<name>/page.html' }],
    flags: [
      { name: 'all', type: 'bool', help: 'one row per film (drafts, median draft seconds, first and best judged total, PASS), then medians per model' },
      { name: 'taste', type: 'bool', help: 'the taste report over every film: per rule fired, fixed, waived, score gain and a verdict; variety per dial; sibling films; template tells' },
      { name: 'json', type: 'bool', help: 'print the records (or with --all or --taste the report) as JSON' },
      { name: 'dir', type: 'path', default: 'out', help: 'the folder that holds the <film>.runs.jsonl files' },
    ],
    example: 'vawe-dev runs my-launch   |   vawe-dev runs --all   |   vawe-dev runs --taste',
    build: (v, [film]) => {
      if (!v.all && !v.taste && !film) throw new UsageError('missing <film>; usage: vawe-dev runs <film>, vawe-dev runs --all or vawe-dev runs --taste');
      return [{ script: 'harness/dev/runs.mjs', args: [...(v.taste ? ['--taste'] : v.all ? ['--all'] : [film]), ...(v.json ? ['--json'] : []), ...opt('--dir', v.dir)] }];
    },
  },
  {
    name: 'moves', summary: 'render the stale prompts/moves/demo/<move>.html clips to prompts/moves/<move>.mp4 (1280 px, 60 fps) in parallel; the masters are not tracked, the web copy is site/public/moves/<move>.mp4; a clip is stale when its demo, demo.css or a core/ import changed; a demo with a variants meta also renders <move>-<theme>.mp4',
    positional: [],
    flags: [
      { name: 'only', type: 'string', help: 'render one move by name, for example weight-morph, even when current; also writes a 12-frame contact sheet to out/moves/<move>-sheet.png' },
      { name: 'all', type: 'bool', help: 'render every clip, stale or not' },
    ],
    example: 'vawe-dev moves --only weight-morph',
    build: (v) => [{ script: 'harness/media/render-moves.mjs', args: [...opt('--only', v.only), ...(v.all ? ['--all'] : [])] }],
    next: () => 'look at the clip in prompts/moves/ and run node scripts/site/moves.mjs --clips to encode its web copy',
  },
  {
    name: 'doctor', summary: 'check node, ffmpeg, Chrome and the other tools; print the install line for each missing one',
    positional: [],
    flags: [
      { name: 'quiet', type: 'bool', help: 'print only problems and write .vawe/doctor.json' },
      { name: 'json', type: 'bool', help: 'print [{tool, required, ok, version, fix}] instead of text' },
    ],
    example: 'vawe-dev doctor --json',
    build: (v) => [{ script: 'harness/dev/doctor.mjs', args: [...(v.quiet ? ['--quiet'] : []), ...(v.json ? ['--json'] : [])] }],
  },
  {
    name: 'check', summary: 'use when you run one named gate or report; bare lists the gates',
    positional: [{ name: 'name', help: 'gate name, then that gate\'s own args' }],
    flags: [], raw: true,
    example: 'vawe-dev check doc-refs',
    build: (v, args) => [{ script: 'harness/lib/check-gate.mjs', args }],
  },
  {
    name: 'judge', summary: 'prepare key frames and the rubric for a fresh session to score',
    positional: [{ name: 'page|mp4', required: true, kind: 'file', help: 'a page or a rendered mp4' }],
    flags: [
      { name: 'ref', type: 'path', help: 'reference mp4 (default: the reference the brief names)', kind: 'file' },
      { name: 'struct', type: 'bool', help: 'add the structure pass' },
      { name: 'runs', type: 'string', help: 'double-run labels, for example A,B' },
      { name: 'verdict', type: 'string', help: 'record PASS or FIX; writes out/<name>.judge.json' },
      { name: 'at', type: 'number', help: 'with a FIX verdict: the second of the top fix' },
      { name: 'top-fix', type: 'string', help: 'with a FIX verdict: the one concrete fix' },
      { name: 'fresh', type: 'bool', help: 'score now with a separate headless claude session (Read tool only); about 30 s; advises, never blocks' },
      { name: 'brief', type: 'path', help: 'with --fresh: the brief the judge reads', kind: 'file' },
      { name: 'stage', type: 'string', help: 'with --fresh: stills, draft or final' },
    ],
    defaultRef: (v, [input]) => (v.fresh || v.verdict ? null : input),
    example: 'vawe-dev judge out/my-launch.mp4 --struct --runs A,B   |   vawe-dev judge --fresh films/x/page.html --brief films/x/brief.md',
    build: (v, [input]) => v.fresh ? [{ script: 'harness/media/judge-fresh.mjs', args: [input, ...opt('--brief', v.brief), ...opt('--stage', v.stage)] }] : [{ script: 'quality/gates/judge.mjs', args: [input, ...opt('--ref', v.ref), ...(v.struct ? ['--struct'] : []), ...opt('--runs', v.runs), ...opt('--verdict', v.verdict), ...opt('--at', v.at), ...opt('--top-fix', v['top-fix'])] }],
    next: (v) => (v.fresh ? 'read the report; fix the lines under 8, worst first' : 'judge returns at once; do not poll for it'),
  },
  {
    name: 'approve', summary: 'use when the owner signs off the full draft of a page: vawe ship needs it; a film session never runs this',
    positional: [PAGE],
    flags: [
      ASPECT_FLAG,
      PARAM,
      { name: 'reject', type: 'bool', help: 'record that the owner rejects the draft, and withdraw any approval' },
      { name: 'note', type: 'string', default: 'none', help: 'the owner\'s reason, kept in the run log' },
    ],
    example: 'vawe-dev approve films/my-launch/page.html   (after vawe dev without --from and --to)',
    build: (v, [page]) => (needsPage(v, page, 'approve'), [{ script: 'harness/live/approve.mjs', args: [page, ...(v.reject ? ['--reject'] : []), ...opt('--note', v.note)] }]),
    next: (v, [page]) => `bin/vawe ship ${page}${paramsFlags(renderEnv(v))}`,
  },
];
