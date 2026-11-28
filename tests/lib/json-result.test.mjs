// The one line `--json` prints on dev, ship and wait.
//   node --test tests/lib/json-result.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonResultOf } from '../../harness/lib/verb-log.mjs';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { JSON_RESULT_VERBS } from '../../harness/cli/helpers.mjs';

const DRAFT = 'plan line\n✓ out/a-draft.mp4: 30 frame(s) at 30fps, 960x540\nadvice: first\nadvice: first\nwarning: second\n\nnext: bin/vawe critique films/a/page.html --fresh\n';

test('a good draft: ok, the absolute out path, frames, the unique warnings and the next line', () => {
  const r = jsonResultOf({ verb: 'dev', code: 0, text: DRAFT, work: '/w', page: 'films/a/page.html', seconds: 4.04 });
  assert.deepEqual(r, { ok: true, verb: 'dev', page: 'films/a/page.html', out: '/w/out/a-draft.mp4', exitCode: 0, reason: null, durationSec: 4, frames: 30, warnings: ['first', 'second'], next: 'bin/vawe critique films/a/page.html --fresh' });
});

test('a failed call keeps its reason and leaves out what it did not print', () => {
  const r = jsonResultOf({ verb: 'ship', code: 6, reason: 'exit 6: refused', text: '', work: '/w', page: 'p.html', seconds: 0 });
  assert.deepEqual(r, { ok: false, verb: 'ship', page: 'p.html', exitCode: 6, reason: 'exit 6: refused', durationSec: 0, warnings: [] });
});

test('an --out given on the command wins over the printed path', () => {
  assert.equal(jsonResultOf({ verb: 'dev', code: 0, text: DRAFT, work: '/w', out: '/tmp/x.mp4', seconds: 1 }).out, '/tmp/x.mp4');
});

test('a wait that ends on STILL RUNNING says so', () => {
  const r = jsonResultOf({ verb: 'wait', code: 0, text: 'vawe wait: STILL RUNNING after 100s', work: '/w', seconds: 100 });
  assert.equal(r.running, true);
  assert.equal(jsonResultOf({ verb: 'wait', code: 0, text: 'vawe: dev ok in 5s', work: '/w', seconds: 1 }).running, undefined);
});

test('dev, ship and wait declare --json', () => {
  for (const name of JSON_RESULT_VERBS) assert.ok(VERBS.find((v) => v.name === name).flags.some((f) => f.name === 'json'), `${name} has no --json`);
});
