// localize-assets.mjs: make a CAPTURED component self-contained, so a render never touches the network.
//
// `make media X=capture` lifts a real UI block off a live site and absolutizes every asset URL against that
// site. That makes the capture depend, at RENDER time, on a third party's CDN: the render is not
// reproducible, it degrades offline with no error, and an archived film silently changes when the site
// does. This module pulls every referenced asset next to the JSON and rewrites the markup to point at
// the local copy.
//
// TWO ENTRY POINTS, one rule:
//   • at capture time: capture-component.mjs / capture-scene.mjs call localizeHtml() before writing
//   • after the fact, `node scripts/brand/localize-assets.mjs [--write] [paths…]` repairs captures
//     already on disk, and with no --write reports the remaining debt.
//
// WHY A FILE BESIDE THE JSON, NOT A data: URI. core/seams.js inlines FONTS as data: URIs, and that is
// the right answer THERE for a reason that does not apply here: a url() cannot resolve at all inside
// the isolated SVG <foreignObject> raster, so the bytes have to travel in the stylesheet. Our problem
// is a network dependency, and a local file removes it just as completely. Against data:, base64
// inflates the bytes by a third into a checked-in JSON that git stores as one blob, so a re-capture
// rewrites megabytes and the diff is unreadable; a file beside it is content-addressed, shared between
// captures of the same asset, and diffs as one added binary. The known cost is that a component inside
// a SEAM bake still renders its images blank (core/seams.js:371), that limitation already applies to
// every `image` layer in the repo, so a component is not special, and curing it belongs in seams.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { isMain } from '../../harness/lib/is-main.mjs';

// ---- what counts as an image ---------------------------------------------------------------------
// Parsed BY CONTEXT, never by "any http URL in the text". A capture is full of URLs that are not
// assets and must never be fetched: the SVG namespace `http://www.w3.org/2000/svg` sits in an xmlns,
// and an <a href> is a hyperlink the renderer never loads. Both were in the naive scan this replaces.
//
// Each entry maps a tag to the attributes on it that name an asset, and how to read that attribute's
// value: 'url' (one URL), 'srcset' (a candidate list), 'css' (a stylesheet fragment with url()).
const ASSET_ATTRS = {
  img: { src: 'url', srcset: 'srcset' },
  source: { src: 'url', srcset: 'srcset' },
  video: { src: 'url', poster: 'url' },
  audio: { src: 'url' },
  track: { src: 'url' },
  image: { href: 'url', 'xlink:href': 'url' },   // SVG <image>
  use: { href: 'url', 'xlink:href': 'url' },     // SVG <use> pointing at an external file
  body: { background: 'url' },
  table: { background: 'url' },
  td: { background: 'url' },
};
// `style="…url(…)"` on ANY element, and the text of any <style> block. Both carry background-image,
// mask-image, border-image, list-style-image, @font-face src, cursor.
const STYLE_ATTR = 'css';

// DELIBERATELY NOT LOCALIZED, and each for a reason rather than by omission:
//   • <a href>, <link href>, <form action>: navigation, not an asset the frame paints
//   • xmlns / xmlns:xlink. An XML namespace name, not a fetchable document
//   • <use href="#id">, an in-document fragment reference
//   • data: / blob: URIs, already self-contained
//   • <object data>, <iframe src>. Embedding elements; core/sanitize-html.js removes them
//   • data-src / data-srcset (lazy loaders). The capture promotes the real src before this runs, and
//     a data-* attribute is never fetched by the browser, so copying it would add bytes that no frame
//     can paint. A capture that still shows a placeholder is a settle bug, not a localization one.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
// A capture stores attribute TEXT, so `?url=…&w=1200` arrives as `&amp;w=1200`. Fetching that literal
// string asks for a different URL than the browser resolves, which is how the first attempt at this
// preloaded seven URLs nobody was drawing (core/preload.js says the same about its own first version).
export function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, ref) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[ref.toLowerCase()] ?? m;
  });
}

const isRemote = (u) => /^(https?:)?\/\//i.test(u.trim());

