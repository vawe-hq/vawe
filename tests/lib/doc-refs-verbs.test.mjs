import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');

test('doc-refs flags an old picture verb and a flag the verb does not have, and passes a valid frame command', () => {
  const name = `zz-doc-refs-${process.pid}.md`;
  const file = path.join(ROOT, name);
  const gate = (text) => {
    fs.writeFileSync(file, text);
    return spawnSync(process.execPath, ['quality/gates/doc-refs.mjs', name], { cwd: ROOT, encoding: 'utf8' }).stdout;
  };
  try {
    assert.match(gate('Run `bin/vawe sheet p`.\n'), /`vawe sheet`: no such verb or gate/);
    assert.match(gate('Run `bin/vawe frame p --cuts --nope`.\n'), /`vawe frame --nope`/);
    assert.doesNotMatch(gate('Run `bin/vawe frame p --moment 2 --onion` and then `bin/vawe wait p`.\n'), /vawe (frame|wait)/);
    assert.match(gate('Run `bin/vawe land`.\n'), /`vawe land`: no such verb or gate/);
    assert.match(gate('Run `bin/vawe-dev nope`.\n'), /`vawe-dev nope`: no such verb or gate/);
    assert.match(gate('Run `bin/vawe-dev check nope`.\n'), /`vawe-dev check nope`/);
    assert.match(gate('Run `bin/vawe-dev runs --nope`.\n'), /`vawe-dev runs --nope`/);
    assert.doesNotMatch(gate('Run `bin/vawe-dev land` and `bin/vawe-dev check doc-refs` and `bin/vawe-dev runs --all`.\n'), /vawe-dev/);
  } finally {
    fs.rmSync(file, { force: true });
  }
});
