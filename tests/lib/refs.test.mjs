import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { addPlan, positionals, ytDlpArgs, downscaleFilter, parseVerified, filmType, pickRefs, refsDir, listLines, chooseRefs, briefRefIds, namedRef, writeRegistry, frameManifest, frameLines, readFrameManifest, refsEmpty, noRefsLines } from '../../harness/lib/refs.mjs';

test('the frame manifest numbers each frame and holds its absolute path; frameLines prints it', () => {
  const m = frameManifest('a', [{ t: 0.14, file: '/r/frames/a/key-1-0.1s.png' }, { t: 3.62, file: '/r/frames/a/key-2-3.6s.png' }]);
  assert.deepEqual(m, { id: 'a', frames: [{ n: 1, t: 0.1, file: '/r/frames/a/key-1-0.1s.png' }, { n: 2, t: 3.6, file: '/r/frames/a/key-2-3.6s.png' }] });
  assert.deepEqual(frameLines(m), ['  1  0.1 s  /r/frames/a/key-1-0.1s.png', '  2  3.6 s  /r/frames/a/key-2-3.6s.png']);
});

test('readFrameManifest reads frames/<id>/frames.json and is null when it is absent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refs-manifest-'));
  assert.equal(readFrameManifest(dir, 'a'), null);
  fs.mkdirSync(path.join(dir, 'frames', 'a'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'frames', 'a', 'frames.json'), JSON.stringify({ id: 'a', frames: [] }));
  assert.deepEqual(readFrameManifest(dir, 'a'), { id: 'a', frames: [] });
});

const VERIFIED = `
**A. Product and UI films (best fit for HTML/CSS/WebGL)**

1. **Introducing Linear Agent** | Linear (in-house) | 2026 (20260324) | 55 s | product launch | https://www.youtube.com/watch?v=mRql2VJ99gM | 24k views | local: \`/private/tmp/x/mRql2VJ99gM.mp4\` | Recognition: none.
   - A description line.
5. **Arc 1.0 | Everything or nothing** | The Browser Company | 2023 | 34 s | product launch | https://x | local: \`.../n5Vwrj1gEWs.mp4\`
9. **Dia Browser** | The Browser Company | 2025 | 78 s | live action | https://x | local: \`.../YVOw0TAO9ok.mp4\`

**B. Brand, ident and conference openers (type, shape, texture)**

11. **Vercel Ship 2024** | Vercel; identity by basement.studio | 2024 | 36 s | ident | https://x | local: \`.../PHvw0IP7dEU.mp4\`

**Verified but weak fit or out of scope (downloaded, not in the main list)**
- Stripe Sessions 2024, 109 s, https://www.youtube.com/watch?v=KH0_HM6e66w, \`.../KH0_HM6e66w.mp4\`: event recap.
- Node Fest 2018, 118 s, https://x , local \`rs-uCBlLaAg.mp4\`: cinematic CG.

### Inferences
- text
`;

test('parseVerified reads id, title, studio, length, type and scope', () => {
  const films = parseVerified(VERIFIED);
  assert.deepEqual(films.map((f) => f.id), ['mRql2VJ99gM', 'n5Vwrj1gEWs', 'YVOw0TAO9ok', 'PHvw0IP7dEU', 'KH0_HM6e66w', 'rs-uCBlLaAg']);
  assert.deepEqual(films[0], { id: 'mRql2VJ99gM', title: 'Introducing Linear Agent', studio: 'Linear', type: 'product', seconds: 55, inScope: true, why: null });
  assert.equal(films[1].title, 'Arc 1.0 | Everything or nothing');
  assert.equal(films[3].studio, 'Vercel');
  assert.equal(films[3].type, 'brand');
});

test('live action, 3D CG, and the weak-fit list are out of scope with no type', () => {
  const films = Object.fromEntries(parseVerified(VERIFIED).map((f) => [f.id, f]));
  assert.deepEqual([films.YVOw0TAO9ok.inScope, films.YVOw0TAO9ok.type, films.YVOw0TAO9ok.why], [false, null, 'live action']);
  assert.equal(films['KH0_HM6e66w'].inScope, false);
  assert.equal(films['rs-uCBlLaAg'].seconds, 118);
});

test('filmType reads the template line, else routes the request', () => {
  assert.equal(filmType('# x: brief\n\nTemplate: prompts/brand-launch-from-url.md. Shape: a.'), 'product');
  assert.equal(filmType('Template: prompts/beat-sheet.md. Shape: a.'), 'brand');
  assert.equal(filmType('Template: prompts/reference-rebuild.md. Shape: a.'), null);
  const route = (request, length) => (request.includes('launch') && length === 18 ? 'prompts/brand-launch-from-url.md' : null);
  assert.equal(filmType('## Inputs\n\n- request: an 18 s launch film\n- length: 18 s', route), 'product');
  assert.equal(filmType('no template and no request'), null);
});

