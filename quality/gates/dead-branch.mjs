// dead-branch.mjs: a branch that can never be taken, or two branches that do the same thing.
//
//   node quality/gates/dead-branch.mjs      ·   vawe-dev check dead-branch
//
// `deploySuccess` shipped `i === last ? T.green : T.green`. A ternary whose arms are identical, next
// to a condition that was always true. Between them the cascade the block exists for was unreachable,
// and NO render gate could ever catch it: the output was valid, deterministic and wrong-by-omission.
// That is a linter's job, and this repo has one dependency and intends to keep it that way, so this is
// the cheap half done honestly rather than a linter added for one rule.
//
// WHAT IT CATCHES:
//   1. SYNTACTIC, `cond ? X : X`, both arms textually identical after normalising space.
//   2. DATAFLOW. A name that is BOUND and then never mentioned again in its own file: a value
//      computed and discarded, a destructured prop read and dropped. Plus a condition whose operands
//      are all constants, so the branch cannot vary.
//
// WHAT IT STILL DOES NOT: the multi-hop case (`const done = i < n-1` … later `done || i === n-1`),
// where the condition is invariant only after propagating a non-constant expression through another
// binding. That needs a real dataflow engine over a real AST; this repo has one dependency and intends
// to keep it. Stated rather than implied, because a gate whose limits are unwritten gets trusted past
// them.
//
// THE MEASUREMENT UNDERNEATH RULE 2, stated because a gate's blind spot is never in the rule it
// states: "never mentioned again" is decided by counting word-boundary occurrences of the identifier
// in the WHOLE FILE, raw text included. Comments and strings count as mentions. That is deliberately
// the over-counting direction. A shadowed name in two scopes, a name referenced only from a template
// literal, a name mentioned only in a comment: all count as used, so all are MISSED rather than
// invented. Exactly one occurrence means no scope in the file can possibly read it.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gateFindings } from '../../harness/lib/findings.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// THE SCAN SURFACE IS DISCOVERED, NOT LISTED. It used to be `['core','blocks','scripts','verify']`,
// which is a map of where the code lived the day the gate was written. `films/`, `sims/`, `mcp/`
// and `site/` were never read, so a dead branch there was invisible by construction and the gate
// reported "256 source files" as though that were all of them. core/props.js records the same flaw
// turning into 1482 false findings in a sibling gate; here it produced silence instead, which is
// harder to notice and no better. Now: every tracked .js/.mjs file, minus directories excluded BY
// REASON below. A directory added tomorrow is in scope tomorrow.
const EXCLUDED_DIRS = [
  ['node_modules/', 'vendored'],
  ['assets/vendor/', 'vendored third-party bundles, minified and not ours to edit'],
  ['out/', 'render output'],
];

const files = cp.execSync('git ls-files', { cwd: repoRoot }).toString().trim().split('\n')
  .filter((f) => /\.(mjs|js)$/.test(f))
  .filter((f) => !EXCLUDED_DIRS.some(([p]) => f.startsWith(p)))
  .map((f) => path.join(repoRoot, f))
  .filter((f) => fs.existsSync(f))
  .sort();

