// The reference films the fresh judge compares a film with. They are other people's films: they live
// on one machine in a folder outside the repo ($VAWE_REFS_DIR, default ~/.vawe/refs), never in git.
// Pure helpers and the registry file (refs.json). harness/dev/refs.mjs is the `vawe refs` verb;
// harness/media/judge-fresh.mjs picks the references for a film with pickRefs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const REGISTRY = 'refs.json';
export const VERIFIED = 'reference_films_verified.md';
export const SHEETS = 'judge-sheets';
export const TYPES = ['product', 'brand'];
export const REFS_PER_FILM = 2;

/** The words of argv that are neither a flag nor the value of --type or --title. Pure. */
export const positionals = (argv) => argv.filter((a, i) => !a.startsWith('--') && !['--type', '--title'].includes(argv[i - 1]));

/** The steps of `refs add`: fetch, then measure unless the flag asks for fetch only. Pure. */
export function addPlan({ noMeasure }) {
  return noMeasure ? ['fetch', 'record'] : ['fetch', 'measure', 'record'];
}

// Films in the verified list that no page film can match: live action, 3D CG, or a reel of many works.
const OUT_OF_SCOPE = {
  vO9YGI5Gf4s: 'live action',
  YVOw0TAO9ok: 'live action',
  UZYp5XFm1Mk: '3D CG',
  'UGlBlkB4b-U': '3D CG',
  SxYzrzRjfsI: 'studio reel, not one film',
};

// The template a brief names (prompts/<file>) and the kind of film it makes.
const TEMPLATE_TYPE = {
  'brand-launch-from-url.md': 'product',
  'ui-morph-loop.md': 'product',
  'interactive-lab-capture.md': 'product',
  'story-explainer.md': 'product',
  'beat-sheet.md': 'brand',
  'showreel-one-liner.md': 'brand',
  'music-video-beat-synced.md': 'brand',
  'directors-brief-long-form.md': 'brand',
};

export const refsDir = (env = process.env, home = os.homedir()) => env.VAWE_REFS_DIR || path.join(home, '.vawe', 'refs');

const cleanStudio = (s) => s.replace(/\(.*?\)/g, '').split(';')[0].trim();
const fileId = (text) => /`(?:[^`]*\/)?([^/`]+)\.(?:mp4|webm)`/.exec(text)?.[1] ?? null;

function entry({ id, title, studio, seconds, type }) {
  const why = OUT_OF_SCOPE[id] ?? (type ? null : 'weak fit');
  return { id, title, studio, type: why ? null : type, seconds, inScope: !why, why };
}

/** The films of reference_films_verified.md: [{ id, title, studio, type, seconds, inScope, why }]. Section A is product, B and C are brand, the "weak fit" list is out of scope. */
export function parseVerified(markdown) {
  const out = [];
  let section = null;
  for (const line of String(markdown).split('\n')) {
    const head = /^\*\*([A-C])\. /.exec(line);
    if (head) { section = head[1]; continue; }
    if (/^\*\*Verified but weak fit/.test(line)) { section = 'weak'; continue; }
    if (section === 'weak') {
      const m = /^- (.+?), (\d+) s, /.exec(line);
      const id = m && fileId(line);
      if (id) out.push(entry({ id, title: m[1], studio: null, seconds: Number(m[2]), type: null }));
      continue;
    }
    const m = /^\d+\. \*\*(.+?)\*\* \| (.+?) \| .*? \| (\d+) s \|/.exec(line);
    const id = m && section && fileId(line);
    if (id) out.push(entry({ id, title: m[1], studio: cleanStudio(m[2]), seconds: Number(m[3]), type: section === 'A' ? 'product' : 'brand' }));
  }
  return out;
}

/** The kind of film a brief makes ('product' or 'brand'), from its "Template:" line, else from its request through `routeRequest(request, length)`; null when neither names one. */
export function filmType(briefText, routeRequest = () => null) {
  const template = /^Template: (\S+?)\.?(?:\s|$)/m.exec(briefText)?.[1];
  const byTemplate = template && TEMPLATE_TYPE[path.basename(template)];
  if (byTemplate) return byTemplate;
  if (template) return null;
  const request = /^- request: (.+)$/m.exec(briefText)?.[1];
  const length = Number(/^- length: (\d+(?:\.\d+)?)/m.exec(briefText)?.[1]) || undefined;
  const routed = request ? routeRequest(request, length) : null;
  return routed ? TEMPLATE_TYPE[path.basename(routed)] ?? null : null;
}

/** The references to compare a film with: in-scope entries of its type that have a sheet, the closest length first, then id order. The same film always gets the same ones. */
export function pickRefs(registry, { type, seconds }, count = REFS_PER_FILM) {
  return registry
    .filter((r) => r.inScope && r.type === type && r.sheet)
    .map((r) => ({ r, gap: Math.abs(r.seconds - seconds) }))
    .sort((a, b) => a.gap - b.gap || a.r.id.localeCompare(b.r.id))
    .slice(0, count)
    .map((x) => x.r);
}

/** The registry in `dir`, or null when the folder has none. */
export function readRegistry(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, REGISTRY), 'utf8')); } catch { return null; }
}