const registry = [
  { id: 'b', type: 'product', seconds: 30, inScope: true, sheet: 's/b.png' },
  { id: 'a', type: 'product', seconds: 30, inScope: true, sheet: 's/a.png' },
  { id: 'c', type: 'product', seconds: 55, inScope: true, sheet: 's/c.png' },
  { id: 'd', type: 'product', seconds: 18, inScope: false, sheet: 's/d.png' },
  { id: 'e', type: 'brand', seconds: 18, inScope: true, sheet: 's/e.png' },
  { id: 'f', type: 'product', seconds: 18, inScope: true, sheet: null },
];

test('pickRefs takes the two closest lengths of the type, ties by id, and skips out of scope and sheetless films', () => {
  assert.deepEqual(pickRefs(registry, { type: 'product', seconds: 25 }).map((r) => r.id), ['a', 'b']);
  assert.deepEqual(pickRefs(registry, { type: 'product', seconds: 60 }).map((r) => r.id), ['c', 'a']);
  assert.deepEqual(pickRefs(registry, { type: 'brand', seconds: 60 }).map((r) => r.id), ['e']);
  assert.deepEqual(pickRefs(registry, { type: 'product', seconds: 25 }), pickRefs([...registry].reverse(), { type: 'product', seconds: 25 }));
});

test('refsDir prefers VAWE_REFS_DIR', () => {
  assert.equal(refsDir({ VAWE_REFS_DIR: '/r' }, '/h'), '/r');
  assert.equal(refsDir({}, '/h'), '/h/.vawe/refs');
});

test('chooseRefs gives the picked sheets, or one line saying why none', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refs-'));
  const brief = 'Template: prompts/brand-launch-from-url.md. Shape: x.';
  assert.match(chooseRefs({ dir, briefText: brief, seconds: 18 }).skipped, /no reference films/);
  writeRegistry(dir, registry);
  assert.match(chooseRefs({ dir, briefText: null, seconds: 18 }).skipped, /film type is unknown/);
  assert.deepEqual(chooseRefs({ dir, briefText: 'Template: prompts/beat-sheet.md.', seconds: 18 }).refs.map((r) => r.id), ['e']);
  const got = chooseRefs({ dir, briefText: brief, seconds: 25 });
  assert.deepEqual(got.refs.map((r) => r.id), ['a', 'b']);
  assert.equal(got.refs[0].file, path.join(dir, 's/a.png'));
});

test('listLines gives one aligned line per film', () => {
  const lines = listLines([{ id: 'a', type: 'product', seconds: 30.4, inScope: true, studio: 'Linear', title: 'T' }, { id: 'bb', type: null, seconds: 9, inScope: false, why: '3D CG', studio: null, title: 'U' }]);
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^bb {2}out \(3D CG\) {2}9 s +- +U$/);
});

test('the yt-dlp argv ends with the url, for a YouTube and an X url', () => {
  for (const url of ['https://www.youtube.com/watch?v=abc123', 'https://x.com/refauthor/status/2108253918086176899']) {
    const args = ytDlpArgs(url, '/r');
    assert.equal(args.at(-1), url);
    assert.equal(args.filter((a) => a === url).length, 1);
    assert.equal(args[args.indexOf('-o') + 1], '/r/%(id)s.%(ext)s');
  }
});

test('the yt-dlp format sorts on the short side up to 1080, so a vertical video has a format', () => {
  const args = ytDlpArgs('https://x.test/v', '/r');
  assert.equal(args[args.indexOf('-S') + 1], 'res:1080');
  assert.equal(args[args.indexOf('-f') + 1], 'bv*/b');
  assert.ok(!args.join(' ').includes('height<='));
});

test('downscaleFilter keeps the short side at 1080 for both orientations', () => {
  assert.equal(downscaleFilter(1920, 1080), null);
  assert.equal(downscaleFilter(720, 1280), null);
  assert.equal(downscaleFilter(3840, 2160), 'scale=-2:1080');
  assert.equal(downscaleFilter(2160, 3840), 'scale=1080:-2');
});

const NAMING_BRIEF = `- Reference: private style reference \`ref-a\` (\`~/.vawe/refs/ref-a.mp4\`)

## Taken from

| frame | take |
|---|---|
| /h/.vawe/refs/frames/ref-a/key-1.png | glow |
| /h/.vawe/refs/frames/other/key-2.png | grid |

| move taken | ref id | cut s |
|---|---|---|
| flash-cut | ref-a | 0.17 |
| [move name] | [ref id] | [s] |
`;

test('briefRefIds ranks the ids a brief names: frame paths, the move table, the Reference line, --ref', () => {
  assert.deepEqual(briefRefIds(NAMING_BRIEF), ['ref-a', 'other']);
  assert.deepEqual(briefRefIds('run bin/vawe frame films/x/page.html --vs abc123 --at 2'), ['abc123']);
  assert.deepEqual(briefRefIds('--ref refs/x.mp4 and Reference: quality/refs/<ref>/source.mp4'), []);
  assert.deepEqual(briefRefIds(''), []);
});

