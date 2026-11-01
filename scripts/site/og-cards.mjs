#!/usr/bin/env node
// Render vawe.dev's share cards from assets/brand-art/cards.js: one PNG per main page (site/public/og/<route>.png)
// and per blog post (site/public/og/blog/<slug>.png). --loops also renders each main page's share loop
// (site/public/og/<route>.mp4). The opengraph-image.tsx routes serve the PNGs; pageMetadata links the loops.
// site/public/og/stamp.json records a hash of each file's inputs (og-inputs.mjs), so seo-surface can name a stale card.
//   node scripts/site/og-cards.mjs [--loops]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { STAMP, ogInputs, readStamp } from './og-inputs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(SITE, 'public/og');
const sharp = createRequire(path.join(SITE, 'package.json'))('sharp');

function vawe(args) {
  const r = spawnSync(path.join(ROOT, 'bin/vawe'), args, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`bin/vawe ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
}

// A palette PNG measured about 60% smaller than the screenshot, with no pixel off by more than 7 of 255.
async function card(params, out, tmp) {
  const raw = path.join(tmp, 'card.png');
  vawe(['frame', 'assets/brand-art/card.html', '--at', '0', '--aspect', '1200:630', '--size', '1200x630', ...params.flatMap((p) => ['--param', p]), '--out', raw]);
  await sharp(raw).png({ palette: true, quality: 100, effort: 10, compressionLevel: 9 }).toFile(out);
  return fs.statSync(out).size;
}

// dev writes a key-frame sheet beside its output, so the loop renders in tmp and only the mp4 moves to the site.
function loop(route, out, tmp) {
  const raw = path.join(tmp, 'loop.mp4');
  vawe(['dev', 'assets/brand-art/loop.html', '--aspect', '1200:630', '--silent', '--fast', '--no-judge', '--small', '--param', `route=${route}`, '--out', raw]);
  fs.copyFileSync(raw, out);
  return fs.statSync(out).size;
}

function clearStale(dir, ext, keep) {
  for (const f of fs.readdirSync(dir)) if (f.endsWith(ext) && !keep.has(f)) fs.rmSync(path.join(dir, f));
}

const mb = (bytes) => `${(bytes / 1e6).toFixed(2)} MB`;

async function main(argv) {
  const { cards, loops, unused, problems } = ogInputs(ROOT);
  if (problems.length) throw new Error(problems.join('\n'));
  for (const r of unused) console.log(`~ ${r} has a card in assets/brand-art/cards.js PAGES but no route with an opengraph-image.tsx`);
  fs.mkdirSync(path.join(OUT, 'blog'), { recursive: true });
  const stamp = readStamp(ROOT);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'og-cards-'));
  try {
    let bytes = 0;
    for (const c of cards) {
      bytes += await card(c.params, path.join(ROOT, c.file), tmp);
      stamp[c.file] = c.hash;
      console.log(`✓ ${c.file}`);
    }
    clearStale(OUT, '.png', new Set(cards.map((c) => path.basename(c.file))));
    clearStale(path.join(OUT, 'blog'), '.png', new Set(cards.map((c) => path.basename(c.file))));
    console.log(`cards: ${cards.length} PNGs, ${mb(bytes)}`);
    if (argv.includes('--loops')) {
      bytes = 0;
      for (const l of loops) {
        const size = loop(l.route, path.join(ROOT, l.file), tmp);
        bytes += size;
        stamp[l.file] = l.hash;
        console.log(`✓ ${l.file} (${mb(size)})`);
      }
      clearStale(OUT, '.mp4', new Set(loops.map((l) => path.basename(l.file))));
      console.log(`loops: ${loops.length} mp4s, ${mb(bytes)}`);
    }
    const kept = Object.fromEntries(Object.entries(stamp).filter(([file]) => fs.existsSync(path.join(ROOT, file))).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(path.join(ROOT, STAMP), `${JSON.stringify(kept, null, 2)}\n`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main(process.argv.slice(2)).catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
