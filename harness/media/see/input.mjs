import fs from 'node:fs';
import { isUrl } from '../../lib/url.mjs';
import { refIdOfFile, refsDir, refSharpVideo, refShots, refTransitions } from '../../lib/refs.mjs';
import { lastDraft } from '../../lib/runlog.mjs';
import { die } from './core.mjs';
import { filmNameOf, shotCuts, singleShotCut, withTransitions, worldCuts } from './strip-math.mjs';
import { videoTransitions } from './transitions.mjs';

/** { video, name, cuts, holdCuts } of an input: a page (its last draft), an mp4, or a reference id. `cuts()` returns the world changes or shots; it dies naming the command to run when they are not measured. `holdCuts()` returns them with the start and end of the shot change each sits in (withTransitions). */
export async function resolveInput(input) {
  const found = await locate(input);
  const transitions = () => (found.refId ? refTransitions(refsDir(), found.refId) : videoTransitions(found.video));
  const changes = () => {
    try { return transitions(); } catch (e) { console.log(`note: no shot changes read (${e.message}); each hold is measured to the cut second`); return []; }
  };
  return { ...found, holdCuts: async () => withTransitions(await found.cuts(), changes()) };
}

/** The file a film input names: a page, a URL or an existing file as given, else the mp4 of a reference id (null when there is none). The one place an id is read. */
export function filmFile(input) {
  if (input.endsWith('.html') || isUrl(input) || fs.existsSync(input)) return input;
  return refSharpVideo(refsDir(), input);
}

async function locate(input) {
  if (input.endsWith('.html')) {
    if (!fs.existsSync(input)) die(`no such page: ${input}`);
    const { defaultOut } = await import('../render-page.mjs');
    const standard = defaultOut(input, { aspect: '16:9', suffixAspect: false, final: false });
    const video = lastDraft(input) ?? standard;
    const name = filmNameOf(standard);
    return { video, name, page: input, cuts: () => filmCuts(name, input), draftMissing: !fs.existsSync(video), draftOld: fs.existsSync(video) && fs.statSync(video).mtimeMs < fs.statSync(input).mtimeMs };
  }
  if (fs.existsSync(input)) {
    const name = filmNameOf(input);
    const refId = refIdOfFile(refsDir(), input);
    return { video: input, name, ...(refId ? { refId, cuts: () => refCuts(refId) } : { cuts: () => filmCuts(name, null) }) };
  }
  const video = filmFile(input);
  if (!video) die(`${input} is not a file, a page or a reference film id (bin/vawe refs list)`);
  return { video, name: input, refId: input, cuts: () => refCuts(input) };
}

async function filmCuts(name, page) {
  const { lastWorlds } = await import('../acceptance-run.mjs');
  const worlds = lastWorlds(name) ?? (page ? await pageSpans(page) : null);
  if (!worlds) die(`no measured data-world spans for ${name}: run bin/vawe dev ${page ?? `films/${name}/page.html`} first (a full draft, no --from or --to), then repeat; or strip one moment now with --at <second>`);
  const cuts = worldCuts(worlds);
  const unseen = worlds.filter((w) => w.start == null).map((w) => w.id);
  if (unseen.length) console.log(`note: the last draft never showed ${unseen.join(', ')} (a --from/--to draft covers part of the film): run bin/vawe dev ${page ?? `films/${name}/page.html`} with no range for every cut`);
  if (!cuts.length) die(`${name}: no world change measured`);
  return cuts;
}

// A canvas film skips the world measure at dev (the DOM worlds are not the picture), but its data-world elements still declare the spans.
async function pageSpans(page) {
  try {
    const { readTimeline } = await import('../timeline.mjs');
    const spans = (await readTimeline(page)).spans.filter((s) => s.start != null);
    return spans.length ? spans : null;
  } catch { return null; }
}

function refCuts(id) {
  const shots = refShots(refsDir(), id);
  const cuts = shotCuts(shots);
  if (cuts.length) return cuts;
  const middle = singleShotCut(shots);
  if (!middle.length) die(`no measured shots for ${id}: run bin/vawe see <mp4> --spec on the film, or pass --at <s>`);
  console.log(`note: ${id} is one shot, so it has no cut; the window is the middle of the film, ${middle[0].at}s`);
  return middle;
}
