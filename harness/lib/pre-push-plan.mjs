// Pure parts of the pre-push hook (harness/dev/pre-push.mjs): which checks a set of changed files can affect, and the e2e cache key.
// The guards (push-guard, no-emdash, doc-refs, bench) always run and are not planned here.

export const CHECKS = ['unit', 'e2e'];

const RULES = [
  { re: /^(README|CONTRIBUTING)\.md$|^(LICENSE|NOTICE|context7\.json)$|^(guides|research|research_notes)\//, kind: 'docs', checks: [] },
  { re: /^(AGENTS|CLAUDE)\.md$|^(skills|prompts|taste)\/.*\.md$/, kind: 'agent docs', checks: ['unit'] },
  { re: /^(films|assets|resources)\//, kind: 'render input', checks: ['e2e'] },
  { re: /^(core|harness|quality|bin|themes|generators|vendor|studio|taste|tests|\.githooks|\.github)\/|^(package\.json|package-lock\.json|Makefile|\.chrome-version|\.oxlintrc\.json)$/, kind: 'engine', checks: ['unit', 'e2e'] },
];

const EXAMPLES = 3;

/**
 * The checks the changed files can affect: { checks: ['unit' | 'e2e'], reasons: { check: 'why' } }.
 * An empty list or a path no rule names runs every check.
 */
export function planChecks(files) {
  const chosen = new Map();
  const add = (check, kind, file) => {
    const why = chosen.get(check) ?? { kinds: new Set(), files: [] };
    why.kinds.add(kind);
    if (why.files.length < EXAMPLES) why.files.push(file);
    chosen.set(check, why);
  };
  if (!files.length) CHECKS.forEach((c) => add(c, 'no changed files known', '(none)'));
  for (const file of files) {
    const rule = RULES.find((r) => r.re.test(file));
    if (rule) rule.checks.forEach((c) => add(c, rule.kind, file));
    else CHECKS.forEach((c) => add(c, 'unknown path', file));
  }
  const checks = CHECKS.filter((c) => chosen.has(c));
  const reasons = Object.fromEntries(checks.map((c) => [c, `${[...chosen.get(c).kinds].join(', ')}: ${chosen.get(c).files.join(', ')}`]));
  return { checks, reasons };
}

const NOT_RENDER_INPUT = /^(guides|research|research_notes|skills|\.github)$|^[^/]*\.md$|^(LICENSE|NOTICE|context7\.json|\.oxlintrc\.json)$/;

/** The top-level entries of `git ls-tree HEAD` that can change a render: everything except a short list of dirs and files no render reads. */
export function renderEntries(lsTree) {
  return lsTree.split('\n').filter(Boolean).map((l) => ({ oid: l.split(/\s+/)[2], name: l.split('\t')[1] })).filter((e) => !NOT_RENDER_INPUT.test(e.name));
}

/** The e2e cache key: the object ids of those entries. Equal keys mean byte-equal render inputs in git. */
export const e2eKey = (lsTree) => renderEntries(lsTree).map((e) => `${e.name}:${e.oid}`).join('\n');
