// Build the /video-components gallery's data from prompts/moves: one JSON file the site imports at build time,
// the raw move markdown served as text, and (with --clips) the web
// copies of each clip, and public/moves/index.json (the same data, filterable by an agent).
//
//   node scripts/site/moves.mjs            data and raw .md (pure node, runs in prebuild)
//   node scripts/site/moves.mjs --clips    also encode any clip whose source changed (needs ffmpeg)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clipFacts } from './clip-facts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'prompts', 'moves');
const OUT_DIR = path.join(root, 'site', 'public', 'moves');
const DATA = path.join(root, 'site', 'lib', 'moves.json');
const INDEX = path.join(OUT_DIR, 'index.json');
const REPO_BLOB = 'https://github.com/vawe-hq/vawe/blob/main/prompts/moves/';
const SITE = 'https://vawe.dev';
const NOT_MOVES = new Set(['README.md', 'RECIPES.md']);
const DEFAULT_LOOK = 'vawe';
const DEFAULT_THEME = 'dark';

const { EASE_HANDLES } = await import(pathToFileURL(path.join(root, 'core', 'motion', 'presets.js')));
const { resolveHandle } = await import(pathToFileURL(path.join(root, 'core', 'motion', 'motion.js')));

const read = (p) => fs.readFileSync(p, 'utf8');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (md) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();

function readIndex() {
  const groups = [];
  const groupOf = new Map();
  const shortUse = new Map();
  const jobs = new Map();
  const featured = [];
  let section = null;
  for (const line of read(path.join(SRC, 'README.md')).split('\n')) {
    const h = line.match(/^## (.+)/);
    if (h) { section = h[1].trim(); continue; }
    if (section === 'Featured') {
      const name = line.match(/^\d+\. \[[^\]]+\]\(([a-z0-9-]+)\.md\)/)?.[1];
      if (name) featured.push(name);
      continue;
    }
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (section === 'Pick by job') {
      const names = [...cells[1].matchAll(/\]\(([a-z0-9-]+)\.md\)/g)].map((m) => m[1]);
      if (!names.length) continue;
      const row = jobs.get(cells[0]) ?? [];
      for (const n of names) if (!row.includes(n)) row.push(n);
      jobs.set(cells[0], row);
      continue;
    }
    const name = cells[0]?.match(/\(([a-z0-9-]+)\.md\)/)?.[1];
    if (!name || section.startsWith('Looks')) continue;
    if (!groups.some((g) => g.label === section)) groups.push({ id: slug(section), label: section });
    groupOf.set(name, slug(section));
    shortUse.set(name, plain(cells[1]));
  }
  return { groups, groupOf, shortUse, featured, jobs: [...jobs].map(([label, moves]) => ({ id: slug(label), label, moves })) };
}

// ---- markdown: the small subset the move files use ------------------------------------------------
function href(target) {
  if (/^(https?:|#|\/)/.test(target)) return target;
  const md = target.match(/^([a-z0-9-]+)\.md$/);
  if (md) return `/video-components/${md[1]}`;
  const clip = target.match(/^(?:\.\.\/\.\.\/site\/public\/moves\/)?([a-z0-9-]+)\.mp4$/);
  if (clip) return `/moves/${clip[1]}.mp4`;
  return REPO_BLOB + target;
}

function inline(text) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((p) => {
    if (p.startsWith('`') && p.endsWith('`') && p.length > 1) return `<code>${esc(p.slice(1, -1))}</code>`;
    return esc(p)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${esc(href(u))}">${t}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  }).join('');
}

const JS_KW = new Set('import export from const let var function return if else for of in while new await async class extends this true false null undefined typeof default break continue'.split(' '));

function wrap(cls, s) { return `<span class="tk-${cls}">${esc(s)}</span>`; }

function highlightJs(src) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_$][\w$]*)/g;
  let out = '';
  let last = 0;
  for (const m of src.matchAll(re)) {
    out += esc(src.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1]) out += wrap('c', m[0]);
    else if (m[2]) out += wrap('s', m[0]);
    else if (m[3]) out += wrap('n', m[0]);
    else if (JS_KW.has(m[4])) out += wrap('k', m[0]);
    else if (src[last] === '(') out += wrap('f', m[0]);
    else out += esc(m[0]);
  }
  return out + esc(src.slice(last));
}

