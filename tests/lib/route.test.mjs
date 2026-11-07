import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickTemplate, readRouting, pickRecipe, readRecipes } from '../../harness/cli/route.mjs';
import { starterPage, starterFace, parseQuestions, templateLength } from '../../harness/cli/new.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const table = readRouting(root);

test('a sting or a short film never takes the brand launch template', () => {
  assert.equal(pickTemplate({ request: 'a 5 s sting for acme.com' }, table).template, 'prompts/beat-sheet.md');
  assert.equal(pickTemplate({ request: 'launch video for https://acme.com', length: 6 }, table).template, 'prompts/beat-sheet.md');
  assert.equal(pickTemplate({ name: 'acme-bumper' }, table).template, 'prompts/beat-sheet.md');
});

test('request words and length pick the other rows from ROUTING.md', () => {
  assert.equal(pickTemplate({ request: 'launch video for https://acme.com' }, table).template, 'prompts/brand-launch-from-url.md');
  assert.equal(pickTemplate({ request: 'explain how tides work' }, table).template, 'prompts/story-explainer.md');
  assert.equal(pickTemplate({ length: 90 }, table).template, 'prompts/directors-brief-long-form.md');
});

test('a 20 to 30 s request names its RECIPES.md chain; other lengths name none', () => {
  const recipes = readRecipes(root);
  const chain = (request, length = 22) => pickRecipe({ request, length }, recipes)?.heading.split(',')[0] ?? null;
  assert.equal(chain('an AI demo of our ledger assistant'), '10. AI product demo');
  assert.equal(chain('a feature tour of the editor'), '11. Feature tour');
  assert.equal(chain('a proof film with customer results'), '12. Proof film');
  assert.equal(chain('a kinetic type manifesto'), '13. Kinetic type manifesto');
  assert.equal(chain('a brand reveal for onsen'), '14. Brand reveal');
  assert.equal(chain('launch video for https://acme.com'), '9. Problem to fix launch');
  assert.equal(chain('an AI demo', 8), null);
  assert.equal(chain('an AI demo', 45), null);
  assert.equal(chain('a nice film'), null);
});

test('a product demo, feature tour or proof film takes the brand launch template', () => {
  for (const request of ['an AI demo of our ledger assistant', 'a feature tour of the editor', 'a proof film for acme']) {
    assert.equal(pickTemplate({ request, length: 22 }, table).type, 'brand launch', request);
  }
});

test('an invented product has no URL to capture: it never takes the brand launch template and still gets the launch chain', () => {
  const request = 'a launch film for an invented invoice tool';
  const r = pickTemplate({ request, length: 22 }, table);
  assert.equal(r.template, 'prompts/beat-sheet.md');
  assert.match(r.why, /invented/);
  assert.equal(pickRecipe({ request, length: 22 }, readRecipes(root)).heading.split(',')[0], '9. Problem to fix launch');
  assert.equal(pickTemplate({ request: 'a launch film for an invented tool, like https://acme.com', length: 22 }, table).template, 'prompts/brand-launch-from-url.md');
});

test('a URL in the request is not the product site: a launch word or url answer routes to the URL template', () => {
  const request = 'Make a video about design systems, using the components from https://www.fancycomponents.dev/';
  assert.notEqual(pickTemplate({ request, length: 22 }, table).type, 'brand launch');
  assert.equal(pickTemplate({ request: 'a launch film for https://example.com', length: 22 }, table).template, 'prompts/brand-launch-from-url.md');
  assert.equal(pickTemplate({ request: 'url: https://example.com', length: 22 }, table).type, 'brand launch');
});

test('an unknown request takes the motion-graphic row and says so', () => {
  const r = pickTemplate({ name: 'zz-demo' }, table);
  assert.equal(r.template, 'prompts/beat-sheet.md');
  assert.equal(r.known, false);
});

test('the starter uses exact curves, a bundled face and beat properties', () => {
  const page = starterPage({ face: starterFace('zz-demo') });
  assert.doesNotMatch(page, /cubic-bezier|system-ui/);
  assert.match(page, /EASE\.glide/);
  assert.match(page, /@font-face \{ font-family: "[^"]+"; src: url\("assets\/[A-Za-z]+\.woff2"\)/);
  assert.match(page, /--beat-1: 0s; --beat-2:/);
});

test('the starter has no house default: grey placeholders, no accent, no band or ease named, an empty signature', () => {
  const page = starterPage({ face: starterFace('zz-demo') });
  assert.doesNotMatch(page, /#f4f1ea|#2b5cff|Bricolage|--accent|<em>|band:/i);
  assert.match(page, /--ground: #8c8c8c/);
  assert.match(page, /<meta name="signature" content="band=; ease=; stagger=; seam=; palette=; thread=">/);
});

test('the starter ground is three drifting blobs per world, derived from --ground and --ink, with a spring on arrivals', () => {
  const page = starterPage({ length: 12, face: starterFace('zz-demo') });
  assert.equal([...page.matchAll(/<div class="ground" aria-hidden="true"><i><\/i><i><\/i><i><\/i><\/div>/g)].length, 6);
  assert.match(page, /radial-gradient\(closest-side, var\(--glow-1\)/);
  assert.doesNotMatch(page, /--glow-\d: #/);
  assert.match(page, /ease: 'pop'/);
  assert.match(page, /blur: 10/);
  assert.equal([...page.matchAll(/<ul class="facts">/g)].length, 4);
});

test('the template and beat-sheet default lengths lie inside the ROUTING.md typical ranges', () => {
  const line = fs.readFileSync(path.join(root, 'guides/ROUTING.md'), 'utf8').match(/Typical lengths: ([^\n]+)/)[1];
  const seconds = (phrase) => {
    const found = [...phrase.matchAll(/(\d+)(?:\s*(s|min))?/g)];
    const unit = found.at(-1)[2];
    return found.map((m) => Number(m[1]) * ((m[2] || unit) === 'min' ? 60 : 1));
  };
  const words = { showreel: 'showreel', 'brand launch': 'brand launch', 'UI morph': 'UI morph', 'story or explainer': 'story', 'app or game capture': 'lab', 'long form': 'long form' };
  for (const [type, word] of Object.entries(words)) {
    const nums = seconds(line.match(new RegExp(`${word} ([^,]+)`))[1]);
    const length = templateLength(parseQuestions(fs.readFileSync(path.join(root, table[type]), 'utf8')));
    assert.ok(length >= nums[0] && length <= nums.at(-1), `${type}: ${table[type]} defaults to ${length} s, outside ${nums[0]} to ${nums.at(-1)} s`);
  }
  const sting = pickTemplate({ request: 'a logo reveal' }, table).length;
  assert.ok(sting > 0 && sting < 10, `a sting defaults to ${sting} s`);
});

test('a sting takes 5 s; a type with its own template Length question takes none from the route', () => {
  assert.equal(pickTemplate({ request: 'a logo reveal for the vawe wordmark' }, table).length, 5);
  assert.equal(pickTemplate({ request: 'launch video for https://acme.com' }, table).length, undefined);
  assert.equal(pickTemplate({ request: 'a 6 s logo reveal', length: 6 }, table).length, 5);
});

test('an unmatched request is not a sting: it takes 15 s', () => {
  const hit = pickTemplate({ request: 'a video about our team' }, table);
  assert.equal(hit.known, false);
  assert.equal(hit.length, 15);
});
