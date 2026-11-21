import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cidrsFromJson, ipInList, readEvents, reportLines } from '../../harness/lib/bots-report.mjs';

test('IP lists: CIDR matching for v4 and v6', () => {
  const lists = cidrsFromJson({ prefixes: [{ ipv4Prefix: '20.171.206.0/24' }, { ipv6Prefix: '2001:db8::/32' }, { ipv4Prefix: '34.162.230.222/32' }] });
  assert.equal(lists.length, 3);
  assert.ok(ipInList('20.171.206.77', lists));
  assert.ok(!ipInList('20.171.207.1', lists));
  assert.ok(ipInList('2001:db8:1::5', lists));
  assert.ok(ipInList('34.162.230.222', lists));
});

test('the report summarises a fixture log', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'botlog-'));
  const lines = [
    { t: '2026-10-27T10:00:00Z', class: 'ai-training', bot: 'GPTBot', path: '/a', served: 'html', wantsMd: false, refHost: '', ip: '20.171.206.5' },
    { t: '2026-10-27T10:01:00Z', class: 'ai-training', bot: 'GPTBot', path: '/missing', served: 'html', wantsMd: false, refHost: '', ip: '6.6.6.6' },
    { t: '2026-10-27T10:01:00Z', class: 'ai-training', bot: 'GPTBot', path: '/missing', status: 404, served: 'html', wantsMd: false, refHost: '', ip: '6.6.6.6' },
    { t: '2026-10-27T10:02:00Z', class: 'ai-user-fetch', bot: 'Claude-User', path: '/a.md', served: 'md', wantsMd: true, refHost: '', ip: '1.2.3.4' },
    { t: '2026-10-27T10:03:00Z', class: 'coding-agent', bot: 'cursor', path: '/a', served: 'html', wantsMd: false, refHost: '' },
    { t: '2026-10-27T10:04:00Z', class: 'ai-referral', bot: 'chatgpt', path: '/a', served: 'html', wantsMd: false, refHost: 'chatgpt.com' },
    { t: '2026-09-01T10:04:00Z', class: 'ai-referral', bot: 'chatgpt', path: '/old', served: 'html', wantsMd: false, refHost: 'chatgpt.com' },
  ];
  fs.writeFileSync(path.join(dir, 'bots-2026-10-27.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n{torn');
  const events = readEvents(dir, { days: 30, now: Date.parse('2026-10-28T00:00:00Z') });
  assert.equal(events.length, 6);
  const text = reportLines(events, { GPTBot: cidrsFromJson({ prefixes: [{ ipv4Prefix: '20.171.206.0/24' }] }), 'Claude-User': null }).join('\n');
  assert.match(text, /GPTBot: 2 hits, 2 pages, md 0%, wantsMd 0%; ip: 1 verified, 1 UNVERIFIED/);
  assert.match(text, /404: 1 on \/missing \(1\)/);
  assert.match(text, /Claude-User: 1 hits, 1 pages, md 100%, wantsMd 100%; ip: 1 no vendor list/);
  assert.match(text, /cursor: 1 hits.*no vendor list/);
  assert.match(text, /ai-referral landings\n {2}\/a: 1 \(chatgpt 1\)/);
});
