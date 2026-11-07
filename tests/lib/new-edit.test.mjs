// `vawe new --footage`: the edit film's plan, starter page and Cut list; the brief table readers ignore the Cut list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newFilm, editPlan, gatherFootage } from '../../harness/cli/new.mjs';
import { pickTemplate, readRouting } from '../../harness/cli/route.mjs';
import { parseBriefTables } from '../../harness/lib/brief-tables.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CLIPS = [
  { slug: 'a', seconds: 6, hasAudio: false },
  { slug: 'b', seconds: 1.2, hasAudio: true },
  { slug: 'c', seconds: 6, hasAudio: false },
];

function newIn(options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-edit-'));
  for (const dir of ['prompts', 'guides', 'assets/fonts']) {
    fs.mkdirSync(path.dirname(path.join(root, dir)), { recursive: true });
    fs.symlinkSync(path.join(ROOT, dir), path.join(root, dir));
  }
  try {
    const made = newFilm('cut', { root, defaults: true, ...options });
    return { made, page: fs.readFileSync(path.join(root, made.page), 'utf8'), brief: fs.readFileSync(path.join(root, 'films/cut/brief.md'), 'utf8') };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('editPlan: a title card, then each clip as long as the clip or its share of the length', () => {
  const plan = editPlan(CLIPS, 10);
  assert.deepEqual(plan.beats.map((b) => [b.id, b.start, b.end]), [['s1', 0, 1.5], ['s2', 1.5, 4.33], ['s3', 4.33, 5.53], ['s4', 5.53, 8.36]]);
  assert.equal(plan.length, 10);
  assert.equal(editPlan(CLIPS).length, 8.7);
});

test('the edit page holds one video per clip inside its world, a crossfade on the second clip, muted only without sound', () => {
  const { page } = newIn({ footage: CLIPS, length: 10 });
  assert.deepEqual([...page.matchAll(/data-world="(s\d)"/g)].map((m) => m[1]), ['s1', 's2', 's3', 's4']);
  assert.match(page, /<video src="footage\/a\.mp4" data-at="1\.5" data-trim="0" data-trim-end="2\.83" data-rate="1" muted>/);
  assert.match(page, /<video src="footage\/b\.mp4" data-at="4\.33" data-trim="0" data-trim-end="1\.2" data-rate="1">/);
  assert.match(page, /data-world="s3" data-cut="fade"/);
  assert.match(page, /data-world="s2" data-cut="hard"/);
  assert.match(page, /<meta name="duration" content="10">/);
  assert.doesNotMatch(page, /autoplay|\.play\(|currentTime/);
});

test('the brief has a Cut list that the Shots, Words and Objects readers skip', () => {
  const { brief, made } = newIn({ footage: CLIPS, length: 10 });
  assert.match(brief, /^## Cut list$/m);
  assert.match(brief, /\| world \| clip \| in \| out \| rate \| why \|/);
  assert.match(brief, /^message: /m);
  assert.equal(made.route.type, 'edit');
  const tables = parseBriefTables(brief);
  assert.deepEqual(tables.shots.map((r) => r.id), ['s1', 's2', 's3', 's4']);
  assert.equal(tables.objects.length, 1);
});

test('without --footage a film has no Cut list and the edit row exists in ROUTING.md', () => {
  const { brief } = newIn({ request: 'a launch for acme.com, 20 s' });
  assert.doesNotMatch(brief, /## Cut list/);
  assert.equal(pickTemplate({ request: 'edit my clips into a reel', length: 8 }, readRouting(ROOT)).template, 'prompts/edit-from-clips.md');
});

test('gatherFootage refuses a missing clip with one line', async () => {
  await assert.rejects(gatherFootage(ROOT, 'no-such-film-xyz', ['/no/such/clip.mp4']), /no such clip or folder/);
});
