// node --test tests/guards/taste-coverage.test.mjs
// Every active taste rule reaches the agent through the tools: on a stage card, and, when it governs the page, through a write topic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tasteFor, TASTE_TOPICS } from '../../harness/guards/index.mjs';

const RULES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../taste/rules');
// One stage per taste step: explore, frames, storyboard, motion, check.
const STAGES = ['brief', 'states', 'board', 'draft', 'critique'];
const PAGE_STEPS = new Set(['frames', 'storyboard', 'motion']);

const rules = fs.readdirSync(RULES).filter((f) => f.endsWith('.md')).map((f) => {
  const head = fs.readFileSync(path.join(RULES, f), 'utf8').split(/^---$/m)[1] ?? '';
  const field = (k) => head.match(new RegExp(`^${k}:\\s*(.*)$`, 'm'))?.[1]?.trim() ?? '';
  return { id: field('id'), status: field('status') || 'active', prints: [...head.matchAll(/^(?:print|more)-([a-z]+):/gm)].map((m) => m[1]) };
}).filter((r) => r.status === 'active');

const named = (lines) => new Set(lines.map((l) => /\(rule ([a-z0-9-]+)\)$/.exec(l)?.[1]).filter(Boolean));

test('every active rule reaches the agent: on a stage card, or through a topic', () => {
  const shown = named([...STAGES.flatMap((s) => tasteFor(s)), ...STAGES.flatMap((s) => TASTE_TOPICS.flatMap((t) => tasteFor(s, t)))]);
  assert.deepEqual(rules.filter((r) => !shown.has(r.id)).map((r) => r.id), []);
});

test('every rule that governs the page reaches a write through at least one topic', () => {
  const pushed = named(STAGES.flatMap((s) => TASTE_TOPICS.flatMap((t) => tasteFor(s, t))));
  const page = rules.filter((r) => r.prints.some((s) => PAGE_STEPS.has(s)));
  assert.deepEqual(page.filter((r) => !pushed.has(r.id)).map((r) => r.id), []);
});
