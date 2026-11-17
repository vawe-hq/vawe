// The page contract check (AGENTS.md, Hard rules). A finding of severity 'block' breaks a render: a duration meta, a data-world on each beat,
// relative paths. A hand-written ease advises with the named one to use (ease-names.mjs). Timers, clocks and Math.random advise: core/engine/page-clock.js already makes them a pure function of t. The source traps are harness/lib/page-traps.mjs
// pageTraps, run on the page with its comments blanked; a declared, vetted waiver (harness/lib/waivers.mjs) drops a finding.
import fs from 'node:fs';
import path from 'node:path';
import { pageTraps } from '../lib/page-traps.mjs';
import { metaOf } from '../lib/page-meta.mjs';
import { authoringOfHtml } from '../lib/motion-stamp.mjs';
import { isWaived } from '../lib/waivers.mjs';
import { easeFindings } from './ease-names.mjs';
import { holdFindings } from './hold-estimate.mjs';

const BLANK = (m) => m.replace(/[^\n]/g, ' ');

/** The text with every comment blanked to spaces, so a character keeps its line and offset. `//` counts only inside a script, outside a string. */
export function withoutComments(html) {
  const noMarkup = html.replace(/<!--[\s\S]*?-->/g, BLANK).replace(/\/\*[\s\S]*?\*\//g, BLANK);
  return noMarkup.replace(/(<script\b(?![^>]*type\s*=\s*["']application\/json)[^>]*>)([\s\S]*?)(<\/script>)/gi, (_, open, body, close) => open + lineCommentsBlanked(body) + close);
}

function lineCommentsBlanked(code) {
  let out = '';
  let quote = null;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      out += c;
      if (c === '\\') out += code[++i] ?? '';
      else if (c === quote || (c === '\n' && quote !== '`')) quote = null;
    } else if (c === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i);
      const stop = end === -1 ? code.length : end;
      out += ' '.repeat(stop - i);
      i = stop - 1;
    } else {
      if (c === '"' || c === "'" || c === '`') quote = c;
      out += c;
    }
  }
  return out;
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const lineOf = (text, re) => {
  const at = text.search(re);
  return at < 0 ? null : lineAt(text, at);
};

// A page that reassigns Math.random to its own PRNG is seeded; the engine's page clock reseeds it too.
const seededRandom = (code) => /\bMath\.random\s*=[^=]/.test(code);

function trapFindings(code, authoring) {
  return pageTraps(code, { film: true })
    .map((t) => ({ code: t.code, severity: t.severity, line: lineAt(code, t.index), message: t.message, fix: t.fix }))
    .filter((f) => !(f.code === 'unseeded-random' && seededRandom(code)) && !isWaived(authoring, f.code, null) && !isWaived(authoring, 'anim-traps', null));
}

function metaFindings(html) {
  const out = [];
  const duration = metaOf(html, 'duration');
  const valid = duration !== null && (duration.trim() === 'auto' || Number(duration) > 0);
  if (!valid) out.push({ code: 'duration', severity: 'block', line: lineOf(html, /<meta\b[^>]*name\s*=\s*["']duration["']/i), message: duration === null ? 'no <meta name="duration"> in seconds' : `<meta name="duration" content="${duration}"> is not a number of seconds above 0 or auto`, fix: 'add <meta name="duration" content="12.4"> (seconds), or content="auto" to take the length from the last move' });
  if (metaOf(html, 'message') === null) out.push({ code: 'message-meta', severity: 'advise', line: null, message: 'no <meta name="message">: the one thing to remember', fix: 'add <meta name="message" content="zero fees">' });
  return out;
}

function worldFindings(html) {
  const ids = [...html.matchAll(/\bdata-world\s*=\s*["']([^"']*)["']/g)].map((m) => m[1]);
  if (!ids.length) return [{ code: 'no-world', severity: 'block', line: null, message: 'no element has data-world: a beat is one element with data-world="<id>"', fix: 'wrap each beat in <section data-world="<id>"> with the id from the brief Shots (lowercase)' }];
  const bad = ids.find((id) => !/^[a-z0-9][a-z0-9-]*$/.test(id));
  const twice = ids.find((id, i) => ids.indexOf(id) !== i);
  return [
    ...(bad === undefined ? [] : [{ code: 'world-id', severity: 'advise', line: lineOf(html, new RegExp(`data-world\\s*=\\s*["']${bad}["']`)), message: `data-world="${bad}" is not a lowercase id`, fix: 'use lowercase letters, digits and dashes' }]),
    ...(twice === undefined ? [] : [{ code: 'world-twice', severity: 'advise', line: null, message: `data-world="${twice}" is on two elements`, fix: 'one element per beat; give each beat its own id' }]),
  ];
}

const LOCAL_REF = /\b(?:src|href|poster)\s*=\s*["']([^"'#?]+)["']|url\(\s*["']?([^"')#?]+)/gi;
const NOT_A_FILE = /^(?:[a-z][a-z0-9+.-]*:|\/|\{\{|\$\{|#)/i;

function assetFindings(code, filmDir) {
  if (!filmDir) return [];
  const out = [];
  for (const m of code.matchAll(LOCAL_REF)) {
    const ref = (m[1] ?? m[2] ?? '').trim();
    if (!ref || NOT_A_FILE.test(ref) || fs.existsSync(path.resolve(filmDir, ref))) continue;
    out.push({ code: 'asset-missing', severity: 'advise', line: code.slice(0, m.index).split('\n').length, message: `${ref} is not in the film folder`, fix: 'put the file in films/<name>/assets/ and use that relative path' });
  }
  return out;
}

const waived = (findings, authoring) => findings.filter((f) => !isWaived(authoring, f.code, null));

/**
 * Findings for page html: [{ code, severity: 'block' | 'advise', line, message, fix }], blocks first. `line` is 1-based or null.
 * Pure over `html`; `filmDir` only lets it look for the local files the page names.
 */
export function contractCheck(html, { filmDir = null } = {}) {
  const authoring = authoringOfHtml(html);
  const code = withoutComments(html);
  const all = [...metaFindings(html), ...worldFindings(html), ...trapFindings(code, authoring), ...easeFindings(code), ...holdFindings(code), ...assetFindings(code, filmDir)];
  return waived(all, authoring).sort((a, b) => Number(b.severity === 'block') - Number(a.severity === 'block'));
}
