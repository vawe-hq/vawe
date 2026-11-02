#!/usr/bin/env node
// PreToolUse hook for Bash: when a command does by hand what a vawe verb already does, says which verb. Advice only: it never blocks (exit 0 always),
// and it names each verb at most once every HINT_EVERY_MS, so a loop of raw calls hears it once.
// Settings: matcher "Bash", command "node harness/live/verb-hint.mjs" (run from the repo root).
import fs from 'node:fs';
import { scratch } from '../lib/scratch.mjs';
import { POLL } from '../lib/shell-match.mjs';

const HINT_EVERY_MS = 30 * 60 * 1000;

// `legacy` matches the advice text of a transcript from before a verb merge, so the trace review still counts it.
export const RULES = [
  { id: 'shot', legacy: /bin\/vawe shot <route\|url\|page\.html> --w 1440,390/, test: /puppeteer|--screenshot=|playwright/, say: 'bin/vawe new --from-url <route|url|page.html> --w 1440,390 [--full] takes site and page screenshots at several widths (lazy images loaded, the dev server started and stopped for you, page errors and sideways overflow reported); bin/vawe new <name> --from-url <url> also starts a film from the site; do not write a screenshot script; to read the box, opacity and transform of an element at a second, bin/vawe see <page> --probe --sel <css> --at s' },
  { id: 'links', legacy: /for one page, bin\/vawe shot <route>/, test: /curl\b[^\n]*(%\{http_code\}|-w\b|-I\b)/, say: 'bin/vawe-dev check links [--base https://vawe.dev] crawls the site and lists broken links, redirects and dead #anchors with the page that links to each; for one page, bin/vawe new --from-url <route>' },
  { id: 'wait', test: POLL, say: 'bin/vawe wait <page|film> (for example bin/vawe wait films/my-launch/page.html, or bin/vawe wait my-launch) waits for a running draft, clip or final render and prints its result line; it returns after about 3.5 minutes with a STILL RUNNING line and a progress line a minute, so call it again; do not poll a render with sleep or ps' },
  { id: 'sheet', legacy: /bin\/vawe sheet <page\|mp4> --at s,s,s makes a labelled sheet/, test: /ffmpeg\b[^\n]*(tile=|xstack|hstack|vstack|select='?not\(mod)/, say: 'bin/vawe frame <page|mp4> --at s,s,s makes a labelled sheet of seconds; bin/vawe frame <page|mp4> --moment s shows one moment; bin/vawe frame <page|mp4> --vs <ref.mp4> puts a reference beside your frames' },
  { id: 'still', legacy: /bin\/vawe still <page\|mp4> --at s writes one exact/, test: /ffmpeg\b[^\n]*-ss\s+[\d.$]+[^\n]*(-frames:v|-vframes)\s+1/, say: 'bin/vawe frame <page|mp4> --at s writes one exact full-size frame (a page renders at its final size)' },
];

/** The advice for a command that does by hand what a verb does, as { id, say }, or null. Pure. */
export function hintFor(cmd) {
  return RULES.find((r) => r.test.test(cmd)) ?? null;
}

/** Whether `id` was named less than HINT_EVERY_MS before `now`, given the stamps { id: ms }. Pure. */
export const recentlyNamed = (stamps, id, now) => id in stamps && now - stamps[id] < HINT_EVERY_MS;

function main() {
  let raw = '';
  process.stdin.on('data', (d) => { raw += d; });
  process.stdin.on('end', () => {
    try {
      const hint = hintFor(JSON.parse(raw).tool_input?.command || '');
      if (!hint) return;
      const file = scratch('verb-hint', 'named.json');
      const stamps = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
      if (recentlyNamed(stamps, hint.id, Date.now())) return;
      fs.writeFileSync(file, JSON.stringify({ ...stamps, [hint.id]: Date.now() }));
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: `vawe has a verb for this: ${hint.say}. The command runs anyway.` } }));
    } catch { /* a hook never fails the tool call */ }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) main();
