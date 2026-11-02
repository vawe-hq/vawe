// quality/gates/doc-refs.mjs · every command and every file path the docs NAME must exist.
//
//   node quality/gates/doc-refs.mjs      ·   make check GATE=doc-refs
//
// WHY THIS EXISTS: docs are read as instructions. A wrong instruction is worse than a missing one,
// because an author trusts it, types it, gets "No rule to make target", and learns to distrust the
// whole file. CLAUDE.md alone names ~40 make targets and ~60 repo paths, all hand-typed, all
// describing a Makefile and a tree that move under them. `craft-coverage`/`doc-map` already resolve
// markdown links to `.md` files. Nothing checked a single `make …` command, a backticked source path
// (`core/layout/safe.js`), a skill directory, or a link to a non-markdown file. This does.
//
// SCAN SURFACE IS DISCOVERED, NEVER LISTED. `git ls-files '*.md'` minus a few directories excluded
// BY REASON below. A gate whose surface is a hardcoded array is a map of where the docs lived the day
// it was written (core/props.js records how that same flaw produced 1482 false findings elsewhere).
//
// THE MEASUREMENT, stated because a gate's blind spot is never in the rule it states:
//   * Only text inside a code span (`…`) or a fenced code block is read for `make <target>`. English
//     prose contains "make sure", "make it good", "make a video"; none of those are commands, and a
//     gate that reported them would be skimmed and would take its real findings with it. The cost is
//     stated plainly: an un-backticked command citation is MISSED, not invented. Docs here backtick
//     their commands, so the miss is small and the direction is the safe one.
//   * A path is a candidate only when it contains `/` and either ends in a known extension or ends
//     in `/`. Placeholders (`<topic>`, `${x}`, `…`) are skipped, never guessed at.
//   * A path resolves if GIT TRACKS it relative to the repo root OR relative to the citing doc. Both
//     conventions are in use here, and a gate may not pick a favourite. Tracked, not merely present on
//     disk: a path can exist on the author's machine, gitignored or simply never `git add`ed, and pass
//     here while a fresh clone has nothing at that path. Comparing exact git-stored strings also makes
//     this case-sensitive, where a filesystem check quietly was not.
//   * A cited path that git does not track ON PURPOSE (a generated artefact, a gitignored brand asset)
//     is not a failure: it is looked up in `KNOWN_UNTRACKED`, a short list that costs a reason per
//     entry, and printed as known-untracked instead. Nothing else lets a doc opt out of this check.
// Pure: reads files and the Makefile, and runs `git ls-files` (read-only). No render, no network.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gateFindings } from '../../harness/lib/findings.mjs';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { DEV_VERBS } from '../../harness/dev/verbs.mjs';
import { GATES } from '../../harness/lib/check-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Excluded BY REASON. Each of these describes a tree that is not this repo's Makefile or layout, so a
// path inside it is not a claim about this repo and cannot be checked here.
const EXCLUDED = [
  ['node_modules/', 'vendored'],
  ['out/', 'render output, not authored prose'],
  ['.claude/plans/', 'a dated record of what was planned, not an instruction. It describes a tree that was proposed and may never have been built'],
];

// `--others --exclude-standard` puts UNTRACKED work in scope. A plain `git ls-files` checks only what
// is already committed, so a doc written this session is judged one commit too late, which is the one
// moment the author could still fix it cheaply.
const listed = (glob) => cp.execSync(`git ls-files --cached --others --exclude-standard '${glob}'`, { cwd: ROOT })
  .toString().trim().split('\n').filter(Boolean).filter((f) => !EXCLUDED.some(([p]) => f.startsWith(p)));

const ONLY = process.argv.slice(2).filter((a) => a.endsWith('.md'));
const docs = () => (ONLY.length ? ONLY : listed('*.md'));

// THE TRACKED SET: what a fresh clone actually has. A cited path can exist on the author's own disk
// and still be gitignored or simply never `git add`ed, and the recent curation untracked several films
// the docs still name; that passed here and failed only when someone else cloned the repo, which is the
// one moment nobody was watching. Read once, exact case, so a path check answers "does a clone have
// this" instead of "does this machine have this".
const TRACKED = new Set(cp.execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean));

