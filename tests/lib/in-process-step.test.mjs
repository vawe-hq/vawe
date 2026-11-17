import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { IN_PROCESS } from '../../harness/cli/verbs.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PAGE = 'films/examples/colour-sting/page.html';

function copyRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-inproc-'));
  for (const dir of ['bin', 'harness', 'core', 'taste', 'films/examples/colour-sting']) {
    fs.mkdirSync(path.dirname(path.join(root, dir)), { recursive: true });
    fs.cpSync(path.join(REPO, dir), path.join(root, dir), { recursive: true });
  }
  fs.cpSync(path.join(REPO, 'package.json'), path.join(root, 'package.json'));
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(root, 'node_modules'));
  return root;
}

test('every in-process step script exports run', async () => {
  for (const script of IN_PROCESS) {
    const mod = await import(path.join(REPO, script));
    assert.equal(typeof mod.run, 'function', script);
  }
});

test('an in-process step prints and exits the same as the script run alone', () => {
  const root = copyRoot();
  try {
    const env = { ...process.env, VAWE_UNATTENDED: '', VAWE_WORK: '', VAWE_AGENT: 'inproc-test' };
    const alone = spawnSync(process.execPath, ['harness/live/ship-approval.mjs', PAGE], { cwd: root, encoding: 'utf8', env });
    const viaVawe = spawnSync(process.execPath, ['bin/vawe', 'ship', PAGE], { cwd: root, encoding: 'utf8', env });
    assert.equal(alone.status, 6);
    assert.equal(viaVawe.status, 6);
    assert.ok(viaVawe.stderr.startsWith(alone.stderr), `${viaVawe.stderr}\n--\n${alone.stderr}`);
    assert.match(viaVawe.stdout, /^vawe: ship FAILED \(exit 6: vawe: ship refused: .*\) in [\d.]+s$/m);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an in-process step run from another directory still reads the workspace', () => {
  const root = copyRoot();
  try {
    const env = { ...process.env, VAWE_UNATTENDED: '', VAWE_WORK: root, VAWE_AGENT: 'inproc-test' };
    const r = spawnSync(process.execPath, [path.join(root, 'bin/vawe'), 'ship', PAGE], { cwd: os.tmpdir(), encoding: 'utf8', env });
    assert.match(r.stderr, /ship refused: waiting for the person's OK on the plan of colour-sting/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
