// node --test tests/mcp/doc-advice.test.mjs
// brief.md and DESIGN.md advice, and vawe_ui_skills, through an in-process MCP client. The npx call is replaced; nothing renders.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../../harness/mcp/server.mjs';
import { measuredSections, ACCEPTANCE } from '../../harness/lib/measured-brief.mjs';
import { uiSkillsArgs, unfetchedClaims } from '../../harness/mcp/ui-skills.mjs';

const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-doc-advice-'));
const FILM = 'advice-film';
const ran = [];
let client;

const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  return { ...JSON.parse(r.content[0].text), isError: r.isError === true };
};

const fakeRun = async (args) => {
  ran.push(args);
  return args[0] === 'get' && args[1] === 'broken/skill' ? { ok: false, text: 'boom', reason: 'ui-skills exited with 1' } : { ok: true, text: `ran ${args.join(' ')}`, reason: null };
};

before(async () => {
  fs.mkdirSync(path.join(WORK, 'films', FILM), { recursive: true });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer({ work: WORK, runUiSkills: fakeRun }).connect(b);
  client = new Client({ name: 'doc-advice', version: '1.0.0' });
  await client.connect(a);
});

after(() => fs.rmSync(WORK, { recursive: true, force: true }));

const briefOf = (rows) => `## Spec\n\n### Shots\n| id | start s | end s |\n|---|---|---|\n| s1 | 0 | 3 |\n\n### Words\n| text | shot | appear s | settle s | cap % | x % | y % | weight | colour |\n|---|---|---|---|---|---|---|---|---|\n| Hi | s1 | 0 | 0.6 | 10 | 7 | 60 | 700 | #111 |\n\n### Objects\n| id | selector | shot | in s | settle s | out s |\n|---|---|---|---|---|---|\n| o1 | h1 | s1 | 0 | 0.6 | 3 |\n\n### Acceptance\n| metric | target |\n|---|---|\n${rows.map(([m, t]) => `| ${m} | ${t} |`).join('\n')}\n`;

test('the template brief gets no table finding', async () => {
  const { sections } = measuredSections({ name: FILM, face: { family: 'Geist' } });
  const brief = `## Spec\n\n${sections.spec}\n\n### Acceptance\n\n${sections.acceptance}\n`;
  const r = await call('vawe_write_doc', { film: FILM, file: 'brief.md', text: brief });
  assert.deepEqual(r.findings.filter((f) => f.code.startsWith('brief-')), []);
});

test('a brief with two acceptance rows names the thirteen it lacks, by their exact metric names', async () => {
  const r = await call('vawe_write_doc', { film: FILM, file: 'brief.md', text: briefOf(ACCEPTANCE.slice(0, 2)) });
  const f = r.findings.find((x) => x.code === 'brief-acceptance');
  assert.match(f.message, /has 2 of the 15 standard rows/);
  for (const [metric, target] of ACCEPTANCE.slice(2)) assert.ok(f.message.includes(`${metric} (${target})`), metric);
  for (const [metric] of ACCEPTANCE.slice(0, 2)) assert.ok(!f.message.includes(`${metric} (`), metric);
  assert.equal(r.ok, true);
});

test('a brief with no tables names every row and every spec table', async () => {
  const r = await call('vawe_write_doc', { film: FILM, file: 'brief.md', text: '## Task\n\n- what: a sting\n' });
  assert.match(r.findings.find((x) => x.code === 'brief-acceptance').message, /has 0 of the 15/);
  assert.match(r.findings.find((x) => x.code === 'brief-spec').message, /Shots, Words, Objects/);
});

test('vawe_edit_doc on brief.md gives the same advice, and a full set clears it', async () => {
  await call('vawe_write_doc', { film: FILM, file: 'brief.md', text: briefOf(ACCEPTANCE.slice(0, 14)) });
  const [metric, target] = ACCEPTANCE[14];
  const r = await call('vawe_edit_doc', { film: FILM, file: 'brief.md', old: `| ${ACCEPTANCE[13][0]} | ${ACCEPTANCE[13][1]} |\n`, new: `| ${ACCEPTANCE[13][0]} | ${ACCEPTANCE[13][1]} |\n| ${metric} | ${target} |\n` });
  assert.equal(r.ok, true);
  assert.deepEqual(r.findings.filter((f) => f.code.startsWith('brief-')), []);
});

