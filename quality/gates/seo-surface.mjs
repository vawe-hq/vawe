#!/usr/bin/env node
// quality/gates/seo-surface.mjs: does the marketing site's SEO surface still hold?
//
//   node quality/gates/seo-surface.mjs [--json]   ·   vawe check seo-surface
//
// WHY THIS EXISTS. sitemap.ts, robots.ts, seo.ts, ogCard.tsx and schema.ts (all landed 2026-09-19,
// see their own file headers) are each a fact nothing used to check: a new route with no canonical, a
// renamed docs page the sitemap still lists, a deleted opengraph-image.tsx, a JSON-LD builder missing
// a field its type requires. Every one of those is invisible in a diff and only shows up months later
// in Search Console or a broken shared-link preview. This is the read that would have caught it.
//
// FOUR ASSERTIONS, ALL HARD. Today's count is 0 for each (verified 2026-09-19), so none of these is a
// ratchet: the ratchet idiom (quality/gates/output-contract.mjs, quality/gates/ledger.mjs unjudged) exists to
// let an ALREADY-nonzero count fall gradually. There is nothing to grandfather in here; a fresh
// violation is the whole failure mode.
//
//   1. every route under site/app/ that renders a page has a canonical
//   2. every detail route (every route but home) has its own opengraph-image.tsx, and every pre-rendered
//      share card it serves exists (a stale card or a missing loop only warns)
//   3. the sitemap (site/lib/site-pages.json, the file site/app/sitemap.ts reads) matches the real
//      routes
//   4. every JSON-LD builder in site/lib/schema.ts parses and carries the fields its schema.org type
//      requires
//
// WHAT THIS CANNOT SEE, STATED RATHER THAN LEFT SILENT
// (quality/gates/silent-fallback.mjs). This never runs `next build` or fetches a live sitemap.xml: it
// is a STATIC read, the same shape as quality/gates/generated-check.mjs. So it cannot catch a page
// that calls pageMetadata() but throws before returning, a metadata export next.js silently drops for
// a framework reason, or a bug in sitemap.ts's OWN loop body that still imports the right files and
// emits the wrong string. Assertion 3 is therefore "the wiring points at the same registries and the
// registries match the filesystem", not "the rendered sitemap.xml is correct"; if that gap matters,
// quality/gates/site-build-check.mjs already runs the real `next build`, and this gate says so instead
// of claiming more than it checked. Assertion 4 executes each builder for real (not just greps its
// source), so it does see a genuinely broken JSON-LD object.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DOCS_ORIGIN } from '../../site/lib/docs-origin.mjs';
import { docsDir } from '../../scripts/site/docs-dir.mjs';
import { gateFindings } from '../../harness/lib/findings.mjs';
import { docsLinks, parseFrontMatter } from '../../site/lib/blog-front-matter.mjs';
import { ogInputs, readStamp } from '../../scripts/site/og-inputs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE_APP = path.join(ROOT, 'site/app');
const SITE_LIB = path.join(ROOT, 'site/lib');
const DOCS_DIR = path.join(docsDir(ROOT), 'content/docs');
const rel = (p) => path.relative(ROOT, p);
const read = (p) => fs.readFileSync(p, 'utf8');

const f = gateFindings();

// ---------------------------------------------------------------------------------------------
// Every page.tsx under site/app, i.e. every route the site actually serves. Walking the
// filesystem, not a hand-kept list: a route with no page.tsx forgotten anywhere.
function findPageFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findPageFiles(full));
    else if (entry.name === 'page.tsx') out.push(full);
  }
  return out;
}

const pageFiles = findPageFiles(SITE_APP).sort();
const HOME = path.join(SITE_APP, 'page.tsx');

