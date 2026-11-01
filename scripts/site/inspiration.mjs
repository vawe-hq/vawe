#!/usr/bin/env node
// Builds site/content/inspiration.json from site/content/inspiration-posts.txt (one X post URL per line).
//
//   nice -n 15 node scripts/site/inspiration.mjs [--hints file.json] [--ids a,b | --refresh] [--normalize]
//
// Four stages, each in parallel and each saved to out/inspiration-stages.json when it ends, so a run
// resumes where the last one stopped:
//   1. video   the playback mp4 on video.twimg.com: a hinted URL checked with a HEAD request, else yt-dlp
//   2. post    the text, creator and name from X oEmbed
//   3. poster  one frame, `bin/vawe frame <mp4 url>` (a range read, nothing downloaded), as a small webp
//   3b. avatar the creator's profile picture URL on pbs.twimg.com, from the embed data X serves
//   4. data    the entries, written once
// "Made with" and the prompt come only from the post text. Type tags come from rules on the post text
// and from a look at the posters; a tag set by hand is kept on every run. --normalize re-derives
// maker, model and the rule tags of every entry without a request. A post that fails is listed.
//
// --hints: an optional JSON map of post id to { playback, duration, toolQuote, promptPublished, saves, likes }.
// A playback URL is used only if the CDN answers it; a tool quote only if the post text contains it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LIST = path.join(ROOT, 'site/content/inspiration-posts.txt');
const DATA = path.join(ROOT, 'site/content/inspiration.json');
const POSTERS = path.join(ROOT, 'site/public/inspiration');
const STAGES = path.join(ROOT, 'out/inspiration-stages.json');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiration-'));
const sharp = createRequire(path.join(ROOT, 'site/package.json'))('sharp');

const argv = process.argv.slice(2);
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const HINTS = arg('--hints') ? JSON.parse(fs.readFileSync(arg('--hints'), 'utf8')) : {};
// Parallel requests per stage: the CDN takes many HEAD requests, X's oEmbed and yt-dlp fewer.
const JOBS = { head: 16, ytdlp: 4, oembed: 8, poster: 4, avatar: 8 };
const POSTER_W = 640;
const POSTER_MAX = 60_000;
const TITLE_MAX = 90;
// X answers 429 when requests come too fast: wait this long, times the attempt, then try again.
const BACKOFF_MS = 30_000;
const ATTEMPTS = 4;

// ---------- made with: the names a post writes, folded to one maker and a clean model list ----------
const MODELS = [
  { re: /claude code/i, name: 'Claude Code', maker: 'Claude' },
  { re: /claude design/i, name: 'Claude Design', maker: 'Claude' },
  { re: /\b(opus|sonnet|haiku|fable)[ -]?(\d(?:\.\d)?)/i, name: (m) => `${cap(m[1])} ${m[2]}`, maker: 'Claude' },
  { re: /\bclaude\b/i, name: 'Claude', maker: 'Claude', weak: true },
  { re: /\bgpt-?(\d(?:\.\d)?)(?:[- ]?(codex|pro|mini|sol|astra))?/i, name: (m) => `GPT-${m[1]}${m[2] ? ` ${cap(m[2])}` : ''}`, maker: 'OpenAI' },
  { re: /\bcodex\b/i, name: 'Codex', maker: 'OpenAI' },
  { re: /\bchatgpt\b/i, name: 'ChatGPT', maker: 'OpenAI', weak: true },
  { re: /\bsora\b/i, name: 'Sora', maker: 'OpenAI' },
  { re: /\bgemini(?: (\d(?:\.\d)?))?(?: (pro|flash))?/i, name: (m) => ['Gemini', m[1], m[2] && cap(m[2])].filter(Boolean).join(' '), maker: 'Google' },
  { re: /\bveo ?(\d)/i, name: (m) => `Veo ${m[1]}`, maker: 'Google' },
  { re: /nano banana/i, name: 'Nano Banana', maker: 'Google' },
  { re: /\bgrok(?: (\d))?/i, name: (m) => (m[1] ? `Grok ${m[1]}` : 'Grok'), maker: 'Other' },
  { re: /\bkimi(?: (k\d(?:\.\d)?))?/i, name: (m) => (m[1] ? `Kimi ${m[1].toUpperCase()}` : 'Kimi'), maker: 'Other' },
  { re: /\bdeepseek/i, name: 'DeepSeek', maker: 'Other' },
  { re: /\bqwen/i, name: 'Qwen', maker: 'Other' },
  { re: /\bglm-?(\d(?:\.\d)?)/i, name: (m) => `GLM-${m[1]}`, maker: 'Other' },
  { re: /\bminimax/i, name: 'MiniMax', maker: 'Other' },
  { re: /\bseedance/i, name: 'Seedance', maker: 'Other' },
  { re: /\bkling/i, name: 'Kling', maker: 'Other' },
  { re: /\bcursor\b/i, name: 'Cursor', tool: true },
  { re: /\bremotion\b/i, name: 'Remotion', tool: true },
  { re: /\bhyperframes\b/i, name: 'HyperFrames', tool: true },
  { re: /three\.?js/i, name: 'Three.js', tool: true },
  { re: /\bblender\b/i, name: 'Blender', tool: true },
  { re: /\bafter effects\b/i, name: 'After Effects', tool: true },
  { re: /\bhiggsfield\b/i, name: 'Higgsfield', tool: true },
];
const cap = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();
const MAKER_ORDER = ['Claude', 'OpenAI', 'Google', 'Other'];