// ── the truth side ───────────────────────────────────────────────────────────────────────────────
// Every target the Makefile defines, read from the Makefile. `.PHONY:` is a declaration, not a target.
function makeTargets() {
  const mk = fs.readFileSync(path.join(ROOT, 'Makefile'), 'utf8');
  const out = new Set();
  for (const line of mk.split('\n')) {
    const m = /^([A-Za-z0-9_][A-Za-z0-9_.-]*)\s*:(?!=)/.exec(line);
    if (m) out.add(m[1]);
    const phony = /^\.PHONY\s*:(.*)$/.exec(line);
    if (phony) for (const t of phony[1].trim().split(/\s+/)) if (t) out.add(t);
  }
  out.delete('.PHONY');
  return out;
}

/**
 * Script paths written inside a source file. Two shapes, one rule, and the second shape is the one
 * that mattered:
 *
 *   1. `node scripts/x.mjs` in a usage string, a header comment, a runbook line. A usage string is
 *      what a tool prints when you get its arguments wrong, so it is read at the exact moment the
 *      author is already unsure. Moving the scripts into `harness/author|brand|gates|media|site/`
 *      left 111 of these naming a path that had not existed since the move.
 *   2. A QUOTED path handed to a child process: `spawnSync('node', ['harness/lib-test.mjs'])`.
 *      `quality/gates/review.mjs` had two, so `make gen X=review` had been failing two of its three checks on
 *      ERR_MODULE_NOT_FOUND. That is the worst version of this defect, because a health command that
 *      reports a failure looks like it is working. Nobody reads a red check twice.
 */
function selfRefs() {
  const RUN = /\bnode\s+((?:scripts|harness|quality|generators|research|core|blocks|tools|scene|films)\/[A-Za-z0-9_./-]+\.(?:mjs|js))/g;
  const QUOTED = /['"`]((?:scripts|harness|quality|generators|research|blocks|tools|scene|films)\/[A-Za-z0-9_./-]+\.(?:mjs|js))['"`]/g;
  const out = [];
  // This file QUOTES the patterns it hunts, in the comment above and in the header. Excluded by
  // reason, never by convenience: `dead-branch.mjs` carries the identical exclusion for the identical
  // reason, and a gate that reports its own worked examples teaches the reader to skim it.
  const SELF = path.join('gates', 'doc-refs.mjs');
  for (const rel of [...listed('*.mjs'), ...listed('*.js')]) {
    if (rel.endsWith(SELF)) continue;
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    fs.readFileSync(abs, 'utf8').split('\n').forEach((line, i) => {
      for (const re of [RUN, QUOTED]) {
        for (const m of line.matchAll(re)) {
          if (!fs.existsSync(path.join(ROOT, m[1]))) out.push({ rel, line: i + 1, ref: m[1] });
        }
      }
    });
  }
  const key = (o) => `${o.rel}:${o.line}:${o.ref}`;
  return [...new Map(out.map((o) => [key(o), o])).values()];
}

/**
 * Every `node <script>` a Makefile recipe runs, as {target, script}.
 *
 * A target that EXISTS and runs a script that does not is worse than a missing target: `make` prints
 * no error of its own, node prints ERR_MODULE_NOT_FOUND, and the author reads it as their mistake.
 * `cut six tools that never produced a frame` deleted `harness/author/animatic.mjs` and left the
 * `animatic` target standing, so the docs pointed at a live target that could not run. Checking the
 * target name alone would have called that green.
 */
function makeRecipes() {
  const mk = fs.readFileSync(path.join(ROOT, 'Makefile'), 'utf8');
  const out = [];
  let target = null;
  mk.split('\n').forEach((line, i) => {
    const t = /^([A-Za-z0-9_][A-Za-z0-9_.-]*)\s*:(?!=)/.exec(line);
    if (t) { target = t[1]; return; }
    if (!/^\t/.test(line)) { if (line.trim()) target = null; return; }
    if (!target) return;
    for (const m of line.matchAll(/\bnode\s+((?:scripts|harness|quality|generators|research|core|blocks|tools|scene|films)\/[A-Za-z0-9_./-]+\.(?:mjs|js))/g)) {
      out.push({ target, script: m[1], line: i + 1 });
    }
  });
  return out;
}

// ── extraction ───────────────────────────────────────────────────────────────────────────────────
/** Every code span and fenced block in a markdown file, as {text, line}. */
function codeChunks(src) {
  const lines = src.split('\n');
  const chunks = [];
  let fenced = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return; }
    if (fenced) { chunks.push({ text: line, line: i + 1 }); return; }
    for (const m of line.matchAll(/`([^`\n]+)`/g)) chunks.push({ text: m[1], line: i + 1 });
  });
  return chunks;
}

// `make dev-tool X=beats D=<file>` → ['beats']. THE FIRST TOKEN ONLY, and that is the whole rule.
// A draft that consumed every following bare word read `→ make media X=vo-captions builds timed caption`
// inside a JSON comment and reported `make builds` and `make timed` as missing targets. They are
// English. Docs invoke one target at a time; a chained `make a b` is a build-script shape, not a
// documentation shape, so the second target is MISSED rather than the sentence after it INVENTED.
function targetsIn(text) {
  const found = [];
  for (const m of text.matchAll(/\bmake\s+([a-z][a-z0-9-]*)\b/g)) found.push(m[1]);
  return found;
}

// `vawe dev <page>` names a verb; `vawe check <gate>` names a gate; the flags after a verb are that verb's own.
// Both come from the CLI's own tables. A flag is read up to the next `vawe`, `|` or `;`, so the prose after a command is not judged.
const COMMAND = /(?:^|\bbin\/|[$&;|]\s*)(vawe(?:-dev)?)\s+([a-z][a-z0-9-]*)(?:\s+([a-z][a-z0-9-]*))?([^|;`\n]*)/g;
const TABLES = { vawe: VERBS, 'vawe-dev': DEV_VERBS };
function vawesIn(text) {
  const bad = [];
  for (const m of text.matchAll(COMMAND)) {
    const [, bin, name, second = '', tail] = m;
    const verb = TABLES[bin].find((v) => v.name === name);
    if (!verb) { bad.push(`${bin} ${name}`); continue; }
    if (name === 'check' && second && !GATES[second] && !/^(?:name|gate)$/.test(second)) bad.push(`${bin} check ${second}`);
    if (verb.raw) continue;
    const known = new Set((verb.flags ?? []).map((f) => f.name));
    const rest = `${second}${tail}`.split(/\bvawe\b/)[0];
    for (const flag of rest.matchAll(/(?:^|\s)--([a-z][a-z0-9-]*)/g)) if (!known.has(flag[1]) && !/^(?:help|flag|flags)$/.test(flag[1])) bad.push(`${bin} ${name} --${flag[1]}`);
  }
  return bad;
}

