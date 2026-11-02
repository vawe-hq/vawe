import test from 'node:test';
import assert from 'node:assert/strict';
import { isClipDemo } from '../../harness/lib/clip-demo.mjs';
import { nextStep } from '../../harness/live/stage-say.mjs';
import { unwaived } from '../../harness/lib/motion-lint.mjs';

test('isClipDemo: only pages under prompts/moves/demo/', () => {
  assert.equal(isClipDemo('prompts/moves/demo/mask-rise.html'), true);
  assert.equal(isClipDemo('films/examples/colour-sting/page.html'), false);
});

test('nextStep: a clip demo points at the clip workflow, not at a brief', () => {
  const s = nextStep('prompts/moves/demo/mask-rise.html');
  assert.equal(s.stage, 'clip');
  assert.equal(s.next, 'bin/vawe-dev moves --only mask-rise');
});

test('unwaived: a clip drops the film-shape rules and keeps the others', () => {
  const found = [{ rule: 'living-ground', code: 'living-ground', at: 0 }, { rule: 'stagger', code: 'stagger-gap', at: 0 }];
  assert.deepEqual(unwaived(found, { allow: [], _clip: true }).map((f) => f.rule), ['stagger']);
  assert.equal(unwaived(found, { allow: [] }).length, 2);
});