export function writeRegistry(dir, registry) {
  fs.writeFileSync(path.join(dir, REGISTRY), `${JSON.stringify(registry, null, 1)}\n`);
}

const ID = /^[A-Za-z0-9_-]{3,}$/;
const mentions = (text, re, group = 1) => [...text.matchAll(re)].map((m) => m[group]).filter((id) => ID.test(id));

/** The reference ids a brief names, most mentioned first: frame paths (`frames/<id>/`), the ref id column of the "move taken" table, `--ref <id>` or `--vs <id>` and the backticked id on a "Reference:" line. */
export function briefRefIds(briefText) {
  const text = String(briefText ?? '');
  const at = text.indexOf('| move taken');
  const rows = at < 0 ? [] : text.slice(at).split('\n').slice(2);
  const moves = [];
  for (const row of rows) {
    if (!row.startsWith('|')) break;
    const id = row.split('|')[2]?.trim();
    if (ID.test(id ?? '')) moves.push(id);
  }
  const referenceLines = text.split('\n').filter((l) => /Reference:/i.test(l)).join('\n');
  const all = [
    ...mentions(text, /\/frames\/([^/\s|`]+)\//g),
    ...moves,
    ...mentions(text, /--(?:ref|vs) ([^\s|`/]+)(?![^\s|`]*\.)/g),
    ...mentions(referenceLines, /`([A-Za-z0-9_-]+)`/g),
    ...mentions(referenceLines, /refs\/([A-Za-z0-9_-]+)\.(?:mp4|webm)/g),
  ];
  const counts = new Map();
  for (const id of all) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** The reference film a brief names that exists under `dir`: { id, file } with the sharpest video, or null. */
export function namedRef({ dir, briefText }) {
  for (const id of briefRefIds(briefText)) {
    const file = refSharpVideo(dir, id);
    if (file) return { id, file };
  }
  return null;
}

/** The references for a film: { refs: [{ id, title, studio, file }], skipped: null, named }, or { refs: [], skipped: <one line why> }. `file` is the absolute path of the sheet. A reference the brief names comes first; `named` is its id. */
export function chooseRefs({ dir, briefText, seconds, routeRequest }) {
  const registry = readRegistry(dir);
  if (!registry) return { refs: [], skipped: `no reference films in ${dir} (bin/vawe refs index)` };
  const named = briefText ? namedRef({ dir, briefText }) : null;
  const own = named && registry.find((r) => r.id === named.id && r.sheet);
  const first = own ? [{ id: own.id, title: own.title, studio: own.studio, file: path.join(dir, own.sheet) }] : [];
  const type = briefText ? filmType(briefText, routeRequest) : null;
  if (!type) {
    if (first.length) return { refs: first, skipped: null, named: own.id };
    return { refs: [], skipped: 'the film type is unknown: add a line `Template: prompts/<type>.md` to brief.md (bin/vawe new --from prompts/<type>.md writes it), or a `- request:` line the router can read' };
  }
  const picked = pickRefs(registry, { type, seconds }).filter((r) => r.id !== own?.id).slice(0, REFS_PER_FILM - first.length);
  if (!picked.length && !first.length) return { refs: [], skipped: `no ${type} reference film has a sheet` };
  const refs = [...first, ...picked.map((r) => ({ id: r.id, title: r.title, studio: r.studio, file: path.join(dir, r.sheet) }))];
  return { refs, skipped: null, ...(own ? { named: own.id } : {}) };
}

export const FRAMES = 'frames';
export const FRAMES_MANIFEST = 'frames.json';

/** The manifest of one film's key frames: { id, frames: [{ n, t, file }] }, `file` absolute. `got` is [{ t, file }] in order. Pure. */
export function frameManifest(id, got) {
  return { id, frames: got.map((k, i) => ({ n: i + 1, t: +k.t.toFixed(1), file: path.resolve(k.file) })) };
}

export const REF_SHORT_SIDE = 1080;

/** The yt-dlp argv: the best video whose short side is at most 1080 (`res` sorts on the short side, so a vertical and a wide video both work); a source with only larger formats gets its smallest one. */
export function ytDlpArgs(url, dir) {
  return ['-f', 'bv*/b', '-S', `res:${REF_SHORT_SIDE}`, '--merge-output-format', 'mp4', '--no-playlist', '-o', path.join(dir, '%(id)s.%(ext)s'),
    '--print', 'after_move:%(filepath)s\t%(id)s\t%(title)s\t%(channel)s', url];
}

/** The ffmpeg scale filter that brings a w x h video to a short side of 1080 (even sides), or null when it is small enough. */
export function downscaleFilter(w, h) {
  if (Math.min(w, h) <= REF_SHORT_SIDE) return null;
  return w < h ? `scale=${REF_SHORT_SIDE}:-2` : `scale=-2:${REF_SHORT_SIDE}`;
}

export const refVideo =(dir, id) => ['mp4', 'webm'].map((e) => path.join(dir, `${id}.${e}`)).find(fs.existsSync);

/** The video to look at for film `id`: the 1080p copy in hd/ when there is one, else the downloaded video; undefined when neither exists. */
export const refSharpVideo = (dir, id) => [path.join(dir, 'hd', `${id}.mp4`)].find(fs.existsSync) ?? refVideo(dir, id);

const readSpec = (dir, id) => {
  const file = path.join(dir, 'spec', id, 'spec.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
};

/** The measured shots of film `id` as [{ start, end }] from spec/<id>/spec.json; empty before `vawe see --spec` ran. */
export const refShots = (dir, id) => (readSpec(dir, id).shots ?? []).map((s) => ({ start: s.t0, end: s.t1 }));

/** The shot changes of film `id` from spec/<id>/spec.json as [{ startT, endT, type, frames }], the shape of harness/media/see/transitions.mjs. */
export const refTransitions = (dir, id) => (readSpec(dir, id).cuts ?? []).map((c) => ({ startT: c.transition.startT, endT: c.t, type: c.transition.type, frames: c.transition.frames }));

/** The ground block (per shot and per cut) of film `id` from spec/<id>/spec.json, or null before `vawe see --spec` ran. */
export const refGround = (dir, id) => readSpec(dir, id).ground ?? null;

/** The manifest of film `id` under `dir`, or null when `vawe refs frames` has not written it. */
export function readFrameManifest(dir, id) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, FRAMES, id, FRAMES_MANIFEST), 'utf8')); } catch { return null; }
}

/** One line per frame: `  n  t s  <absolute path>`. Pure. */
export function frameLines(manifest) {
  return manifest.frames.map((f) => `  ${f.n}  ${f.t.toFixed(1)} s  ${f.file}`);
}

/** One line per film for `vawe refs list`. */
export function listLines(registry) {
  const rows = registry.map((r) => [r.id, r.inScope ? r.type ?? 'no type' : `out (${r.why})`, `${Math.round(r.seconds)} s`, r.studio ?? '-', r.title]);
  const wide = [0, 1, 2, 3].map((c) => Math.max(...rows.map((r) => r[c].length)));
  return rows.map((r) => `${r.slice(0, 4).map((cell, c) => cell.padEnd(wide[c])).join('  ')}  ${r[4]}`);
}

/** True when `dir` holds no registry entry and no video: a new user's empty or missing refs folder. */
export function refsEmpty(dir) {
  if (readRegistry(dir)?.length) return false;
  try { return !fs.readdirSync(dir).some((f) => /\.(mp4|webm)$/.test(f)); } catch { return true; }
}

/** What `vawe refs list` prints for an empty refs folder: what to study instead. Pure. */
export function noRefsLines(dir) {
  return [
    `no reference films in ${dir} yet. Study these instead:`,
    '  films/examples/colour-sting/   a judged-PASS 5 s sting: bin/vawe frame films/examples/colour-sting/page.html --world all --full writes its stills',
    '  prompts/moves/README.md        moves to copy, each with a clip: bin/vawe frame site/public/moves/<move>.mp4 --moment <s> shows how it moves',
    '  bin/vawe refs add <url> [--type product|brand]   adds a film you admire (needs yt-dlp), then bin/vawe refs frames <id>',
    'Then name 4 to 6 still paths and what each gives in brief.md "Taken from".',
  ];
}