const norm = (s) => s.trim().replace(/\s+/g, ' ');
// a ternary's two arms, kept deliberately narrow: no nested ?/: inside either arm, so a complex
// expression is skipped rather than mis-parsed. Missing a real one is better than inventing one.
// `(?<!\?)\?(?![?.])`: a single `?`, never the `??` of a nullish coalesce and never the `?.` of an
// optional chain. Without the first guard, `a ?? 0 : 0` matched from the SECOND question mark and
// reported two identical arms that are not a ternary at all. Without the second,
// `node?.nodeType === 1 ? node : node?.parentElement` matched from the `?` of `node?.` and reported
// two identical arms cut out of the middle of an expression.
const TERNARY = /(?<!\?)\?(?![?.])\s*([^?:;{}]{1,90}?)\s*:\s*([^?:;{},)\n]{1,90})/g;
const balanced = (s) => (s.match(/'/g) || []).length % 2 === 0 && (s.match(/"/g) || []).length % 2 === 0
  && (s.match(/`/g) || []).length % 2 === 0 && (s.match(/\(/g) || []).length === (s.match(/\)/g) || []).length;

// Excluded BY REASON, never by convenience. Both files QUOTE the patterns this gate hunts, one to
// document them, one to inject them as fixtures, so both would be flagged for text that is a
// quotation, not a defect. The same two exclusions cover the dataflow rules below,
// for the same reason: gate-mutation injects an unused binding and a constant condition on purpose.
const EXCLUDED = (fp) => fp.endsWith(path.join('gates', 'dead-branch.mjs')) || fp.endsWith(path.join('gates', 'gate-mutation.mjs'));

const hits = [];
for (const fp of files) {
  if (EXCLUDED(fp)) continue;
  const src = fs.readFileSync(fp, 'utf8');
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;                            // comments quote examples
    for (const m of line.matchAll(TERNARY)) {
      const a = norm(m[1]), b = norm(m[2]);
      if (!a || !b || a !== b) continue;
      if (!balanced(a) || !balanced(b)) continue;
      hits.push({ file: path.relative(repoRoot, fp), line: i + 1, arm: a, text: norm(line).slice(0, 100) });
    }
  });
}

// ─────────────────────────────────────────────────────────── 2. dataflow: bound, then never read
//
// Three binding shapes, one mechanism. Each is matched over the WHOLE file text rather than line by
// line, because the destructures that matter most here (a block factory's prop bag) routinely wrap
// across lines, and a line-scoped scan would have silently exempted precisely the code this rule
// exists for. The sampling blind spot, not the rule, is where a gate goes wrong.
const RESERVED = new Set(['true', 'false', 'null', 'undefined', 'this', 'arguments', 'void', 'typeof', 'new', 'in', 'of']);

/** Bound names inside one `{ … }` destructuring pattern. `a`, `b: c`, `d = x`, `...r` → a, c, d, r. */
const boundNames = (inner) => inner.split(',').map((s) => {
  s = s.trim().replace(/^\.\.\./, '');
  const c = s.indexOf(':'); if (c >= 0) s = s.slice(c + 1);   // `key: binding`, the BINDING is on the right
  const eq = s.indexOf('='); if (eq >= 0) s = s.slice(0, eq); // a default value is a reference, not a binding
  return s.trim();
}).filter((s) => /^[A-Za-z_$][\w$]*$/.test(s) && !RESERVED.has(s));

const BINDINGS = [
  // `const x = …` / `let x = …`
  { kind: 'value computed and never read', re: /(?:^|[;{}\s])(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/g, names: (m) => [m[1]] },
  // `const { a, b } = …`
  { kind: 'destructured and never read', re: /(?:const|let)\s*\{([^{}]*)\}\s*=/g, names: (m) => boundNames(m[1]) },
  // `const a = 1, b = 2`: the SECOND declarator. `const W = 1080, H = 1920;` had two dead constants
  // and the rule above reported one, because it stops at the first name. The first initializer must
  // contain no comma or bracket, so there is no call argument list for the comma to be hiding inside.
  { kind: 'value computed and never read', re: /(?:const|let)\s+[A-Za-z_$][\w$]*\s*=\s*[^,;(){}[\]\n]+,\s*([A-Za-z_$][\w$]*)\s*=/g, names: (m) => [m[1]] },
  // a destructured object PARAMETER of a function definition: "a prop read and then discarded".
  // The trailing `=>` or `{` is what separates a definition from a call site: `launch({ headless: true })`
  // is followed by `)` and `;`, never by a function body. Without that anchor the first draft read
  // every options object at every call site as a parameter list and reported `true` as a dead binding.
  { kind: 'prop accepted and never read', re: /(?:function\s*[A-Za-z_$][\w$]*\s*\(|function\s*\(|\()\s*\{([^{}]*)\}\s*(?:=[^)]*?)?\)\s*(?:=>|\{)/g, names: (m) => boundNames(m[1]) },
];

// A condition whose operands are all constant cannot choose anything. Single hop only: two literals,
// or a module-scope const that is itself bound to a literal.
//
// ANCHORED ON THE WHOLE CONDITION (`if (…)` / `while (…)` and nothing else) and this is the entire
// design of the rule, not a detail. The first version matched a comparison ANYWHERE and reported
// `2 === 0` inside `Math.floor(x * 2.2) % 2 === 0`, `1080 > 0.85` inside `(y1 - y0) / 1080 > 0.85`,
// and a `<` that was a character in a string array. A regex cannot see operator precedence or string
// boundaries, so the only trustworthy anchor is one where the parenthesis says where the expression
// starts and ends: if the full contents of the `if (…)` are a bare token, an operator and a bare
// token, there is nothing for precedence to change. Eight false positives before the anchor, zero
// after. A gate that cries wolf gets skimmed and takes its real findings with it (#85, #90).
const LITERAL = /^(?:-?\d+(?:\.\d+)?|'[^']*'|"[^"]*"|true|false|null|undefined)$/;
const TOKEN = String.raw`[A-Za-z_$][\w$]*|-?\d+(?:\.\d+)?|'[^']*'|"[^"]*"`;
const CONDITION = new RegExp(String.raw`\b(?:if|while)\s*\(\s*(${TOKEN})\s*(===|!==|==|!=|<=|>=|<|>)\s*(${TOKEN})\s*\)`, 'g');

const lineAt = (src, idx) => src.slice(0, idx).split('\n').length;
const lineText = (src, idx) => src.split('\n')[lineAt(src, idx) - 1] || '';
const isCommented = (src, idx) => {
  const l = lineText(src, idx);
  if (/^\s*(\/\/|\*|\/\*)/.test(l)) return true;
  const col = idx - src.lastIndexOf('\n', idx - 1) - 1;
  const slashes = l.indexOf('//');
  return slashes >= 0 && slashes < col;
};

const dataflow = [];
for (const fp of files) {
  if (EXCLUDED(fp)) continue;
  const src = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(repoRoot, fp);
  const mentions = (id) => (src.match(new RegExp(`\\b${id}\\b`, 'g')) || []).length;

  for (const B of BINDINGS) {
    for (const m of src.matchAll(B.re)) {
      // the `(?:^|[;{}\s])` lead-in can be the previous line's newline, which would report the
      // declaration one line early, address the keyword itself, not the match start.
      const at = m.index + Math.max(0, m[0].search(/[A-Za-z_$({]/));
      if (isCommented(src, at)) continue;
      // An exported name is read by other files; nothing in THIS file's text can prove it dead.
      if (/^\s*export\b/.test(lineText(src, at))) continue;
      for (const id of B.names(m)) {
        if (mentions(id) !== 1) continue;
        dataflow.push({ file: rel, line: lineAt(src, at), why: B.kind, name: id, text: norm(lineText(src, at)).slice(0, 100) });
      }
    }
  }

  // module-scope `const NAME = <literal>`: the only bindings the constant-condition rule will trust
  const constLit = new Map();
  for (const m of src.matchAll(/^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+);/gm)) {
    const v = m[2].trim();
    if (LITERAL.test(v)) constLit.set(m[1], v);
  }
  const constant = (tok) => (LITERAL.test(tok) ? tok : constLit.get(tok));
  for (const m of src.matchAll(CONDITION)) {
    if (isCommented(src, m.index)) continue;
    const a = constant(m[1]), b = constant(m[3]);
    if (!a || !b) continue;
    dataflow.push({ file: rel, line: lineAt(src, m.index), why: `condition cannot vary, \`${a} ${m[2]} ${b}\` is decided at author time`, name: norm(m[0]), text: norm(lineText(src, m.index)).slice(0, 100) });
  }
}

console.log(`── dead branch · ${files.length} source file(s)\n`);

const f = gateFindings({ line: (r) => `   ${r.at}  ${r.code === 'identical-arms' ? `both arms are \`${r.arm}\`` : `\`${r.name}\`, ${r.why}`}\n       ${r.summary}` });
if (!hits.length) console.log('✓ no ternary has identical arms');
for (const h of hits) f.fail('identical-arms', h.text, { at: `${h.file}:${h.line}`, arm: h.arm });
if (!dataflow.length) console.log('✓ no value is computed and then discarded, and no condition is decided at author time');
for (const d of dataflow) f.fail('dead-branch', d.text, { at: `${d.file}:${d.line}`, name: d.name, why: d.why });

f.emit();
if (hits.length || dataflow.length) {
  console.log(`\n✗ ${hits.length + dataflow.length} place(s) where the code decides nothing. A render gate cannot see this:`);
  console.log('  the output is valid, deterministic, and wrong by omission.');
}
process.exit(f.records.some((r) => r.severity === 'error') ? 1 : 0);