function highlightCss(src) {
  const re = /(\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(@[\w-]+)|(--[\w-]+|[a-z-]+(?=\s*:[^:{;]*;|\s*:[^{]*?\}))|(-?\b\d*\.?\d+(?:px|em|rem|s|ms|%|deg|vh|vw|fr)?\b)/g;
  let out = '';
  let last = 0;
  for (const m of src.matchAll(re)) {
    out += esc(src.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1]) out += wrap('c', m[0]);
    else if (m[2]) out += wrap('s', m[0]);
    else if (m[3]) out += wrap('k', m[0]);
    else if (m[4]) out += wrap('p', m[0]);
    else out += wrap('n', m[0]);
  }
  return out + esc(src.slice(last));
}

function highlightHtml(src) {
  const blocks = /(<script[^>]*>)([\s\S]*?)(<\/script>)|(<style[^>]*>)([\s\S]*?)(<\/style>)/g;
  const tags = (s) => s.replace(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>/g, (t) => {
    if (t.startsWith('<!--')) return wrap('c', t);
    const m = t.match(/^(<\/?)([a-zA-Z][\w-]*)([\s\S]*?)(\/?>)$/);
    if (!m) return esc(t);
    const attrs = esc(m[3]).replace(/([\w:-]+)(=)(&quot;[^&]*?&quot;|'[^']*')?/g, (_, a, eq, v = '') =>
      `<span class="tk-p">${a}</span>${eq}${v ? `<span class="tk-s">${v}</span>` : ''}`);
    return `${esc(m[1])}<span class="tk-k">${m[2]}</span>${attrs}${esc(m[4])}`;
  });
  let out = '';
  let last = 0;
  for (const m of src.matchAll(blocks)) {
    out += tags(src.slice(last, m.index));
    last = m.index + m[0].length;
    out += m[1] ? tags(m[1]) + highlightJs(m[2]) + tags(m[3]) : tags(m[4]) + highlightCss(m[5]) + tags(m[6]);
  }
  return out + tags(src.slice(last));
}

function guessLang(lang, code) {
  if (lang) return lang;
  if (/^\s*</.test(code)) return 'html';
  if (/^\s*[.#@:\w-][^\n]*\{/.test(code) && !/\b(const|let|function|import)\b/.test(code)) return 'css';
  return 'js';
}

function codeBlock(lang, code) {
  const l = guessLang(lang, code);
  const body = l === 'css' ? highlightCss(code) : l === 'html' ? highlightHtml(code) : highlightJs(code);
  return `<div class="mv-code"><div class="mv-code-bar"><span>${l}</span><button type="button" class="mv-copy" data-copy>Copy</button></div><pre><code>${body}</code></pre></div>`;
}

// Blocks in file order: { type: 'code' | 'sound' | 'text', html }. The page puts them under H2 headings.
function renderMarkdown(md) {
  const lines = md.split('\n');
  const blocks = [];
  const html = { push: (h, type = 'text') => blocks.push({ type, html: h }) };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      i++;
      html.push(codeBlock(fence[1], code.join('\n')), 'code');
      continue;
    }
    const h = line.match(/^(#{1,3}) (.+)/);
    if (h) {
      if (h[1].length > 1) html.push(`<h${h[1].length} id="${slug(h[2])}">${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    const list = line.match(/^(- |\d+\. )/);
    if (list) {
      const ordered = list[1] !== '- ';
      const items = [];
      while (i < lines.length && (/^(- |\d+\. )/.test(lines[i]) || (/^\s+\S/.test(lines[i]) && items.length))) {
        if (/^(- |\d+\. )/.test(lines[i])) items.push(lines[i].replace(/^(- |\d+\. )/, ''));
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,3} |- |\d+\. )/.test(lines[i])) para.push(lines[i++].trim());
    const text = para.join(' ').replace(/^(\*\*Use when\*\*.*?)\s*Clip:.*$/, '$1');
    const sound = text.startsWith('Sound:');
    html.push(sound ? `<p class="mv-sound">${inline(text)}</p>` : `<p>${inline(text)}</p>`, sound ? 'sound' : 'text');
  }
  return blocks;
}

// The vawe eases a move uses, with the After Effects handle pair behind each (influence is a per cent of
// the segment, speed a multiple of its average velocity). The page shows them as data.
function easesOf(...sources) {
  const found = new Set();
  for (const src of sources) for (const m of src.matchAll(/\bEASE(?:\.(\w+)|\[['"](\w+)['"]\])|\beaseFn\(['"](\w+)['"]\)/g)) found.add(m[1] ?? m[2] ?? m[3]);
  return [...found].filter((n) => EASE_HANDLES[n]).sort().map((name) => {
    const [out, into] = EASE_HANDLES[name];
    const side = (h, which) => {
      const r = resolveHandle(h, which);
      return { influence: Math.round(r.influence), speed: Math.round(r.speed * 100) / 100 };
    };
    return { name, out: side(out, 'easeOut'), into: side(into, 'easeIn') };
  });
}

// The date of the last commit that touched the files, or their newest mtime when git has none
// (an untracked clip). The sitemap and the VideoObject read it, so it must not be "now".
function firstCommitted(file) {
  try {
    const out = execFileSync('git', ['log', '--format=%cI', '--', file], { cwd: root, encoding: 'utf8' }).trim().split('\n').pop();
    if (out) return out.slice(0, 10);
  } catch { /* no git here: fall through to mtime */ }
  return new Date(fs.statSync(file).mtimeMs).toISOString().slice(0, 10);
}

function lastChanged(files) {
  const existing = files.filter((f) => fs.existsSync(f));
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...existing], { cwd: root, encoding: 'utf8' }).trim();
    if (out) return out.slice(0, 10);
  } catch { /* no git here: fall through to mtime */ }
  const newest = Math.max(...existing.map((f) => fs.statSync(f).mtimeMs));
  return new Date(newest).toISOString().slice(0, 10);
}

// ---- one move -------------------------------------------------------------------------------------
function readMove(file, index) {
  const name = file.replace(/\.md$/, '');
  const md = read(path.join(SRC, file));
  const title = md.match(/^# (.+)/m)?.[1].trim() ?? name;
  const usePara = md.match(/\*\*Use when\*\*([\s\S]*?)(?:\n\n|$)/)?.[1] ?? '';
  const useWhen = plain(usePara.replace(/\s*Clip:[\s\S]*$/, ''));
  const demo = path.join(SRC, 'demo', `${name}.html`);
  const page = fs.existsSync(demo) ? read(demo) : '';
  const look = page.match(/data-look="([a-z-]+)"/)?.[1] ?? DEFAULT_LOOK;
  const theme = page.match(/<html[^>]*data-theme="([a-z]+)"/)?.[1] ?? DEFAULT_THEME;
  const declared = (page.match(/<meta name="variants" content="([^"]*)"/)?.[1] ?? '').split(/\s+/);
  const before = recorded.get(name);
  const clip = path.join(SRC, `${name}.mp4`);
  const variant = declared.find((t) => t && t !== theme && (fs.existsSync(path.join(SRC, `${name}-${t}.mp4`)) || before?.variant === t)) ?? null;
  const alt = variant && path.join(SRC, `${name}-${variant}.mp4`);
  const own = clipFacts(clip, { hash: before?.clipHash ?? null, date: before?.clipDate ?? null, duration: before?.duration ?? null }, lock[name]?.clip, name);
  const other = alt && clipFacts(alt, { hash: before?.variantHash ?? null, date: null, duration: null }, lock[`${name}-${variant}`]?.clip, `${name}-${variant}`);
  const sound = md.match(/^Sound:\s*(.+)/m)?.[1].trim() ?? null;
  const blocks = renderMarkdown(md);
  const firstCode = blocks.findIndex((b) => b.type === 'code');
  const joined = (list) => list.map((b) => b.html).join('\n');
  const snippet = md.match(/^```\w*\n([\s\S]*?)^```/m)?.[1].trimEnd() ?? '';
  return {
    name,
    title,
    group: index.groupOf.get(name) ?? null,
    look,
    use: index.shortUse.get(name) ?? useWhen,
    useWhen,
    jobs: index.jobs.filter((j) => j.moves.includes(name)).map((j) => j.id),
    sound: sound ? plain(sound) : null,
    snippet,
    eases: easesOf(snippet, page),
    published: firstCommitted(path.join(SRC, file)),
    modified: [lastChanged([path.join(SRC, file)]), own.date, other?.date, before?.modified].filter(Boolean).sort().pop(),
    clipDate: own.date,
    clipHash: own.hash,
    theme,
    variant,
    variantHash: other?.hash ?? null,
    duration: own.duration,
    useHtml: joined(blocks.slice(0, Math.max(firstCode, 0))),
    codeHtml: firstCode === -1 ? '' : blocks[firstCode].html,
    soundHtml: joined(blocks.filter((b) => b.type === 'sound')),
    notesHtml: joined(blocks.slice(firstCode + 1).filter((b) => b.type !== 'sound')),
  };
}

// ---- clips ------------------------------------------------------------------------------------------
// One source per move (an untracked master), rendered by `bin/vawe-dev moves` at 1280x720 60 fps. The move page plays the H.264
// copy at full size; the gallery grid plays a 640 px VP9 copy over a 640 px poster.
const CLIP_FILES = ['mp4', 'webm', 'webp', 'hd.webp'];

// `stem` is the move name, or `<name>-<theme>` for its theme variant.
function encodeClip(stem) {
  const src = path.join(SRC, `${stem}.mp4`);
  const out = (ext) => path.join(OUT_DIR, `${stem}.${ext}`);
  const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
  const small = ['-vf', 'scale=640:-2:flags=lanczos'];
  ff(['-i', src, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out('mp4')]);
  ff(['-i', src, '-an', ...small, '-c:v', 'libvpx-vp9', '-crf', '44', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', out('webm')]);
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString());
  const last = ['-ss', String(Math.max(0, dur - 0.25)), '-i', src, '-frames:v', '1', '-c:v', 'libwebp'];
  ff([...last, ...small, '-quality', '62', out('webp')]);
  ff([...last, '-quality', '72', out('hd.webp')]);
}

function writeIndex(moves, data) {
  const out = moves.map((m) => ({
    name: m.name,
    title: m.title,
    group: m.group,
    look: m.look,
    jobs: m.jobs,
    use: m.use,
    clip: `${SITE}/moves/${m.name}.mp4`,
    ...(m.variant ? { variants: { [m.variant]: `${SITE}/moves/${m.name}-${m.variant}.mp4` } } : {}),
    md: `${SITE}/moves/${m.name}.md`,
    page: `${SITE}/video-components/${m.name}`,
    duration: m.duration,
  }));
  fs.writeFileSync(INDEX, `${JSON.stringify({ site: SITE, groups: data.groups, looks: data.looks, featured: data.featured, jobs: data.jobs.map(({ id, label }) => ({ id, label })), moves: out }, null, 1)}\n`);
}

// ---- main -------------------------------------------------------------------------------------------
// The Docker build context carries site/ but not prompts/ (.dockerignore is an allowlist), so the
// image builds from the committed moves.json and site/public/moves.
if (!fs.existsSync(SRC)) {
  console.log('~ prompts/moves is not here; using the committed site/lib/moves.json');
  process.exit(0);
}

const withClips = process.argv.includes('--clips');
const index = readIndex();
const previous = fs.existsSync(DATA) ? JSON.parse(read(DATA)) : { moves: [] };
const lockFile = path.join(SRC, 'clips.lock.json');
const lock = fs.existsSync(lockFile) ? JSON.parse(read(lockFile)) : {};
const recorded = new Map(previous.moves.map((m) => [m.name, m]));
const encodedHash = new Map(previous.moves.flatMap((m) => [[m.name, m.clipHash], [`${m.name}-${m.variant}`, m.variantHash]]));
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.md') && !NOT_MOVES.has(f)).sort();
const readmeOrder = [...index.groupOf.keys()];
const rank = (m) => (readmeOrder.includes(m.name) ? readmeOrder.indexOf(m.name) : readmeOrder.length);
const moves = files.map((f) => readMove(f, index)).sort((a, b) => rank(a) - rank(b));

const missing = moves.filter((m) => !m.group).map((m) => m.name);
if (missing.length) console.warn(`~ not in a README group table: ${missing.join(', ')}`);

fs.mkdirSync(OUT_DIR, { recursive: true });
let encoded = 0;
for (const m of moves) {
  fs.writeFileSync(path.join(OUT_DIR, `${m.name}.md`), read(path.join(SRC, `${m.name}.md`)).replaceAll('](../../site/public/moves/', ']('));
  for (const [stem, hash, key] of [[m.name, m.clipHash, 'clipHash'], [`${m.name}-${m.variant}`, m.variantHash, 'variantHash']]) {
    if (!hash) continue;
    const have = CLIP_FILES.every((e) => fs.existsSync(path.join(OUT_DIR, `${stem}.${e}`)));
    if (have && encodedHash.get(stem) === hash) continue;
    if (withClips && !fs.existsSync(path.join(SRC, `${stem}.mp4`))) {
      console.warn(`~ ${stem}: no master clip here, render it with: bin/vawe-dev moves --only ${m.name}`);
      continue;
    }
    if (!withClips) {
      console.warn(`~ ${stem}: clip changed or missing, run with --clips`);
      m[key] = encodedHash.get(stem) ?? null;
      continue;
    }
    encodeClip(stem);
    encoded++;
  }
  if (!m.variantHash) m.variant = null;
}

const published = new Set(moves.flatMap((m) => [m.name, ...(m.variant ? [`${m.name}-${m.variant}`] : [])]));
for (const file of fs.readdirSync(OUT_DIR)) {
  const stem = file.match(/^(.+-(?:light|dark))\.(?:mp4|webm|hd\.webp|webp)$/)?.[1];
  if (stem && !published.has(stem)) fs.rmSync(path.join(OUT_DIR, file));
}

const looks = [...new Set(moves.map((m) => m.look))].sort((a, b) => (a === DEFAULT_LOOK ? -1 : b === DEFAULT_LOOK ? 1 : a.localeCompare(b)));
const unknown = index.featured.filter((n) => !moves.some((m) => m.name === n && m.clipHash));
if (unknown.length) throw new Error(`Featured names a move with no doc or clip: ${unknown.join(', ')}`);
const data = { groups: index.groups, looks, jobs: index.jobs, featured: index.featured, moves };
fs.writeFileSync(DATA, `${JSON.stringify(data, null, 1)}\n`);
writeIndex(moves, data);
console.log(`✓ ${moves.length} moves -> site/lib/moves.json, site/public/moves${withClips ? ` (${encoded} clip(s) encoded)` : ''}`);