// WHAT A CITED PATH HAS TO LOOK LIKE BEFORE THIS GATE WILL JUDGE IT. Three filters, each one paid
// for by a batch of findings that were all correct prose:
//   * A SOURCE OR DOC EXTENSION. `out/brew-launch.mp4`, `assets/music.wav`, `refs/ref.mp4` are render
//     output and author-supplied media. They are named as EXAMPLES of what you would pass in, and no
//     tree ever contains them. 31 such findings, every one of them wrong.
//   * NOT A BARE DIRECTORY. README's tree diagram lists `gates/`, `brand/`, `CRAFT/` indented under a
//     parent. The indentation carries the parent, the token does not, so the token is unresolvable by
//     construction and reporting it says nothing.
//   * A FIRST SEGMENT GIT ALREADY TRACKS. `path/to/video.json` and `scratchpad/x.json` are stand-ins
//     for the reader's own file. `src/App.tsx` is somebody else's project. A repo-relative claim
//     starts at a directory this repo has.
// Globs are skipped whole: `films/*/sample.json` is a pattern, and a pattern that matches nothing
// today is a fact about today's tree, not an error in the sentence.
const EXT = /\.(md|mjs|js|cjs|json|ts|tsx|jsx|html|css|go|sh|py)$/i;
const PLACEHOLDER = /[<>{}$…|"'()\[\]*]|\.\.\./;

/** Path-looking tokens in a piece of text. Deliberately narrow; see above. */
function pathsIn(text, roots) {
  const out = [];
  for (let tok of text.split(/[\s,;`]+/)) {
    tok = tok.replace(/[).,;:]+$/, '').replace(/:\d+(?:-\d+)?$/, '');
    if (!tok || !tok.includes('/')) continue;
    if (/^(?:https?:|mailto:|\/\/)/.test(tok)) continue;
    if (tok.startsWith('#')) continue;
    if (PLACEHOLDER.test(tok)) continue;
    if (!/^[A-Za-z0-9_.@][A-Za-z0-9_./-]*$/.test(tok)) continue;
    if (!EXT.test(tok)) continue;
    if (!roots.has(tok.replace(/^\.\.\//, '').split('/')[0])) continue;
    out.push(tok);
  }
  return out;
}

/** Top-level names git tracks. Discovered, so a new directory is in scope the day it lands. */
function repoRoots() {
  return new Set([...TRACKED].map((f) => f.split('/')[0]));
}

/**
 * Markdown link targets that are not `.md` (doc-map already owns `.md` links) and not URLs.
 * The targets run through the SAME filters as a backticked path. Without that, the template line
 * `[name](url): one-line note` reported `url` as a missing file, which is the gate reading a
 * worked example of markdown syntax as a claim about the tree.
 */
function linkPathsIn(line, roots) {
  const out = [];
  for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
    const t = m[1].replace(/^[`<]|[`>]$/g, '').split('#')[0];
    if (!t || /^https?:|^mailto:|^#/.test(t) || t.endsWith('.md')) continue;
    out.push(...pathsIn(t, roots));
  }
  return out;
}

/**
 * A doc may NAME a thing in order to say the thing does not exist. `guides/judge.md` records that
 * `CRAFT/AB-JUDGE.md` was never written; `SUBAGENTS.md` says in the same breath that there is no
 * `make ab`. Reporting those is the gate arguing with prose that is already correct, and a gate that
 * argues with correct prose is one an author learns to skip. So a doc may waive one reference, per
 * file, with a reason it has to type:
 *
 *   <!-- doc-refs-allow: make ab · the row documents a critic that was planned and never built -->
 *
 * A waiver with no reason does not count. That is the whole enforcement: it costs a sentence, so it
 * is never the cheap way out of a real finding.
 */
function waiversIn(src) {
  const out = new Set();
  for (const m of src.matchAll(/<!--\s*doc-refs-allow:\s*(make\s+[a-z0-9-]+|[^\s·]+)\s*·\s*([^>]*?)\s*-->/g)) {
    if (m[2].trim().length >= 12) out.add(m[1].replace(/\s+/g, ' '));
  }
  return out;
}

/**
 * KNOWN UNTRACKED: a path a doc correctly cites that git does not track, on purpose. Not a blanket
 * ignore and not a way for a doc to opt out by wording (that is `waiversIn`, and it waives a citation,
 * never a whole path shape), one entry per shape of untracked-on-purpose file, each with a reason, so
 * the gate can tell "the recipe check-in that started this fix" apart from "a gitignored brand asset the
 * docs must still be able to name". A hit here prints as known-untracked; it never fails the gate.
 */
const KNOWN_UNTRACKED = [
  { pattern: /^films\/hello\//, reason: 'the quickstart\'s example film, created by `bin/vawe new hello`' },
  { pattern: /^assets\/music\/[^/]+\.beats\.json$/, reason: 'generated by `make dev-tool X=beats`; regenerable, never a source file' },
  { pattern: /^themes\/(stripe|linear|higgsfield)\.json$/, reason: 'a real brand\'s recreated palette; gitignored on purpose (.gitignore) so it stays local and is never redistributed' },
  { pattern: /^quality\/runs\/e2e\/latest\.json$/, reason: 'generated by `make e2e`; gitignored scratch, absent until the suite has run once' },
];
const knownUntracked = (rel) => KNOWN_UNTRACKED.find(({ pattern }) => pattern.test(rel));

/**
 * A path resolves if a fresh clone would have it: tracked from the repo root, or tracked relative to
 * the citing doc's directory (both conventions are in use here). Filesystem existence is NOT the
 * question: a path can sit on this machine's disk, gitignored or simply never committed, and that
 * tells a clone nothing. Comparing against `TRACKED`, a `Set` of exact git-stored strings, is also what
 * makes this exact-case: `design.md` no longer resolves against a tracked `DESIGN.md`, which a
 * case-insensitive filesystem used to hide.
 */
function resolves(rel, fromDoc) {
  const bases = [ROOT, path.dirname(path.join(ROOT, fromDoc))];
  return bases.some((b) => {
    const abs = path.resolve(b, rel);
    if (!abs.startsWith(ROOT)) return false;
    return TRACKED.has(path.relative(ROOT, abs));
  });
}

// ── the run ──────────────────────────────────────────────────────────────────────────────────────
export function run() {
  const targets = makeTargets();
  const roots = repoRoots();
  const badTargets = [];
  const badPaths = [];
  const untracked = [];
  let scanned = 0;

  const checkPath = (p, rel, line, text) => {
    if (resolves(p, rel)) return;
    const ku = knownUntracked(p);
    if (ku) { untracked.push({ rel, line, ref: p, reason: ku.reason }); return; }
    badPaths.push({ rel, line, ref: p, text });
  };

  for (const rel of docs()) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    scanned++;
    const src = fs.readFileSync(abs, 'utf8');
    const waived = waiversIn(src);

    for (const { text, line } of codeChunks(src)) {
      for (const t of targetsIn(text)) {
        if (!targets.has(t) && !waived.has(`make ${t}`)) badTargets.push({ rel, line, target: t, text: text.trim().slice(0, 90) });
      }
      for (const p of pathsIn(text, roots)) {
        if (!waived.has(p)) checkPath(p, rel, line, text.trim().slice(0, 90));
      }
      for (const v of vawesIn(text)) {
        if (!waived.has(v)) badTargets.push({ rel, line, target: v, text: text.trim().slice(0, 90), vawe: true });
      }
    }
    src.split('\n').forEach((line, i) => {
      for (const p of linkPathsIn(line, roots)) {
        if (!waived.has(p)) checkPath(p, rel, i + 1, line.trim().slice(0, 90));
      }
    });
  }

  const recipes = makeRecipes();
  const badRecipes = recipes.filter((r) => !fs.existsSync(path.join(ROOT, r.script)));
  const badSelfRefs = ONLY.length ? [] : selfRefs();

  const key = (o) => `${o.rel}:${o.line}:${o.target || o.ref}`;
  const dedupe = (a) => [...new Map(a.map((o) => [key(o), o])).values()];
  return {
    scanned, targets: targets.size, recipes: recipes.length,
    badTargets: dedupe(badTargets), badPaths: dedupe(badPaths), badRecipes, badSelfRefs,
    untracked: dedupe(untracked),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const r = run();
  const f = gateFindings();
  console.log(`── doc refs · ${r.scanned} markdown file(s) · ${r.targets} make target(s) · ${r.recipes} recipe script(s)\n`);
  if (!r.badRecipes.length) console.log('✓ every Makefile recipe runs a script that exists');
  for (const b of r.badRecipes) {
    console.log(`   ✗ Makefile:${b.line}  \`make ${b.target}\` runs ${b.script}, which does not exist`);
    console.log('       the target answers, the script does not. An author reads node\'s error as their own mistake.');
    f.fail('doc-refs-recipe', `Makefile:${b.line}  \`make ${b.target}\` runs ${b.script}, which does not exist`,
      { at: `Makefile:${b.line}` });
  }
  if (!r.badTargets.length) console.log('✓ every `make <target>` the docs name exists in the Makefile');
  for (const b of r.badTargets) {
    const what = b.vawe ? `\`${b.target}\`: no such verb or gate` : `\`make ${b.target}\`: no such Makefile target`;
    console.log(`   ✗ ${b.rel}:${b.line}  ${what}`);
    console.log(`       ${b.text}`);
    f.fail('doc-refs-target', `${b.rel}:${b.line}  ${what}`,
      { at: `${b.rel}:${b.line}` });
  }
  if (!r.badSelfRefs.length) console.log('✓ every `node <script>` a source file prints or documents exists');
  for (const b of r.badSelfRefs) {
    console.log(`   ✗ ${b.rel}:${b.line}  prints \`node ${b.ref}\`, which does not exist`);
    f.fail('doc-refs-self-ref', `${b.rel}:${b.line}  prints \`node ${b.ref}\`, which does not exist`,
      { at: `${b.rel}:${b.line}` });
  }
  for (const b of r.untracked) {
    console.log(`   · known untracked ${b.rel}:${b.line}  ${b.ref}: ${b.reason}`);
  }
  if (!r.badPaths.length) console.log('✓ every repo path the docs cite is tracked (or a known-untracked exception)');
  for (const b of r.badPaths) {
    console.log(`   ✗ ${b.rel}:${b.line}  ${b.ref}: no such file or directory`);
    console.log(`       ${b.text}`);
    f.fail('doc-refs-path', `${b.rel}:${b.line}  ${b.ref}: no such file or directory`,
      { at: `${b.rel}:${b.line}` });
  }
  const n = r.badTargets.length + r.badPaths.length + (ONLY.length ? 0 : r.badRecipes.length + r.badSelfRefs.length);
  if (!n) process.exit(0);
  console.log(`\n⚠ ${n} reference(s) the docs name and the repo does not have.`);
  console.log('  An author reads a doc as an instruction. Correct the doc, or build the thing it promises.');
  process.exit(ONLY.length ? 1 : 0);
}
