import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('../..', import.meta.url).pathname;
const run = (code) => spawnSync(process.execPath, ['--input-type=module', '-e', code, '--', '--json'], { cwd: ROOT, encoding: 'utf8' });

test('a script that only imports findings.mjs keeps its own --json output on stdout and prints no stray []', () => {
  const r = run("import './harness/lib/findings.mjs'; console.log(JSON.stringify({ worlds: 2 }));");
  assert.deepEqual(JSON.parse(r.stdout), { worlds: 2 });
  assert.equal(r.stderr, '');
});

test('a gate that calls gateFindings still gets its prose on stderr and its records on stdout under --json', () => {
  const r = run("import { gateFindings } from './harness/lib/findings.mjs'; const f = gateFindings(); f.warn('x', 'a thing'); console.log('prose'); f.emit();");
  assert.equal(JSON.parse(r.stdout)[0].code, 'x');
  assert.match(r.stderr, /prose/);
});
