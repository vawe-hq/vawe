// The live hooks harness/README.md ("Hooks") asks each user to register, and the advice lines `vawe doctor` prints for the missing ones.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const LIVE_HOOKS = [
  { file: 'log-read.mjs', event: 'PostToolUse', matcher: 'Read', why: 'logs the images you Read, so vawe runs can say what was looked at' },
  { file: 'verb-hint.mjs', event: 'PreToolUse', matcher: 'Bash', why: 'names the verb when a command does by hand what a verb does' },
  { file: 'stage-say.mjs', event: 'UserPromptSubmit', matcher: null, why: 'names the next command for the film you edited last' },
];

const SETTINGS_FILES = ['.claude/settings.json', '.claude/settings.local.json'];

function readSettings(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

const commandsOf = (settings, event) => (settings.hooks?.[event] ?? []).flatMap((group) => (group.hooks ?? []).map((h) => h.command ?? ''));

/** The settings files that exist or may hold a hook: the project's and the user's, settings.json and settings.local.json. */
export const settingsPaths = (root, home = os.homedir()) => [root, home].flatMap((base) => SETTINGS_FILES.map((f) => path.join(base, f)));

/** The live hooks no settings file registers (a command that names harness/live/<file> on the right event counts). */
export function missingHooks(root, home = os.homedir()) {
  const all = settingsPaths(root, home).map(readSettings);
  return LIVE_HOOKS.filter((h) => !all.some((s) => commandsOf(s, h.event).some((c) => c.includes(`harness/live/${h.file}`))));
}

/** One advice line per missing hook, with the JSON to add to .claude/settings.json. */
export const hookAdvice = (missing) => missing.map((h) => {
  const group = { ...(h.matcher ? { matcher: h.matcher } : {}), hooks: [{ type: 'command', command: `node harness/live/${h.file}` }] };
  return `advice: hook ${h.file} is not registered (${h.why}); add to .claude/settings.json: ${JSON.stringify({ hooks: { [h.event]: [group] } })}`;
});