test('namedRef finds the first named id that has a video; chooseRefs puts it first and needs no film type', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refs-named-'));
  fs.writeFileSync(path.join(dir, 'ref-a.mp4'), '');
  assert.deepEqual(namedRef({ dir, briefText: NAMING_BRIEF }), { id: 'ref-a', file: path.join(dir, 'ref-a.mp4') });
  assert.equal(namedRef({ dir, briefText: 'nothing' }), null);
  writeRegistry(dir, [...registry, { id: 'ref-a', title: 'M', studio: null, type: 'brand', seconds: 5, inScope: true, why: null, sheet: 's/ref-a.png' }]);
  const got = chooseRefs({ dir, briefText: NAMING_BRIEF, seconds: 5 });
  assert.equal(got.skipped, null);
  assert.equal(got.named, 'ref-a');
  assert.deepEqual(got.refs.map((r) => r.id), ['ref-a']);
});

test('an empty or missing refs folder is empty; a video or a registry entry is not', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refs-empty-'));
  assert.equal(refsEmpty(path.join(dir, 'missing')), true);
  assert.equal(refsEmpty(dir), true);
  writeRegistry(dir, []);
  assert.equal(refsEmpty(dir), true);
  fs.writeFileSync(path.join(dir, 'a.mp4'), '');
  assert.equal(refsEmpty(dir), false);
});

test('the empty refs folder names what to study instead, and every path it names exists', () => {
  const text = noRefsLines('/r').join('\n');
  for (const p of ['films/examples/colour-sting/page.html', 'prompts/moves/README.md']) {
    assert.ok(text.includes(p), p);
    assert.ok(fs.existsSync(path.resolve(import.meta.dirname, '../..', p)), p);
  }
  assert.match(text, /bin\/vawe refs add <url>/);
});

test("addPlan skips the measure step only for --no-measure", () => {
  assert.deepEqual(addPlan({ noMeasure: false }), ["fetch", "measure", "record"]);
  assert.deepEqual(addPlan({ noMeasure: true }), ["fetch", "record"]);
});

test("positionals keeps the source after a bool flag and drops the value of a valued flag", () => {
  assert.deepEqual(positionals(["add", "--no-measure", "https://x/a.mp4"]), ["add", "https://x/a.mp4"]);
  assert.deepEqual(positionals(["add", "https://x/a.mp4", "--no-measure"]), ["add", "https://x/a.mp4"]);
  assert.deepEqual(positionals(["add", "--type", "brand", "a.mp4", "--title", "T"]), ["add", "a.mp4"]);
});

test('listLines lists a film added with --no-measure, which has no type', () => {
  const [line] = listLines([{ id: 'x1', type: null, seconds: 6, inScope: true, studio: null, title: 'X' }]);
  assert.match(line, /^x1 {2}no type {2}6 s/);
});

test('refs add without --type adds the film with no type and says how to set it; a wrong type is still refused', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-refs-add-'));
  const video = path.join(home, 't.mp4');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=10:duration=1', '-pix_fmt', 'yuv420p', video]);
  const add = (...args) => spawnSync(process.execPath, [path.join(import.meta.dirname, '../../harness/dev/refs.mjs'), 'add', video, ...args], { encoding: 'utf8', env: { ...process.env, VAWE_REFS_DIR: path.join(home, 'refs') } });
  const bare = add();
  assert.equal(bare.status, 0, bare.stderr);
  assert.match(bare.stdout, /added t \(no type\)/);
  assert.match(bare.stdout, /type not set: .*vawe refs add t --type product\|brand to set it without downloading again/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'refs', 'refs.json'), 'utf8'))[0].type, null);
  const wrong = add('--type', 'movie');
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /--type is product or brand, not "movie"; for example: vawe refs add .* --type product/);
});

test('refs add <id> --type sets the type of a film already in the registry without downloading; --type as the last argument is a usage error', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-refs-type-'));
  const video = path.join(home, 't.mp4');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=10:duration=1', '-pix_fmt', 'yuv420p', video]);
  const refs = (...args) => spawnSync(process.execPath, [path.join(import.meta.dirname, '../../harness/dev/refs.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, VAWE_REFS_DIR: path.join(home, 'refs') } });
  assert.equal(refs('add', video).status, 0);
  const set = refs('add', 't', '--type', 'brand');
  assert.equal(set.status, 0, set.stderr);
  assert.match(set.stdout, /t is now brand; no download/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'refs', 'refs.json'), 'utf8'))[0].type, 'brand');
  const missing = refs('add', 't');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /t is in the registry: pass --type product\|brand/);
  const last = refs('add', video, '--type');
  assert.equal(last.status, 1);
  assert.match(last.stderr, /--type needs a value: product or brand/);
});
