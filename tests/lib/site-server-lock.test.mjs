import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { withSite } from '../../harness/lib/site-server.mjs';

const listen = (port) => new Promise((resolve) => { const s = createServer((q, r) => r.end('ok')); s.listen(port, '127.0.0.1', () => resolve(s)); });

test('two withSite callers on one port start one server at a time, and the second starts its own after the first stops', async () => {
  const lockDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-site-lock-'));
  const probe = await listen(0);
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const base = `http://localhost:${port}`;
  const events = [];
  let server = null;
  const start = async () => {
    events.push('start');
    server = await listen(port);
    return () => { events.push('stop'); server.close(); server.closeAllConnections?.(); };
  };
  const caller = (name) => withSite(base, async () => {
    events.push(`${name} in`);
    await new Promise((r) => setTimeout(r, 150));
    events.push(`${name} out`);
  }, { start, lockDir });
  try {
    await Promise.all([caller('a'), caller('b')]);
    assert.deepEqual(events, ['start', 'a in', 'a out', 'stop', 'start', 'b in', 'b out', 'stop']);
    assert.deepEqual(fs.readdirSync(lockDir), []);
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
  }
});
