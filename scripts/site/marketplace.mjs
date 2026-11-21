// Build the marketplace data: marketplace/{creators,listings,jobs,designers}/*.json are checked against
// site/lib/marketplace-schema.mjs and written to site/lib/marketplace.json. A job past its 60 days is left
// out. Media kept in the repo (marketplace/media/<file>) is copied to site/public/marketplace-media/.
//
//   node scripts/site/marketplace.mjs             build
//   node scripts/site/marketplace.mjs --expired   list the job files past their 60 days
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKS, FOLDERS, entryKey, isExpired, isoDate, jobValidThrough } from '../../site/lib/marketplace-schema.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCAL = /^media\/(.+)$/;
export const MEDIA_ROUTE = '/marketplace-media';

function readFolder(root, kind) {
  const dir = path.join(root, 'marketplace', FOLDERS[kind]);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((file) => {
    const where = `marketplace/${FOLDERS[kind]}/${file}`;
    let entry;
    try {
      entry = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    } catch (e) {
      throw new Error(`${where}: not valid JSON (${e.message})`);
    }
    const errors = CHECKS[kind](entry);
    if (errors.length) throw new Error(`${where}: ${errors.join('; ')}`);
    if (`${entryKey(kind, entry)}.json` !== file) throw new Error(`${where}: the file name must be ${entryKey(kind, entry)}.json`);
    return entry;
  });
}

function templateIds(root) {
  const file = path.join(root, 'site', 'lib', 'templates.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).templates.map((t) => t.id) : [];
}

export function readMarketplace({ root }) {
  const data = Object.fromEntries(Object.keys(FOLDERS).map((kind) => [kind, readFolder(root, kind)]));
  const handles = new Set(data.creator.map((c) => c.handle));
  for (const l of data.listing) if (!handles.has(l.creator)) throw new Error(`marketplace/listings/${l.id}.json: creator ${l.creator} has no file in marketplace/creators`);
  const taken = new Set(templateIds(root));
  for (const l of data.listing) if (taken.has(l.id)) throw new Error(`marketplace/listings/${l.id}.json: id ${l.id} is a vawe template id`);
  return data;
}

export function expiredJobs({ root, today }) {
  return readFolder(root, 'job').filter((j) => isExpired(j, today)).map((j) => ({ file: `marketplace/jobs/${j.id}.json`, validThrough: jobValidThrough(j) }));
}

function mediaFiles(data) {
  const refs = [
    ...data.creator.map((c) => c.avatar),
    ...data.designer.map((d) => d.avatar),
    ...data.listing.flatMap((l) => [l.preview, l.poster]),
  ];
  return refs.map((r) => LOCAL.exec(r ?? '')?.[1]).filter(Boolean);
}

const served = (ref) => {
  const local = LOCAL.exec(ref ?? '');
  return local ? `${MEDIA_ROUTE}/${local[1]}` : ref;
};

function copyMedia(root, files) {
  const outDir = path.join(root, 'site', 'public', MEDIA_ROUTE.slice(1));
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of files) {
    const from = path.join(root, 'marketplace', 'media', file);
    if (!fs.existsSync(from)) throw new Error(`marketplace/media/${file} is named by an entry but is not in the repo`);
    const to = path.join(outDir, file);
    if (!fs.existsSync(to) || !fs.readFileSync(to).equals(fs.readFileSync(from))) fs.copyFileSync(from, to);
  }
  const keep = new Set(files);
  for (const file of fs.readdirSync(outDir)) if (!keep.has(file) && !file.startsWith('.')) fs.rmSync(path.join(outDir, file));
}

export function buildMarketplace({ root, today = isoDate(new Date()) }) {
  const data = readMarketplace({ root });
  copyMedia(root, mediaFiles(data));
  const out = {
    creators: data.creator.map((c) => ({ ...c, avatar: served(c.avatar) })),
    listings: data.listing.map((l) => ({ ...l, preview: served(l.preview), poster: served(l.poster) })),
    jobs: data.job.filter((j) => !isExpired(j, today)),
    designers: data.designer.map((d) => ({ ...d, avatar: served(d.avatar) })),
  };
  for (const key of ['creators', 'listings', 'jobs', 'designers']) out[key] = out[key].map((e) => Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined)));
  fs.writeFileSync(path.join(root, 'site', 'lib', 'marketplace.json'), `${JSON.stringify(out, null, 1)}\n`);
  return { ...out, hidden: data.job.length - out.jobs.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(here, '../..');
  if (!fs.existsSync(path.join(root, 'marketplace'))) {
    console.log('~ marketplace/ is not here; using the committed site/lib/marketplace.json');
    process.exit(0);
  }
  const today = isoDate(new Date());
  if (process.argv.includes('--expired')) {
    const old = expiredJobs({ root, today });
    for (const j of old) console.log(`${j.file}  closed ${j.validThrough}`);
    console.log(`${old.length} expired job(s) on ${today}${old.length ? ': remove them with git rm' : ''}`);
    process.exit(0);
  }
  const out = buildMarketplace({ root, today });
  console.log(`✓ marketplace: ${out.listings.length} listings, ${out.creators.length} creators, ${out.jobs.length} jobs (${out.hidden} expired, hidden), ${out.designers.length} designers -> site/lib/marketplace.json`);
}
