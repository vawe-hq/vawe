// The live hooks harness/README.md ("Hooks") asks each user to register, and the advice lines `vawe-dev doctor` prints for the missing ones.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const LIVE_HOOKS = [
  { file: 'log-read.mjs', event: 'PostToolUse', matcher: 'Read', why: 'logs the images you Read, so vawe-dev runs can say what was looked at' },
  { file: 'verb-hint.mjs', event: 'PreToolUse', matcher: 'Bash', why: 'names the verb when a command does by hand what a verb does' },
  { file: 'no-blanket-git.mjs', event: 'PreToolUse', matcher: 'Bash|Write|Edit|NotebookEdit', why: 'refuses a blanket git command, and an agent approving its own plan or draft' },
  { file: 'stage-say.mjs', event: 'UserPromptSubmit', matcher: null, why: 'names the next command for the film you edited last' },
  { file: 'stage-say.mjs', args: '--after-tool', event: 'PostToolUse', matcher: 'Bash', why: 'names the next command after a vawe verb, the only way a subagent hears it' },
];

const commandOf = (h) => `node harness/live/${h.file}${h.args ? ` ${h.args}` : ''}`;

const SETTINGS_FILES = ['.claude/settings.json', '.claude/settings.local.json'];

function readSettings(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

const covers = (groupMatcher, wanted) => !groupMatcher || groupMatcher === '*' || !wanted || wanted.split('|').every((m) => groupMatcher.split('|').includes(m));
const commandsOf = (settings, event, matcher) => (settings.hooks?.[event] ?? []).filter((group) => covers(group.matcher, matcher)).flatMap((group) => (group.hooks ?? []).map((h) => h.command ?? ''));

/** The main checkout of a worktree (Claude Code runs its hooks, a worktree has no settings of its own), or null outside git. */
function mainCheckout(root) {
  const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? path.dirname(r.stdout.trim()) : null;
}

/** The settings files that exist or may hold a hook: the project's, its main checkout's and the user's, settings.json and settings.local.json. */
export const settingsPaths = (root, home = os.homedir()) => [...new Set([root, mainCheckout(root), home].filter(Boolean))].flatMap((base) => SETTINGS_FILES.map((f) => path.join(base, f)));

/** The live hooks no settings file registers (a command that names harness/live/<file> on the right event, under a matcher that covers the hook's tools, counts). */
export function missingHooks(root, home = os.homedir()) {
  const all = settingsPaths(root, home).map(readSettings);
  return LIVE_HOOKS.filter((h) => !all.some((s) => commandsOf(s, h.event, h.matcher).some((c) => c.includes(`harness/live/${h.file}`) && (!h.args || c.includes(h.args)))));
}

/** One advice line per missing hook, with the JSON to add to .claude/settings.json. */
export const hookAdvice = (missing) => missing.map((h) => {
  const group = { ...(h.matcher ? { matcher: h.matcher } : {}), hooks: [{ type: 'command', command: commandOf(h) }] };
  return `advice: hook ${h.file}${h.args ? ` ${h.args}` : ''} is not registered (${h.why}); add to .claude/settings.json: ${JSON.stringify({ hooks: { [h.event]: [group] } })}`;
});
