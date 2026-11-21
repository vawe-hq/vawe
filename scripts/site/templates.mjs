// Build the /templates data: templates/<id>/template.json (free) plus site/lib/templates-pro.json (Pro,
// metadata only) become site/lib/templates.json. The free preview.mp4, poster.webp and page.html are
// copied to site/public/templates/<id>.{mp4,webp,page.html}.
//
//   node scripts/site/templates.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipHash } from '../../harness/lib/clip-hash.mjs';
import { slotListProblem } from '../../harness/lib/template-slots.mjs';
import { templateImportProblems } from '../../harness/lib/template-imports.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CATEGORIES = [
  { id: 'titles', label: 'Titles' },
  { id: 'logos', label: 'Logos' },
  { id: 'product', label: 'Product' },
  { id: 'launch', label: 'Launch' },
  { id: 'explainer', label: 'Explainer' },
  { id: 'social-proof', label: 'Social proof' },
  { id: 'devices', label: 'Devices' },
  { id: 'art', label: 'Art' },
];
const TIERS = ['free', 'pro'];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUMMARY_MAX = 120;

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function check(card, origin) {
  const fail = (why) => { throw new Error(`${origin}: ${why}`); };
  if (!ID.test(card.id ?? '')) fail('id must be lowercase words joined by dashes');
  for (const key of ['title', 'summary', 'structure', 'aspect']) if (typeof card[key] !== 'string' || !card[key]) fail(`${key} is required`);
  if (card.summary.length >= SUMMARY_MAX) fail(`summary must be under ${SUMMARY_MAX} characters`);
  if (!CATEGORIES.some((c) => c.id === card.category)) fail(`category must be one of ${CATEGORIES.map((c) => c.id).join(', ')}`);
  if (!TIERS.includes(card.tier)) fail('tier must be free or pro');
  if (!(card.length > 0)) fail('length must be a number of seconds');
  if (!Array.isArray(card.inputs)) fail('inputs must be a list');
  for (const input of card.inputs) for (const key of ['key', 'label', 'default', 'where']) if (typeof input[key] !== 'string') fail(`every input needs ${key}`);
  if (card.tags !== undefined && !Array.isArray(card.tags)) fail('tags must be a list');
  const slotProblem = slotListProblem(card.slots);
  if (slotProblem) fail(slotProblem);
}

const pick = (card) => ({
  id: card.id,
  title: card.title,
  summary: card.summary,
  category: card.category,
  tier: card.tier,
  length: card.length,
  aspect: card.aspect,
  structure: card.structure,
  inputs: card.inputs,
  slots: (card.slots ?? []).map(({ key, label, kind, size, file, where, span }) => ({ key, label, kind, size, file, where, ...(span ? { span } : {}) })),
  tags: card.tags ?? [],
});

function copyIfChanged(from, to) {
  if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) return;
  fs.copyFileSync(from, to);
}

export function buildTemplates({ root }) {
  const srcDir = path.join(root, 'templates');
  const proFile = path.join(root, 'site', 'lib', 'templates-pro.json');
  const outDir = path.join(root, 'site', 'public', 'templates');
  const dataFile = path.join(root, 'site', 'lib', 'templates.json');
  const free = fs.existsSync(srcDir)
    ? fs.readdirSync(srcDir, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(srcDir, d.name, 'template.json'))).map((d) => d.name).sort()
    : [];
  const pro = fs.existsSync(proFile) ? readJson(proFile) : [];

  const cards = [];
  fs.mkdirSync(outDir, { recursive: true });
  for (const dir of free) {
    const folder = path.join(srcDir, dir);
    const card = readJson(path.join(folder, 'template.json'));
    check(card, `templates/${dir}/template.json`);
    if (card.id !== dir) throw new Error(`templates/${dir}/template.json: id ${card.id} must equal the folder name`);
    if (card.tier !== 'free') throw new Error(`templates/${dir}/template.json: a template in this repo must be free`);
    for (const f of ['page.html', 'preview.mp4', 'poster.webp']) if (!fs.existsSync(path.join(folder, f))) throw new Error(`templates/${dir}: ${f} is missing`);
    for (const slot of card.slots ?? []) if (!fs.existsSync(path.join(folder, slot.file))) throw new Error(`templates/${dir}: slot ${slot.key} has no placeholder file at ${slot.file}`);
    const outside = templateImportProblems(folder);
    if (outside.length) throw new Error(`templates/${dir}: ${outside[0]}`);
    copyIfChanged(path.join(folder, 'preview.mp4'), path.join(outDir, `${card.id}.mp4`));
    copyIfChanged(path.join(folder, 'poster.webp'), path.join(outDir, `${card.id}.webp`));
    copyIfChanged(path.join(folder, 'page.html'), path.join(outDir, `${card.id}.page.html`));
    cards.push({ ...pick(card), hash: clipHash(path.join(folder, 'preview.mp4')), hasSource: true });
  }
  for (const card of pro) {
    check(card, `site/lib/templates-pro.json (${card.id})`);
    if (card.tier !== 'pro') throw new Error(`site/lib/templates-pro.json (${card.id}): tier must be pro`);
    const mp4 = path.join(outDir, `${card.id}.mp4`);
    if (!fs.existsSync(mp4) || !fs.existsSync(path.join(outDir, `${card.id}.webp`))) throw new Error(`site/lib/templates-pro.json (${card.id}): put the public preview in site/public/templates/${card.id}.mp4 and .webp`);
    cards.push({ ...pick(card), hash: clipHash(mp4), hasSource: false });
  }
  const ids = cards.map((c) => c.id);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe) throw new Error(`id ${dupe} is used by a free and a Pro template, or twice`);

  const keep = new Set(cards.flatMap((c) => [`${c.id}.mp4`, `${c.id}.webp`, `${c.id}.page.html`]));
  for (const file of fs.readdirSync(outDir)) if (!keep.has(file) && !file.startsWith('.')) fs.rmSync(path.join(outDir, file));

  fs.writeFileSync(dataFile, `${JSON.stringify({ categories: CATEGORIES, templates: cards }, null, 1)}\n`);
  return cards;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(here, '../..');
  if (!fs.existsSync(path.join(root, 'templates'))) {
    console.log('~ templates/ is not here; using the committed site/lib/templates.json');
    process.exit(0);
  }
  const cards = buildTemplates({ root });
  console.log(`✓ ${cards.length} templates -> site/lib/templates.json, site/public/templates`);
}
