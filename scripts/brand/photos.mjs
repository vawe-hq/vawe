// photos.mjs: fetch openly-licensed photos for image layers, with attribution RECORDED.
// Sources Openverse (openverse.org: aggregates Flickr/Wikimedia/museums; no API key), filtered
// to commercial-safe licenses (cc0, pdm, by, by-sa). Never rips arbitrary web images: license
// data travels with the file in credits.json, so published videos stay claim-proof.
//
//   node scripts/brand/photos.mjs "<query>" <brand> [--n 4] [--license cc0,pdm,by]
//   make media X=photos Q="server room" NAME=acme
//
// Output: assets/brands/<brand>/photos/<slug>-<i>.jpg + credits.json (license + author + url).
// Taste rule (enforced by the caller, documented here): photos go in CLIPPED frames with a ken
// burns zoom (layer: {type:'image', src, ken:true}), never raw full-bleed screenshots of moods.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const [query, brand] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1]?.startsWith('--') !== true);
const N = parseInt(flag('--n', '4'), 10);
const LICENSES = flag('--license', 'cc0,pdm,by');
if (!query || !brand) { console.error('usage: node scripts/brand/photos.mjs "<query>" <brand> [--n 4] [--license cc0,pdm,by]'); process.exit(1); }

const dir = path.join(ROOT, 'assets/brands', brand, 'photos');
fs.mkdirSync(dir, { recursive: true });
const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

const api = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=${LICENSES}&size=large&page_size=${Math.min(N * 3, 20)}&fields=id,title,url,creator,license,license_url,foreign_landing_url`;
const res = await fetch(api, { headers: { 'User-Agent': 'vawe-video-engine' }, signal: AbortSignal.timeout(20000) });
if (!res.ok) { console.error(`✗ openverse ${res.status}`); process.exit(1); }
const { results = [] } = await res.json();
if (!results.length) { console.error(`✗ no openly-licensed results for "${query}" (${LICENSES})`); process.exit(1); }

const creditsPath = path.join(dir, 'credits.json');
const credits = fs.existsSync(creditsPath) ? JSON.parse(fs.readFileSync(creditsPath, 'utf8')) : {};
let saved = 0;
let firstFile = '';

// Openverse serves whatever the upstream host stored: commonly WebP, sometimes PNG, from a URL
// that still ends in .jpg. Naming every download .jpg regardless is a lie the browser papers over
// (it sniffs) but nothing else does: a CDN that sets Content-Type from the extension serves a WebP
// as image/jpeg, and any extension-trusting tool in the chain rejects it. Sniff the magic bytes.
function extOf(buf) {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  return 'jpg'; // unknown: keep the historical default rather than invent an extension
}

for (const r of results) {
  if (saved >= N) break;
  try {
    const img = await fetch(r.url, { signal: AbortSignal.timeout(25000) });
    if (!img.ok) continue;
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.length < 30_000) continue; // thumbnails/broken files: too small to print at 1080p
    const file = `${slug}-${saved + 1}.${extOf(buf)}`;
    fs.writeFileSync(path.join(dir, file), buf);
    credits[file] = { title: r.title, creator: r.creator, license: r.license, license_url: r.license_url, source: r.foreign_landing_url, query };
    console.log(`✓ ${file}  (${(buf.length / 1024).toFixed(0)}kb · ${r.license.toUpperCase()} · ${r.creator || 'unknown'})`);
    if (!firstFile) firstFile = file;
    saved++;
  } catch { /* skip slow/dead hosts, keep pulling from the result pool */ }
}
fs.writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + '\n');
if (!saved) { console.error('✗ downloads all failed'); process.exit(1); }
console.log(`→ ${saved} photo(s) in assets/brands/${brand}/photos/ · attribution in credits.json`);
console.log(`  use: { "type": "image", "src": "/assets/brands/${brand}/photos/${firstFile}", "w": 900, "h": 560, "ken": true }`);
if (LICENSES.includes('by')) console.log('  ⚠ CC-BY items need visible credit, put creator in a caption or end-card (see credits.json).');