export function madeWith(text) {
  const model = [];
  const makers = [];
  for (const m of MODELS) {
    const hit = m.re.exec(text ?? '');
    if (!hit) continue;
    const name = typeof m.name === 'function' ? m.name(hit) : m.name;
    if (m.weak && makers.includes(m.maker)) continue;
    if (!model.includes(name)) model.push(name);
    if (m.maker && !makers.includes(m.maker)) makers.push(m.maker);
  }
  const maker = MAKER_ORDER.find((k) => makers.includes(k)) ?? (model.length ? 'Other' : 'Unknown');
  return { maker, model };
}

// ---------- type tags from the post text; the poster pass corrects and completes them ----------
const TYPE_RULES = [
  ['3d', /\b3d\b|three\.?js|blender|webgl|unreal engine|\bunity\b|voxel/i],
  ['pixel-art', /pixel/i],
  ['explainer', /explain|explainer|how (?:a |an |the )?\w+ works|tutorial|lesson|教学|讲解|解説|科普/i],
  ['interactive', /interactive|playable|you can (?:drag|play|click|take)|\bgame\b/i],
  ['product-ui', /\b(?:ui|ux|saas|product (?:video|demo|launch)|launch video|landing page|dashboard|onboarding|app demo)\b/i],
  ['typography', /typograph|kinetic type|lettering/i],
  ['data-viz', /data ?vi[sz]|\bchart|visuali[sz]ation/i],
  ['illustration', /illustrat|hand-?drawn|\banime\b|cartoon|watercolou?r/i],
  ['abstract', /generative|abstract|shader|particles/i],
];
const MAX_TYPES = 3;

export function typesFrom(text, kept = []) {
  const ruled = TYPE_RULES.filter(([, re]) => re.test(text ?? '')).map(([id]) => id);
  return [...new Set([...kept, ...ruled])].slice(0, MAX_TYPES);
}

// ---------- requests ----------
const run = (cmd, args) =>
  new Promise((resolve) => {
    execFile(cmd, args, { cwd: ROOT, maxBuffer: 1 << 26 }, (error, stdout, stderr) => resolve({ ok: !error, stdout: String(stdout), stderr: String(stderr) }));
  });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lastLine = (s) => s.trim().split('\n').at(-1) ?? '';