// Route path relative to site/app: site/app/launch-video/page.tsx -> /launch-video, home -> /
const routePathOf = (pageFile) => {
  const r = path.relative(SITE_APP, path.dirname(pageFile)).split(path.sep).join('/');
  return r === '' ? '/' : `/${r}`;
};
const isDynamicRoute = (routePath) => routePath.includes('[');
// A catch-all segment owns the URLs no route claims (the bot-logging 404), so it has no canonical or card.
const isCatchAll = (pageFile) => /\[\.\.\./.test(path.relative(SITE_APP, pageFile));
// /vs/[slug] -> a pattern that matches /vs/remotion.
const routePattern = (routePath) => new RegExp(`^${routePath.replace(/\[[^\]]+\]/g, '[^/]+')}$`);

// ===== 1. every route has a canonical ==========================================================
{
  const homeCanonical = /alternates:\s*\{\s*canonical:\s*["']\/["']/;
  if (!homeCanonical.test(read(path.join(SITE_APP, 'layout.tsx'))) && !homeCanonical.test(read(HOME))) {
    f.fail('seo-no-canonical', 'the home route "/" has no canonical in site/app/page.tsx or the root layout', {
      at: 'site/app/page.tsx',
      fix: 'export metadata with alternates.canonical "/" from site/app/page.tsx',
    });
  }
  for (const p of pageFiles) {
    if (p === HOME || isCatchAll(p)) continue;
    const src = read(p);
    if (!/\bpageMetadata\s*\(/.test(src)) {
      f.fail('seo-no-canonical', `${rel(p)} sets no metadata through pageMetadata(), so it has no canonical`, {
        at: rel(p),
        fix: 'import { pageMetadata } from "site/app/components/seo" and build the route\'s metadata (or generateMetadata) with it',
      });
    }
  }
}

// ===== 2. every detail route has its own opengraph-image =======================================
for (const p of pageFiles) {
  if (p === HOME || isCatchAll(p)) continue; // the home card is hand-made, set in app/layout.tsx
  const ogFile = path.join(path.dirname(p), 'opengraph-image.tsx');
  if (!fs.existsSync(ogFile)) {
    f.fail('seo-no-og-image', `${routePathOf(p)} has no opengraph-image.tsx, so its share card falls back to the site default`, {
      at: rel(p),
      fix: `add ${rel(ogFile)} (see site/app/components/ogCard.tsx for the shared card renderer)`,
    });
  }
}

// ===== 2b. every share card is rendered and current ===============================================
// The main routes and the posts serve pre-rendered PNGs (scripts/site/og-cards.mjs): a missing one is a 500 on og:image.
// A stale one still serves, so it only advises; so does a missing loop, since og:video is left out without its file.
{
  const RENDER = 'node scripts/site/og-cards.mjs';
  const { cards, loops, unused, problems } = ogInputs(ROOT);
  const stamp = readStamp(ROOT);
  for (const p of problems) f.fail('seo-og-inputs', p, { fix: 'give the route a PAGES entry, or the post a section and topic that exist' });
  for (const c of cards) {
    if (!fs.existsSync(path.join(ROOT, c.file))) f.fail('seo-og-card-missing', `${c.file} is missing, so its og:image route errors`, { fix: RENDER });
    else if (stamp[c.file] !== c.hash) f.warn('seo-og-card-stale', `${c.file} was rendered from other inputs than its page or post has now`, { fix: RENDER });
  }
  for (const l of loops) {
    if (!fs.existsSync(path.join(ROOT, l.file))) f.warn('seo-og-loop-missing', `${l.route} has a loop in cards.js but no ${l.file}, so it has no og:video`, { fix: `${RENDER} --loops` });
    else if (stamp[l.file] !== l.hash) f.warn('seo-og-loop-stale', `${l.file} was rendered from other inputs than its page has now in cards.js`, { fix: `${RENDER} --loops` });
  }
  for (const r of unused) f.warn('seo-og-page-unused', `${r} has a card in assets/brand-art/cards.js PAGES but no route with an opengraph-image.tsx`, { fix: 'remove the entry, or fix its route' });
}

// ===== 3. the sitemap matches the routes =========================================================
{
  const pagesJson = JSON.parse(read(path.join(SITE_LIB, 'site-pages.json')));

  // 3a. hand-written routes: every static (non-dynamic) page.tsx directory but home must appear in
  // site-pages.json's `routes`, and every entry there must have a real page behind it.
  const staticRoutePaths = new Set(
    pageFiles.map(routePathOf).filter((r) => !isDynamicRoute(r)),
  );
  const listedRoutePaths = new Set((pagesJson.routes || []).map((r) => r.path));

  for (const r of staticRoutePaths) {
    if (!listedRoutePaths.has(r)) {
      f.fail('seo-sitemap-missing-route', `${r} has a page.tsx but no entry in site-pages.json, so the sitemap never lists it`, {
        at: 'site/lib/site-pages.json',
        fix: `add ${r} to site/lib/site-pages.json`,
      });
    }
  }
  const dynamicPatterns = pageFiles.map(routePathOf).filter(isDynamicRoute).map(routePattern);
  for (const r of listedRoutePaths) {
    if (!staticRoutePaths.has(r) && !dynamicPatterns.some((re) => re.test(r))) {
      f.fail('seo-sitemap-phantom-route', `${r} is listed in site-pages.json but no page.tsx renders it`, {
        at: 'site/lib/site-pages.json',
        fix: `remove ${r} from site/lib/site-pages.json (or restore the page)`,
      });
    }
  }

  // 3b. docs: the same slugs site-pages.mjs computes from the docs checkout's content/docs, compared against
  // what site-pages.json actually holds (catches a stale, un-regenerated commit of the file itself).
  const docSlugs = fs.existsSync(DOCS_DIR)
    ? fs.readdirSync(DOCS_DIR).filter((n) => n.endsWith('.mdx')).map((n) => n.replace(/\.mdx$/, ''))
    : null;
  if (docSlugs === null) {
    f.warn('seo-sitemap-docs-unreadable', `${rel(DOCS_DIR)} does not exist here, so docs sitemap coverage cannot be checked`, {
      at: rel(DOCS_DIR),
      fix: 'check out vawe-hq/vawe-docs next to this repo, or set DOCS_DIR to it',
    });
  } else {
    const expectedDocPaths = new Set(docSlugs.map((s) => (s === 'index' ? '/docs' : `/docs/${s}`)));
    const listedDocPaths = new Set((pagesJson.docs || []).map((d) => d.path));
    for (const p of expectedDocPaths) {
      if (!listedDocPaths.has(p)) {
        f.fail('seo-sitemap-missing-route', `${p} is a real docs page but is missing from site-pages.json`, {
          at: 'site/lib/site-pages.json',
          fix: 'update the docs list in site/lib/site-pages.json',
        });
      }
    }
    for (const p of listedDocPaths) {
      if (!expectedDocPaths.has(p)) {
        f.fail('seo-sitemap-phantom-route', `${p} is listed in site-pages.json but no docs/*.mdx backs it`, {
          at: 'site/lib/site-pages.json',
          fix: 'update the docs list in site/lib/site-pages.json',
        });
      }
    }
  }

  // 3c. the docs app's own page list, when a docs origin answers: a page it serves that the sitemap lacks is a warning.
  try {
    const res = await fetch(`${DOCS_ORIGIN}/docs/llms-index.json`, { signal: AbortSignal.timeout(3000) });
    const served = res.ok ? (await res.json()).map((d) => new URL(d.url).pathname.replace(/\.md$/, '').replace(/\/+$/, '')) : [];
    const listed = new Set((pagesJson.docs || []).map((d) => d.path));
    for (const p of served) {
      if (!listed.has(p)) {
        f.warn('seo-sitemap-docs-missing', `${p} is served by the docs app at ${DOCS_ORIGIN} but missing from site-pages.json`, {
          at: 'site/lib/site-pages.json',
          fix: 'add it to the docs list in site/lib/site-pages.json',
        });
      }
    }
  } catch {
    // no docs origin answers: nothing to compare
  }
}

// ===== 4. every JSON-LD builder parses and carries its required fields =========================
{
  const schemaFile = path.join(SITE_LIB, 'schema.ts');
  const probeFile = path.join(SITE_LIB, '_seo-surface-schema-probe.mts');
  // Co-located with the probe file, not under harness/dev/: doc-refs.mjs's self-ref scan flags any
  // quoted `harness/.../*.mjs` path it cannot find on disk, and this one exists only for the width of
  // this run.
  const runnerFile = path.join(SITE_LIB, '_seo-surface-schema-runner.mjs');
  try {
    // Node's native TS type-stripping cannot resolve a plain `import pkg from "../../package.json"`
    // (it needs an explicit import attribute); this is the one line schema.ts needs rewritten to run
    // outside a bundler. Written into site/lib/ (not os.tmpdir()) so the relative import still
    // resolves, and deleted in the finally block below whatever happens.
    const patched = read(schemaFile).replace(
      'import pkg from "../../package.json";',
      'import pkg from "../../package.json" with { type: "json" };',
    ).replace(/from "(\.\/[\w-]+)";/g, (m, spec) => (fs.existsSync(path.join(SITE_LIB, `${spec}.ts`)) ? `from "${spec}.ts";` : m));
    if (patched === read(schemaFile)) {
      f.fail('seo-schema-probe-broken', 'schema.ts no longer imports package.json the way this gate expects to patch', {
        at: 'site/lib/schema.ts',
        fix: 'update the string this gate patches in quality/gates/seo-surface.mjs (or this check to reflect the new import)',
      });
    }
    fs.writeFileSync(probeFile, patched);

    const runner = `
import * as m from ${JSON.stringify(`file://${probeFile}`)};
const out = {};
out.organization = m.organizationSchema();
out.website = m.websiteSchema();
out.softwareApplication = m.softwareApplicationSchema();
out.breadcrumb = m.breadcrumbSchema([{ name: 'Moves', url: '/video-components' }, { name: 'probe', url: '/video-components/probe' }]);
process.stdout.write(JSON.stringify(out));
`;
    fs.writeFileSync(runnerFile, runner);

    let stdout;
    try {
      stdout = execFileSync('node', ['--experimental-strip-types', runnerFile], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      f.fail('seo-schema-parse-error', `site/lib/schema.ts failed to run: ${String(e.stderr || e.message).slice(0, 300)}`, {
        at: 'site/lib/schema.ts',
        fix: 'fix the syntax/runtime error above; every JSON-LD builder must run standalone',
      });
      stdout = null;
    }

    if (stdout) {
      let objs;
      try { objs = JSON.parse(stdout); }
      catch (e) {
        f.fail('seo-schema-parse-error', `schema.ts builders ran but their combined output does not parse as JSON: ${e.message}`, {
          at: 'site/lib/schema.ts',
          fix: 'each builder must return a plain JSON-serialisable object',
        });
        objs = null;
      }

      if (objs) {
        // Required fields per schema.org type. Not the whole spec, the fields Google/rich-result
        // validators actually require, matching the file header's own reasoning for each type.
        const REQUIRED = {
          organization: ['@type', 'name', 'url'],
          website: ['@type', 'name', 'url'],
          softwareApplication: ['@type', 'name', 'url', 'applicationCategory', 'offers'],
          breadcrumb: ['@type', 'itemListElement'],
        };
        for (const [key, fields] of Object.entries(REQUIRED)) {
          const obj = objs[key];
          for (const field of fields) {
            if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
              f.fail('seo-schema-missing-field', `${key}Schema() is missing required field "${field}"`, {
                at: 'site/lib/schema.ts',
                fix: `set "${field}" in ${key}Schema()'s returned object`,
              });
            }
          }
        }
        // softwareApplication.offers and breadcrumb.itemListElement carry their own required shape.
        const offers = objs.softwareApplication?.offers;
        if (offers && (!offers.price || !offers.priceCurrency)) {
          f.fail('seo-schema-missing-field', 'softwareApplicationSchema().offers is missing price or priceCurrency', {
            at: 'site/lib/schema.ts',
            fix: 'set both price and priceCurrency on the Offer object',
          });
        }
        const items = objs.breadcrumb?.itemListElement;
        if (Array.isArray(items)) {
          items.forEach((item, i) => {
            for (const field of ['@type', 'position', 'name', 'item']) {
              if (item[field] === undefined) {
                f.fail('seo-schema-missing-field', `breadcrumbSchema() item ${i} is missing required field "${field}"`, {
                  at: 'site/lib/schema.ts',
                  fix: `every ListItem in breadcrumbSchema() must set "${field}"`,
                });
              }
            }
          });
        }
      }
    }
  } finally {
    fs.rmSync(probeFile, { force: true });
    fs.rmSync(runnerFile, { force: true });
  }
}

