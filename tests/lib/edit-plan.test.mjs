import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { planWindow } from '../../harness/lib/dev-window.mjs';
import { nextStep, SAY } from '../../harness/live/stage-say.mjs';
import { planStatusLines } from '../../harness/live/plan-status.mjs';
import { newFilmLines } from '../../harness/cli/new.mjs';
import { planFindings } from '../../harness/lib/plan-findings.mjs';

const CUT = (why) => `## Cut list\n\n| world | clip | in | out | rate | why |\n|---|---|---|---|---|---|\n| s2 | a | 0 | 3 | 1 | ${why} |\n| s3 | b | 0 | 2 | 1 | ${why} |\n\nmessage: m\n\n`;
const IDEAS_EMPTY = '## Ideas\n\n| at | meaning | i1 | i2 | i3 | i4 | chosen | why |\n|---|---|---|---|---|---|---|---|\n| [s1] | [m] | [a] | [b] | [c] | [d] | [n] | [because] |\n\n';
const BOARD_EMPTY = '## Board\n\n| beat | in s |\n|---|---|\n| [s1] | [0] |\n\n';
const TAKEN_EMPTY = '## Taken from\n\n| frame | gives |\n|---|---|\n| [path.png] | [x] |\n\n';
const edit = (why) => `# f: brief\n\nTemplate: prompts/edit-from-clips.md. Shape.\n\n${TAKEN_EMPTY}${CUT(why)}${IDEAS_EMPTY}${BOARD_EMPTY}`;
const design = `# f: brief\n\nTemplate: prompts/story-explainer.md. Shape.\n\n${TAKEN_EMPTY}${IDEAS_EMPTY}${BOARD_EMPTY}`;

function film(brief) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-edit-'));
  fs.mkdirSync(path.join(root, 'films', 'f'), { recursive: true });
  fs.mkdirSync(path.join(root, 'out'));
  const page = path.join(root, 'films', 'f', 'page.html');
  fs.writeFileSync(page, '<html><head><meta name="duration" content="12"><meta name="spectacle" content="8"></head><body data-world="s1"></body></html>');
  fs.writeFileSync(path.join(root, 'films', 'f', 'brief.md'), brief);
  return { root, page };
}

const base = { name: 'f', rel: 'films/f/page.html', design: null, early: true, frames: 'none', storyboardRan: false, next: 'n' };
const TELLS = ['slideshow: score 2/10', 'slideshow: swap-no-carry at 1 s: x. Fix: y', 'spectacle at 7.5 s is weaker than 1.9 s: z', 'rule safe-margin @3s text-margin: t'];

test('an edit film with a filled Cut list renders whole: the window needs a gap in the plan', () => {
  const filled = film(edit('the opening'));
  assert.equal(planWindow(filled.page, { root: filled.root }), null);
  const designed = film(design);
  assert.ok(planWindow(designed.page, { root: designed.root }));
});

test('an edit film with an empty Cut list gets the window, and the line names the Cut list', () => {
  const f = film(edit('[why this clip, why here]'));
  assert.match(planWindow(f.page, { root: f.root }).line, /Cut list is empty/);
});

test('the plan status of an edit film lists no design-film item', () => {
  const lines = planStatusLines({ ...base, brief: edit('the opening'), page: TELLS }).join('\n');
  assert.doesNotMatch(lines, /Ideas|Board|storyboard|reference study|DESIGN\.md|no frames|slideshow|spectacle|swap-no-carry/);
  assert.match(lines, /safe-margin/);
});

test('the plan status of an edit film names the empty Cut list, and of a design film still the design items', () => {
  const open = planStatusLines({ ...base, brief: edit('[why this clip, why here]') }).join('\n');
  assert.match(open, /sections empty: Cut list/);
  assert.doesNotMatch(open, /Ideas|Board|storyboard/);
  const designed = planStatusLines({ ...base, brief: design, page: TELLS }).join('\n');
  assert.match(designed, /Ideas, Board/);
  assert.match(designed, /no storyboard run/);
  assert.match(designed, /reference study names 0 of 4/);
  assert.match(designed, /swap-no-carry/);
});

test('an edit film has no ideas finding, a design film does', () => {
  const find = (brief) => planFindings({ brief, duration: 12, probe: null, worlds: ['s1', 's2'] }).map((f) => f.code);
  assert.ok(!find(edit('x')).includes('ideas-missing'));
  assert.ok(find(design.replace(IDEAS_EMPTY, '## Ideas\n\n| at | meaning | i1 | i2 | i3 | i4 | chosen | why |\n|---|---|---|---|---|---|---|---|\n')).includes('ideas-missing'));
});

test('nextStep sends an edit film to the footage log and the Cut list, then to dev', () => {
  const f = film(edit('[why this clip, why here]'));
  const step = nextStep(f.page, f.root);
  assert.equal(step.stage, 'cut');
  assert.match(step.next, /footage\.md/);
  assert.match(step.next, /Cut list/);
  assert.doesNotMatch(step.next, /refs list|Taken from/);
  const done = film(edit('the opening'));
  const after = nextStep(done.page, done.root);
  assert.equal(after.stage, 'draft');
  assert.equal(after.next, SAY.dev('f', 'films/f/page.html'));
});

test('nextStep still starts a design film at the reference study', () => {
  const f = film(design);
  assert.equal(nextStep(f.page, f.root).stage, 'study');
});

test('the next line of new for an edit film is the Cut list, then dev; for another film the study', () => {
  const made = { page: 'films/zz/page.html', route: { template: 'prompts/edit-from-clips.md', type: 'edit', why: 'w' }, title: 't' };
  const next = newFilmLines('zz', made).find((l) => l.startsWith('next:'));
  assert.match(next, /footage\.md.*Cut list.*bin\/vawe dev films\/zz\/page\.html/);
  assert.doesNotMatch(next, /refs list|Taken from/);
  const other = newFilmLines('zz', { ...made, route: { template: 'prompts/story-explainer.md', type: 'product', why: 'w' } }).find((l) => l.startsWith('next:'));
  assert.match(other, /refs list/);
});