async function retry(what, fn) {
  for (let i = 1; ; i++) {
    const out = await fn();
    if (out.ok || !out.limited || i === ATTEMPTS) return out;
    console.error(`  ${what}: rate limited, waiting ${(BACKOFF_MS * i) / 1000}s`);
    await wait(BACKOFF_MS * i);
  }
}

async function pool(items, jobs, fn) {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) await fn(item);
  };
  await Promise.all(Array.from({ length: jobs }, worker));
}

// The CDN serves the file to a request with no Referer (Node's fetch sends none): 200 or 206 and a
// video type means it plays.
async function headOk(url) {
  const res = await fetch(url, { method: 'HEAD' }).catch(() => null);
  return Boolean(res && (res.status === 200 || res.status === 206) && /^video\//.test(res.headers.get('content-type') ?? ''));
}

async function ytdlp(url) {
  return retry('yt-dlp', async () => {
    const r = await run('yt-dlp', ['--no-warnings', '--playlist-items', '1', '-f', 'best[protocol=https][ext=mp4]', '--print', '%(duration)s', '--print', '%(url)s', '--print', '%(description)s', url]);
    if (!r.ok) return { ok: false, limited: /429|rate.?limit/i.test(r.stderr), why: `yt-dlp: ${lastLine(r.stderr)}` };
    const [duration, playback, ...rest] = r.stdout.trimEnd().split('\n');
    if (!/^https:\/\/video\.twimg\.com\//.test(playback)) return { ok: false, why: 'yt-dlp: no mp4 on video.twimg.com (a GIF, an image or an embed)' };
    const seconds = Number(duration);
    return { ok: true, playback, duration: Number.isFinite(seconds) ? Math.round(seconds * 10) / 10 : null, description: rest.join('\n') };
  });
}

const decode = (s) =>
  s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&mdash;/g, ' - ').replace(/&amp;/g, '&');

async function oembed(url) {
  const api = `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(url)}`;
  return retry('oembed', async () => {
    const res = await fetch(api).catch(() => null);
    if (!res) return { ok: false, why: 'oembed: no response' };
    if (res.status === 429) return { ok: false, limited: true, why: 'oembed: 429' };
    if (!res.ok) return { ok: false, why: `oembed: HTTP ${res.status} (deleted, private or no longer embeddable)` };
    const j = await res.json();
    const p = /<p[^>]*>([\s\S]*?)<\/p>/.exec(j.html)?.[1] ?? '';
    return { ok: true, text: decode(p.replace(/<br\s*\/?>/g, '\n')), name: j.author_name ?? '', handle: (j.author_url ?? '').split('/').pop() };
  });
}

async function poster(id, playback, duration) {
  const out = path.join(POSTERS, `${id}.webp`);
  if (fs.existsSync(out)) return { ok: true };
  const png = path.join(TMP, `${id}.png`);
  const at = (duration ? Math.min(Math.max(duration * 0.3, 1), 8) : 1).toFixed(1);
  const still = await run(path.join(ROOT, 'bin/vawe'), ['frame', playback, '--at', at, '--out', png]);
  if (!fs.existsSync(png)) return { ok: false, why: `still: ${lastLine(still.stderr || still.stdout)}` };
  for (let q = 80; q >= 40; q -= 10) {
    await sharp(png).resize({ width: POSTER_W, withoutEnlargement: true }).webp({ quality: q, effort: 6 }).toFile(out);
    if (fs.statSync(out).size < POSTER_MAX) break;
  }
  fs.rmSync(png, { force: true });
  return { ok: true };
}

// ---------- the post text: title, prompt ----------
const clean = (s) => s.replace(/\u2014/g, ' - ').replace(/https?:\/\/\S+|pic\.(?:twitter|x)\.com\/\S+/g, '').replace(/[ \t]+/g, ' ').trim();

function titleFrom(text) {
  const line = clean(text).split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  if (line.length <= TITLE_MAX) return line;
  const cut = line.slice(0, TITLE_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).replace(/[\s,.;:!-]+$/, '')}…`;
}

// A prompt counts only when the post publishes it: the text after a "prompt:" marker, or a long quoted ask.
function promptFrom(text, published) {
  const body = clean(text);
  const marked = /\bprompts?\b[^:\n：]{0,24}[:：]\s*([\s\S]{40,})/i.exec(body);
  if (marked) return marked[1].trim();
  const quoted = /["“「]([^"”」]{60,})["”」]/.exec(body);
  if (quoted) return quoted[1].trim();
  // A post known to publish its prompt with no marker: the post text is the prompt.
  return published && body.length >= 80 ? body : null;
}

function quoted(text, quote) {
  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return quote && norm(text).includes(norm(quote)) ? quote : '';
}

// ---------- stages ----------
const idOf = (url) => /status\/(\d+)/.exec(url)?.[1];
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);
const timed = async (name, fn) => {
  const t0 = Date.now();
  const n = await fn();
  console.log(`stage ${name}: ${n} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
};