// ===== 5. every post points at docs pages that exist ============================================
// Advises only: a post with no `docs:` line, or one that names a slug the docs repo has no page for.
if (fs.existsSync(DOCS_DIR)) {
  const BLOG_DIR = path.join(ROOT, 'site/content/blog');
  const pages = new Set(fs.readdirSync(DOCS_DIR).filter((n) => n.endsWith('.mdx')).map((n) => n.replace(/\.mdx$/, '')));
  for (const file of fs.readdirSync(BLOG_DIR).filter((n) => n.endsWith('.md') && n !== 'README.md' && !n.startsWith('_')).sort()) {
    const { data } = parseFrontMatter(file, read(path.join(BLOG_DIR, file)));
    const links = docsLinks(file, data);
    if (!links.length) f.warn('seo-blog-no-docs', `site/content/blog/${file} has no docs: line, so the post links to no docs page`, { at: `site/content/blog/${file}`, fix: 'add docs: <slug>, <slug> to its front matter' });
    for (const l of links) {
      if (!pages.has(l.slug)) f.warn('seo-blog-docs-missing', `site/content/blog/${file} names docs page "${l.slug}", which has no page in ${rel(DOCS_DIR)}`, { at: `site/content/blog/${file}`, fix: 'fix the slug in docs:, or write the page' });
    }
  }
}

// ---------------------------------------------------------------------------------------------
console.log(`\n  SEO SURFACE · ${pageFiles.length} route(s) checked · ${f.count} finding(s)\n`);
f.emit();
if (f.records.some((r) => r.severity === 'error')) process.exit(1);