// splitRef(raw) → { url, hash }. A protocol-relative `//host/x` is not a URL node can fetch, so it is
// resolved to https. A `#fragment` names a node INSIDE the file (an SVG <use href="sprite.svg#icon">):
// the fragment-less URL is what gets downloaded, and the fragment has to survive into the local path
// or the <use> resolves to nothing.
function splitRef(raw) {
  const s = decodeEntities(raw).trim();
  const cut = s.indexOf('#');
  const hash = cut < 0 ? '' : s.slice(cut);
  const url = (cut < 0 ? s : s.slice(0, cut)).replace(/^\/\//, 'https://');
  return { url, hash };
}

// ---- the scanner ---------------------------------------------------------------------------------
// One tokenizer, one rewriter, driven by the same table. Collecting and rewriting share this function
// so the set of URLs downloaded can never drift from the set of URLs replaced.
//
// LIMIT, stated rather than hidden: this is a regex tokenizer, not an HTML parser (node has no
// DOMParser and this repo does not add dependencies for one). It reads quoted and unquoted attributes
// on well-formed tags, which is what a capture emits, because a capture is serialised by the browser's
// own outerHTML. It would misread hand-written markup with an unclosed quote.
const TAG = /<([a-zA-Z][-a-zA-Z0-9:]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTR = /([-:.a-zA-Z_][-:.a-zA-Z0-9_]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
const STYLE_BLOCK = /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi;
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")]*))\s*\)/gi;

// walkHtml(html, onUrl) → rewritten html. `onUrl(rawValue)` receives the RAW attribute text of one URL
// and returns a replacement (also raw text), or null to leave it alone. Collection passes return null
// from onUrl and record what they saw; the rewrite pass returns the local path.
function walkHtml(html, onUrl) {
  const css = (text) => text.replace(CSS_URL, (m, dq, sq, bare) => {
    const raw = dq ?? sq ?? bare ?? '';
    const next = onUrl(raw);
    return next == null ? m : `url("${next}")`;
  });
  const out = String(html).replace(TAG, (tag, name, attrs) => {
    const table = ASSET_ATTRS[name.toLowerCase()] || {};
    const rewritten = attrs.replace(ATTR, (m, attr, value) => {
      const quote = value[0] === '"' || value[0] === "'" ? value[0] : '';
      const raw = quote ? value.slice(1, -1) : value;
      const kind = attr.toLowerCase() === 'style' ? STYLE_ATTR : table[attr.toLowerCase()];
      if (!kind) return m;
      let next;
      if (kind === 'css') next = css(raw);
      else if (kind === 'srcset') next = rewriteSrcset(raw, onUrl);
      else next = onUrl(raw) ?? raw;
      if (next === raw) return m;
      return `${attr}=${quote || '"'}${next}${quote || '"'}`;
    });
    return `<${name}${rewritten}>`;
  });
  // <style> bodies are text between tags, so the tag walk above cannot see them.
  return out.replace(STYLE_BLOCK, (m, open, body, close) => open + css(body) + close);
}

// A srcset is a comma-separated candidate list, each `<url> <descriptor>`. Every candidate is a real
// asset the browser may choose, so every candidate is localized. capture-component.mjs promotes the
// largest candidate into src and then strips srcset, but capture-scene.mjs and any hand-edited
// component still carry one, and "the easy one only" is the failure this repo logs most.
function rewriteSrcset(raw, onUrl) {
  return raw.split(',').map((cand) => {
    const t = cand.trim();
    if (!t) return cand;
    const sp = t.search(/\s/);
    const url = sp < 0 ? t : t.slice(0, sp);
    const rest = sp < 0 ? '' : t.slice(sp);
    const next = onUrl(url);
    return (next == null ? url : next) + rest;
  }).join(', ');
}

// collectRemoteUrls(html) → decoded absolute URLs, in first-seen order (deterministic).
export function collectRemoteUrls(html) {
  const seen = new Map();
  walkHtml(html, (raw) => {
    if (!isRemote(raw)) return null;
    seen.set(splitRef(raw).url, true);
    return null;
  });
  return [...seen.keys()];
}

// ---- downloading ---------------------------------------------------------------------------------
// Sniff the bytes rather than trusting the URL or the header. A CDN that answers a hotlink with a 200
// and an HTML error page would otherwise be written to disk as `<hash>.png` and render as a broken
// box: exactly the silent substitution this repo treats as its most expensive bug class.
const MAGIC = [
  { ext: '.png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: '.jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.gif', test: (b) => b.slice(0, 3).toString('latin1') === 'GIF' },
  { ext: '.webp', test: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP' },
  { ext: '.avif', test: (b) => b.slice(4, 8).toString('latin1') === 'ftyp' && /avif|avis/.test(b.slice(8, 12).toString('latin1')) },
  { ext: '.ico', test: (b) => b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00 },
  { ext: '.svg', test: (b) => /^\s*(<\?xml|<svg|<!--)/i.test(b.slice(0, 200).toString('utf8')) && /<svg[\s>]/i.test(b.slice(0, 4096).toString('utf8')) },
];
// Media the markup may reference but no frame paints. Kept local anyway (the point is that the file
// stops reaching the network), identified by header because they have no image magic.
const MEDIA_MIME = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/ogg': '.ogg', 'video/quicktime': '.mov', 'font/woff2': '.woff2', 'font/woff': '.woff' };

function extensionFor(buf, contentType) {
  for (const m of MAGIC) if (m.test(buf)) return m.ext;
  const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (MEDIA_MIME[mime]) return MEDIA_MIME[mime];
  return null;
}

// exported: the one verified (magic-byte-checked, never zero-byte) fetch, reused wherever a caller
// needs a site's own media instead of a second bare-fetch implementation.
export async function download(url, referer) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      // Some CDNs answer a bare fetch with a 403 and serve the same bytes to a browser. Sending a UA
      // and the page we captured from asks for the file the capture actually painted.
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,*/*;q=0.8',
      ...(referer ? { referer } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('empty response');
  const ext = extensionFor(buf, res.headers.get('content-type'));
  if (!ext) throw new Error(`not an image or media file (content-type ${res.headers.get('content-type') || 'unknown'}, ${buf.length}b)`);
  return { buf, ext };
}

// ---- the one operation ---------------------------------------------------------------------------
// localizeHtml(html, opts) → { html, localized, failures }
//   mediaDir   absolute directory the bytes are written into
//   publicBase the URL prefix the render server serves that directory from
//   referer    the page the capture came from
//
// Names are the sha1 of the URL, matching the media files already on disk, so an asset shared by two
// captures is downloaded and stored once.
export async function localizeHtml(html, { mediaDir, publicBase, referer } = {}) {
  const urls = collectRemoteUrls(html);
  const local = new Map();       // decoded url → public path
  const failures = [];           // { url, reason }
  for (const url of urls) {
    const key = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
    const existing = fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir).find((f) => f.startsWith(key + '.')) : null;
    if (existing) { local.set(url, `${publicBase}/${existing}`); continue; }
    try {
      const { buf, ext } = await download(url, referer);
      fs.mkdirSync(mediaDir, { recursive: true });
      fs.writeFileSync(path.join(mediaDir, key + ext), buf);
      local.set(url, `${publicBase}/${key}${ext}`);
    } catch (e) {
      failures.push({ url, reason: e.message });
    }
  }
  const out = walkHtml(html, (raw) => {
    if (!isRemote(raw)) return null;
    const { url, hash } = splitRef(raw);
    const got = local.get(url);
    return got == null ? null : got + hash;
  });
  return { html: out, localized: local.size, failures };
}

// localizeCapture(capture, opts) → the same shape, applied to every html field a capture can carry:
// `html` on a component, and `parts[].html` on a captured scene. One function so the scene capture
// cannot be the call site somebody forgets.
export async function localizeCapture(capture, opts) {
  let localized = 0; const failures = [];
  const one = async (html) => {
    const r = await localizeHtml(html, opts);
    localized += r.localized; failures.push(...r.failures);
    return r.html;
  };
  if (typeof capture.html === 'string') capture.html = await one(capture.html);
  for (const p of Array.isArray(capture.parts) ? capture.parts : []) {
    if (typeof p.html === 'string') p.html = await one(p.html);
  }
  return { localized, failures };
}

// mediaTargetFor(jsonPath, root) → where a capture's bytes live and how the render server names them.
// Derived from the JSON's own location, so `components/x.json` and `scenes/x.json` both work.
export function mediaTargetFor(jsonPath, root) {
  const dir = path.dirname(path.resolve(jsonPath));
  return { mediaDir: path.join(dir, 'media'), publicBase: '/' + path.relative(root, dir).split(path.sep).join('/') + '/media' };
}

// ---- CLI: repair captures already on disk --------------------------------------------------------
//   node scripts/brand/localize-assets.mjs                 # report the debt across every capture
//   node scripts/brand/localize-assets.mjs --write         # download and rewrite in place
//   node scripts/brand/localize-assets.mjs --write a.json  # one file
if (isMain(import.meta.url)) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  let targets = args.filter((a) => !a.startsWith('--'));
  if (!targets.length) {
    const brands = path.join(ROOT, 'assets/brands');
    for (const b of fs.readdirSync(brands)) {
      for (const sub of ['components', 'scenes']) {
        const d = path.join(brands, b, sub);
        if (!fs.existsSync(d)) continue;
        for (const f of fs.readdirSync(d)) if (f.endsWith('.json')) targets.push(path.join(d, f));
      }
    }
  }
  let dirty = 0, fixed = 0, stillRemote = 0;
  for (const t of targets) {
    const capture = JSON.parse(fs.readFileSync(t, 'utf8'));
    const before = [capture.html || '', ...(capture.parts || []).map((p) => p.html || '')].join('');
    const urls = collectRemoteUrls(before);
    if (!urls.length) continue;
    dirty++;
    const rel = path.relative(ROOT, t);
    if (!write) { console.log(`${rel}  ${urls.length} remote asset(s)`); urls.forEach((u) => console.log(`    ${u}`)); continue; }
    const sizeBefore = fs.statSync(t).size;
    const { localized, failures } = await localizeCapture(capture, { ...mediaTargetFor(t, ROOT), referer: capture.url });
    if (localized) {
      fs.writeFileSync(t, JSON.stringify(capture, null, 0) + '\n');
      fixed++;
      console.log(`✓ ${rel}  ${localized} localized  ${sizeBefore}b → ${fs.statSync(t).size}b`);
    }
    for (const f of failures) { stillRemote++; console.error(`✗ ${rel}  ${f.reason}: ${f.url}`); }
  }
  if (!write) console.log(dirty ? `\n${dirty} capture(s) still reach the network. Run with --write to localize them.` : '✓ every capture is self-contained');
  else console.log(`\n${fixed} capture(s) rewritten, ${stillRemote} asset(s) still remote`);
  if (write && stillRemote) process.exit(1);
}