async function videoStage(todo, st, failed) {
  const need = todo.filter(({ id }) => !st.video[id]);
  const fallback = [];
  await pool(need, JOBS.head, async ({ id }) => {
    const h = HINTS[id];
    if (h?.playback && (await headOk(h.playback))) st.video[id] = { playback: h.playback, duration: h.duration ?? null };
    else fallback.push(id);
  });
  const textNeeded = need.filter(({ id }) => st.video[id] && HINTS[id]?.promptPublished).map(({ id }) => id);
  const viaYtdlp = [...new Set([...fallback, ...textNeeded])];
  await pool(viaYtdlp, JOBS.ytdlp, async (id) => {
    const r = await ytdlp(todo.find((t) => t.id === id).url);
    if (r.ok) st.video[id] = { playback: st.video[id]?.playback ?? r.playback, duration: st.video[id]?.duration ?? r.duration, description: r.description };
    else if (!st.video[id]) failed.set(id, r.why);
  });
  return `${need.length - fallback.length} by HEAD, ${viaYtdlp.length} by yt-dlp`;
}

async function postStage(todo, st, failed) {
  const need = todo.filter(({ id }) => st.video[id] && !st.post[id]);
  await pool(need, JOBS.oembed, async ({ id, url }) => {
    const r = await oembed(url);
    if (r.ok) st.post[id] = { text: r.text, name: r.name, handle: r.handle };
    else failed.set(id, r.why);
  });
  return `${need.length} posts`;
}

