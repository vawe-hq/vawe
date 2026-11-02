// After a failed step, name the doctor check that explains it: reads .vawe/doctor.json (written by
// `vawe-dev doctor --quiet`, which npm install runs) and matches each failed check against the error text.
import fs from 'node:fs';
import path from 'node:path';

export const CHROME_FIX = 'npm install, then npx puppeteer browsers install chrome';

// A fresh clone that skipped npm install has no doctor.json, so these errors are matched without it.
const CHROME_MISSING = /Cannot find (package|module) 'puppeteer'|Could not find Chrome|Tried to find the browser at the configured path|Browser was not found|Failed to launch the browser process/i;
const WORDS = { chrome: /chrome|puppeteer/i, fonts: /fonts?\b/i };
const mentions = (id, text) => (WORDS[id] || new RegExp(`\\b${id}\\b`, 'i')).test(text);

export function doctorHint(errorText, checks = []) {
  if (CHROME_MISSING.test(errorText)) return `Chrome for puppeteer is missing. fix: ${CHROME_FIX} (bin/vawe-dev doctor checks every tool)`;
  const hit = checks.find((c) => !c.ok && mentions(c.tool, errorText));
  return hit ? `doctor found ${hit.tool} missing: ${hit.fix}` : null;
}

function readChecks(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, '.vawe', 'doctor.json'), 'utf8')); } catch { return []; }
}

export function doctorHintFromFile(root, errorText) {
  return doctorHint(errorText, readChecks(root));
}
