// Write site/lib/lastmod.json: the date each sitemap route last changed, from the last commit that
// touched the file behind it. Run in prebuild. Without a repo history (the Docker build) it leaves
// the committed file alone, so the sitemap never falls back to the build date.
//
//   /            site/app/page.tsx
//   /features    site/app/features/page.tsx
//   /easing/x    site/app/easing/[name]/page.tsx (any one dynamic folder)
//   a page also takes the newest date of the site/lib/content modules it imports (route-sources.mjs)
//   /docs        content/docs/index.mdx in the docs checkout (DOCS_DIR)
//   /docs/x      content/docs/x.mdx in the docs checkout
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { docsDir } from './docs-dir.mjs';
import { lastCommitDate } from './last-commit.mjs';
import { newest, routeSources } from './route-sources.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(root, 'site', 'lib', 'lastmod.json');
const pages = JSON.parse(fs.readFileSync(path.join(root, 'site', 'lib', 'site-pages.json'), 'utf8'));

const DOCS = docsDir(root);
const docsHere = fs.existsSync(DOCS);
if (!fs.existsSync(path.join(root, '.git'))) {
  console.log('~ no git history here; using the committed site/lib/lastmod.json');
  process.exit(0);
}
if (!docsHere) console.log(`~ the docs checkout is not at ${DOCS} (set DOCS_DIR); keeping the committed docs dates`);

function sourceOf(route) {
  if (route.startsWith('/docs')) {
    const slug = route === '/docs' ? 'index' : route.slice('/docs/'.length);
    return path.join(DOCS, 'content', 'docs', `${slug}.mdx`);
  }
  const dir = path.join(root, 'site', 'app', route);
  if (fs.existsSync(path.join(dir, 'page.tsx'))) return path.join(dir, 'page.tsx');
  const parent = path.dirname(dir);
  const dynamic = fs.existsSync(parent) ? fs.readdirSync(parent).filter((d) => /^\[.+\]$/.test(d)) : [];
  return dynamic.length === 1 ? path.join(parent, dynamic[0], 'page.tsx') : null;
}

const committed = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const out = {};
for (const { path: route } of [...pages.routes, ...pages.docs]) {
  const isDoc = route.startsWith('/docs');
  const file = sourceOf(route);
  const files = file && fs.existsSync(file) ? (isDoc ? [file] : routeSources(file)) : [];
  const date = newest(files.map(lastCommitDate));
  const value = date ?? (isDoc && !docsHere ? committed[route] : null);
  if (value) out[route] = value;
}
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}
`);
console.log(`✓ ${Object.keys(out).length} route dates -> site/lib/lastmod.json`);