// The embed data X serves for a post names the author's picture; _bigger is 73 px, enough for a 28 px circle at 2x.
async function avatarOf(id) {
  return retry('avatar', async () => {
    const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=a`).catch(() => null);
    if (!res) return { ok: false, why: 'avatar: no response' };
    if (res.status === 429) return { ok: false, limited: true, why: 'avatar: 429' };
    if (!res.ok) return { ok: false, why: `avatar: HTTP ${res.status}` };
    const url = (await res.json().catch(() => ({}))).user?.profile_image_url_https;
    return url ? { ok: true, url: url.replace(/_normal(\.\w+)$/, '_bigger$1') } : { ok: false, why: 'avatar: none in the embed data' };
  });
}

async function avatarStage(posts, st) {
  st.avatar ??= {};
  const need = posts.filter((p) => !p.avatar && !st.avatar[p.id]);
  let missing = 0;
  await pool(need, JOBS.avatar, async (p) => {
    const r = await avatarOf(p.id);
    if (r.ok) st.avatar[p.id] = r.url;
    else missing++;
  });
  return `${need.length - missing} of ${need.length} avatars`;
}

async function posterStage(todo, st, failed) {
  const need = todo.filter(({ id }) => st.video[id] && st.post[id] && !fs.existsSync(path.join(POSTERS, `${id}.webp`)));
  await pool(need, JOBS.poster, async ({ id }) => {
    const r = await poster(id, st.video[id].playback, st.video[id].duration);
    if (!r.ok) failed.set(id, r.why);
  });
  return `${need.length} posters`;
}

// Hand fields (title, types, tags) survive a rebuild; the rest comes from the post.
function entryOf(id, video, post, old = {}) {
  const hint = HINTS[id] ?? {};
  const text = video.description || post.text;
  const prompt = promptFrom(text, hint.promptPublished);
  const source = `https://x.com/${post.handle}/status/${id}`;
  const title = old.title || titleFrom(post.text);
  const made = madeWith([quoted(text, hint.toolQuote), text].join('\n'));
  const saves = Number.isFinite(hint.saves) ? hint.saves : old.saves;
  const likes = Number.isFinite(hint.likes) ? hint.likes : old.likes;
  return {
    id,
    title,
    creator: { name: post.name, handle: post.handle },
    url: source,
    types: typesFrom(`${text}\n${title}`, old.types ?? []),
    tags: old.tags ?? [],
    maker: made.maker,
    model: made.model,
    ...(prompt ? { prompt: { text: prompt, source } } : {}),
    poster: `/inspiration/${id}.webp`,
    playback: video.playback,
    duration: video.duration ?? null,
    ...(saves ? { saves } : {}),
    ...(likes ? { likes } : {}),
    ...(old.avatar ? { avatar: old.avatar } : {}),
  };
}

// No request: maker, model and rule tags from what the entry already holds.
function normalize(p) {
  const known = [p.tool, ...(p.model ?? [])].filter((t) => t && t !== 'unknown').join(', ');
  const made = madeWith(known);
  const { tool, ...rest } = p;
  return { ...rest, maker: p.maker && p.maker !== 'Unknown' ? p.maker : made.maker, model: made.model.length ? made.model : p.model ?? [], types: typesFrom(`${p.title}\n${p.prompt?.text ?? ''}`, p.types) };
}

async function main() {
  const urls = [...new Set(fs.readFileSync(LIST, 'utf8').split('\n').map((l) => l.trim()).filter((l) => /^https:\/\/x\.com\/\w+\/status\/\d+/.test(l)))];
  const data = readJson(DATA, { types: [], posts: [] });
  const known = new Map(data.posts.map((p) => [p.id, p]));
  const only = arg('--ids')?.split(',');
  const todo = urls.map((url) => ({ url, id: idOf(url) })).filter(({ id }) => (only ? only.includes(id) : argv.includes('--refresh') || !known.has(id)));
  const st = readJson(STAGES, { video: {}, post: {} });
  const failed = new Map();
  const save = () => {
    fs.mkdirSync(path.dirname(STAGES), { recursive: true });
    fs.writeFileSync(STAGES, `${JSON.stringify(st)}\n`);
  };
  console.log(`${urls.length} posts listed, ${todo.length} to build`);

  await timed('video', () => videoStage(todo, st, failed));
  save();
  await timed('post', () => postStage(todo, st, failed));
  save();
  await timed('poster', () => posterStage(todo, st, failed));

  let built = 0;
  for (const { id } of todo) {
    if (!st.video[id] || !st.post[id] || !fs.existsSync(path.join(POSTERS, `${id}.webp`))) continue;
    known.set(id, entryOf(id, st.video[id], st.post[id], known.get(id)));
    built++;
  }
  const order = new Map(urls.map((u, i) => [idOf(u), i]));
  await timed('avatar', () => avatarStage([...known.values()], st));
  save();
  for (const p of known.values()) if (!p.avatar && st.avatar[p.id]) p.avatar = st.avatar[p.id];
  data.posts = [...known.values()].map((p) => (argv.includes('--normalize') || !p.maker ? normalize(p) : p)).sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  fs.writeFileSync(DATA, `${JSON.stringify(data, null, 2)}\n`);
  fs.rmSync(TMP, { recursive: true, force: true });

  const untyped = data.posts.filter((p) => !p.types.length).length;
  console.log(`\n${built} built, ${failed.size} failed, ${data.posts.length} entries in all, ${untyped} without a type tag`);
  for (const [id, why] of failed) console.log(`  failed: ${urls.find((u) => idOf(u) === id)}  ${why}`);
}

main();
