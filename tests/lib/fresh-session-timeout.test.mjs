import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runFreshSession } from '../../harness/lib/fresh-session.mjs';

test('a session past its timeout fails with one line naming the env var', () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-claude-'));
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\nexec sleep 30\n', { mode: 0o755 });
  const old = process.env.PATH;
  process.env.PATH = `${bin}:${old}`;
  try {
    assert.throws(() => runFreshSession({ prompt: 'x', dirs: [bin], cwd: bin, timeoutS: 1, timeoutVar: 'VAWE_CRITIC_TIMEOUT', name: 'critic' }),
      /the critic session ran past 1 s and was stopped: raise it with VAWE_CRITIC_TIMEOUT=<seconds>/);
  } finally { process.env.PATH = old; }
});