test('DESIGN.md with no lines names every rung', async () => {
  const r = await call('vawe_write_doc', { film: FILM, file: 'DESIGN.md', text: '# Design\n\nA warm look.\n' });
  const rungs = r.findings.filter((f) => f.code === 'design-rung').map((f) => /Skill (\w+):/.exec(f.message)[1]);
  assert.deepEqual(rungs, ['builder', 'type', 'colour', 'depth', 'frame']);
  assert.equal(r.ok, true);
  assert.ok(r.taste.some((l) => /\(rule [a-z-]+\)$/.test(l)), 'DESIGN.md sets the look, so its reply carries the look rules');
  assert.ok(r.taste.some((l) => l === 'read taste/craft/typography.md'), JSON.stringify(r.taste));
});

const DESIGN = '# Design\n\nSkill builder: leonxlnx/minimalist-skill: flat fills\nSkill type: zeke/swiss-design: light grotesque\nSkipped colour: the brief gives the palette\nSkill depth: mengto/beautiful-shadows: one soft shadow\nSkill frame: vawe: one line, 3 things\n';

test('a Skill line whose slug was never fetched for this film is named', async () => {
  const r = await call('vawe_write_doc', { film: FILM, file: 'DESIGN.md', text: DESIGN });
  assert.deepEqual(r.findings.filter((f) => f.code === 'design-rung'), []);
  const unread = r.findings.filter((f) => f.code === 'design-skill-unread').map((f) => /Skill (\w+): (\S+)"/.exec(f.message).slice(1, 3).join(' '));
  assert.deepEqual(unread, ['builder leonxlnx/minimalist-skill', 'type zeke/swiss-design', 'depth mengto/beautiful-shadows']);
});

test('vawe_ui_skills get with film logs the slug, and the finding goes away for it', async () => {
  const got = await call('vawe_ui_skills', { action: 'get', slug: 'zeke/swiss-design', film: FILM });
  assert.equal(got.ok, true);
  assert.equal(got.output, 'ran get zeke/swiss-design');
  const log = fs.readFileSync(path.join(WORK, 'out', `${FILM}.ui-skills.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(log.map((l) => l.slug), ['zeke/swiss-design']);
  const r = await call('vawe_edit_doc', { film: FILM, file: 'DESIGN.md', old: 'light grotesque', new: 'light grotesque, tabular' });
  assert.deepEqual(r.findings.filter((f) => f.code === 'design-skill-unread').map((f) => f.message.match(/Skill (\w+)/)[1]), ['builder', 'depth']);
});

test('get without film is not logged; a failed get is not logged', async () => {
  await call('vawe_ui_skills', { action: 'get', slug: 'pbakaus/colorize' });
  const failed = await call('vawe_ui_skills', { action: 'get', slug: 'broken/skill', film: FILM });
  assert.equal(failed.ok, false);
  assert.equal(failed.findings[0].code, 'ui-skills-failed');
  const log = fs.readFileSync(path.join(WORK, 'out', `${FILM}.ui-skills.jsonl`), 'utf8');
  assert.ok(!log.includes('colorize') && !log.includes('broken'));
});

test('start, categories and list run the CLI; list takes a category', async () => {
  ran.length = 0;
  await call('vawe_ui_skills', { action: 'start' });
  await call('vawe_ui_skills', { action: 'categories' });
  await call('vawe_ui_skills', { action: 'list', category: 'typography' });
  assert.deepEqual(ran, [['start'], ['categories'], ['list', '--category', 'typography']]);
});

test('bad input is refused before the CLI runs', async () => {
  ran.length = 0;
  for (const input of [{ action: 'get' }, { action: 'get', slug: '../etc/passwd' }, { action: 'get', slug: 'a/b; rm -rf x' }, { action: 'list', category: '--evil' }, { action: 'start', category: 'motion' }]) {
    const r = await call('vawe_ui_skills', input);
    assert.equal(r.ok, false, JSON.stringify(input));
    assert.equal(r.findings[0].code, 'bad-input');
  }
  assert.deepEqual(ran, []);
});

test('uiSkillsArgs and unfetchedClaims are plain functions', () => {
  assert.deepEqual(uiSkillsArgs({ action: 'list' }), { args: ['list'] });
  assert.deepEqual(unfetchedClaims('Skill colour: Pbakaus/Colorize: x\nSkill frame: vawe: y', new Set(['pbakaus/colorize'])), []);
  assert.deepEqual(unfetchedClaims('Skill color: a/b: x', new Set()), [{ rung: 'color', slug: 'a/b' }]);
});
