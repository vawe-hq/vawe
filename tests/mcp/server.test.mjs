// node --test tests/mcp/server.test.mjs
// The MCP server driven through the SDK client over stdio. VAWE_WORK points the workspace at a temp folder, so the test film and its out/
// never touch the checkout.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-mcp-'));
const FILM = `mcp-test-${process.pid}`;
const DIR = path.join(WORK, 'films', FILM);
const PAGE = path.join(DIR, 'page.html');
const GOOD = '<meta name="duration" content="3">\n<meta name="message" content="zero fees">\n<section data-world="hello"><h1>Zero fees</h1><h1>Again</h1></section>\n<script>setTimeout(() => {}, 10)</script>\n';
const TOOLS = ['vawe_status', 'vawe_new_film', 'vawe_read_rules', 'vawe_write_page', 'vawe_edit_page', 'vawe_frame', 'vawe_render_draft', 'vawe_look', 'vawe_critique', 'vawe_ship', 'vawe_write_doc', 'vawe_edit_doc', 'vawe_wait'];

const IDEAS = '## Ideas\n\n| at | meaning | i1 | i2 | i3 | i4 | chosen | why |\n|---|---|---|---|---|---|---|---|\n| cold | start | type: a word, 0.3 | object: a ring, 0.2 | light: a glow, 0.4 | paper: a fold, 0.1 | 2 | because the ring is the brand |\n\n';

let client;

const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
  return { ...JSON.parse(r.content[0].text), isError: r.isError === true, content: r.content };
};

before(async () => {
  client = new Client({ name: 'mcp-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'bin', 'vawe'), 'mcp'], cwd: ROOT, env: { ...process.env, VAWE_WORK: WORK }, stderr: 'ignore' }));
});

after(async () => {
  await client.close();
  fs.rmSync(WORK, { recursive: true, force: true });
});

test('lists the ten tools of the plan, the two doc tools and wait', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOLS].sort());
  assert.ok(tools.every((t) => t.description.length > 20 && t.description.length < 300));
});

test('a film that does not exist: status and write refuse', async () => {
  const status = await call('vawe_status', { film: FILM });
  assert.equal(status.ok, false);
  assert.match(status.next, /vawe_new_film/);
  assert.equal((await call('vawe_write_page', { film: FILM, html: GOOD })).ok, false);
  assert.equal(fs.existsSync(DIR), false);
});

test('new film writes the folder; a second call with the same name refuses', async () => {
  const made = await call('vawe_new_film', { name: FILM, request: 'a 3 second sting that says zero fees' });
  assert.equal(made.ok, true, made.output);
  assert.ok(fs.existsSync(path.join(DIR, 'brief.md')));
  const again = await call('vawe_new_film', { name: FILM, request: 'x' });
  assert.equal(again.ok, false);
  assert.equal(again.findings[0].code, 'refused');
});

test('write_page with no duration meta is refused and writes nothing', async () => {
  const before = fs.existsSync(PAGE) ? fs.readFileSync(PAGE, 'utf8') : null;
  const r = await call('vawe_write_page', { film: FILM, html: '<section data-world="a"><h1>x</h1></section>' });
  assert.equal(r.ok, false);
  assert.ok(r.findings.some((f) => f.code === 'duration'));
  assert.equal(fs.existsSync(PAGE) ? fs.readFileSync(PAGE, 'utf8') : null, before);
});

test('write_page ok writes the page and returns advise findings, next and taste', async () => {
  const r = await call('vawe_write_page', { film: FILM, html: GOOD });
  assert.equal(r.ok, true);
  assert.equal(fs.readFileSync(PAGE, 'utf8'), GOOD);
  assert.ok(r.findings.some((f) => f.code === 'timer'));
  assert.equal(typeof r.next, 'string');
  assert.ok(Array.isArray(r.taste));
});

test('edit_page refuses an old text that is not unique or missing, and keeps the page', async () => {
  const many = await call('vawe_edit_page', { film: FILM, old: '<h1>', new: '<h2>' });
  assert.equal(many.ok, false);
  assert.equal(many.findings[0].code, 'edit-not-unique');
  const none = await call('vawe_edit_page', { film: FILM, old: 'not in the page', new: 'x' });
  assert.equal(none.ok, false);
  assert.equal(fs.readFileSync(PAGE, 'utf8'), GOOD);
});

test('edit_page replaces one exact match, and refuses a result that breaks the contract', async () => {
  const broke = await call('vawe_edit_page', { film: FILM, old: '<meta name="duration" content="3">', new: '' });
  assert.equal(broke.ok, false);
  assert.equal(fs.readFileSync(PAGE, 'utf8'), GOOD);
  const ok = await call('vawe_edit_page', { film: FILM, old: 'Zero fees', new: 'Costs $& nothing' });
  assert.equal(ok.ok, true);
  assert.match(fs.readFileSync(PAGE, 'utf8'), /<h1>Costs \$& nothing<\/h1>/);
});

test('write_doc and edit_doc write brief.md, DESIGN.md and kit files, and refuse any other path', async () => {
  const brief = fs.readFileSync(path.join(DIR, 'brief.md'), 'utf8');
  const edited = await call('vawe_edit_doc', { film: FILM, file: 'brief.md', old: '## Ideas', new: '## Ideas' });
  assert.equal(edited.findings?.[0]?.code === 'edit-not-unique' || edited.ok, true);
  const design = await call('vawe_write_doc', { film: FILM, file: 'DESIGN.md', text: '# design\n' });
  assert.equal(design.ok, true);
  assert.equal(fs.readFileSync(path.join(DIR, 'DESIGN.md'), 'utf8'), '# design\n');
  assert.equal((await call('vawe_write_doc', { film: FILM, file: 'kit/parts/card.html', text: '<div></div>' })).ok, true);
  assert.ok(fs.existsSync(path.join(DIR, 'kit', 'parts', 'card.html')));
  const edit = await call('vawe_edit_doc', { film: FILM, file: 'DESIGN.md', old: 'design', new: 'plan' });
  assert.equal(edit.ok, true);
  assert.equal(fs.readFileSync(path.join(DIR, 'DESIGN.md'), 'utf8'), '# plan\n');
  for (const file of ['page.html', '../x.md', 'kit/../page.html', 'kit/../../x', '/etc/passwd', 'notes.md']) {
    const r = await call('vawe_write_doc', { film: FILM, file, text: 'x' });
    assert.equal(r.ok, false, file);
    assert.equal(r.findings[0].code, 'bad-path');
  }
  assert.equal(fs.readFileSync(PAGE, 'utf8').includes('Costs'), true);
  assert.ok(brief.length > 0);
});

test('render_draft is refused before the plan is filled; the refusal names the next step', async () => {
  const r = await call('vawe_render_draft', { film: FILM });
  assert.equal(r.ok, false);
  assert.equal(r.findings[0].code, 'refused');
  assert.ok(r.next);
});

test('look, critique and frame --cuts are refused before a draft', async () => {
  assert.equal((await call('vawe_look', { film: FILM, t: [1] })).ok, false);
  assert.equal((await call('vawe_critique', { film: FILM })).ok, false);
  assert.equal((await call('vawe_frame', { film: FILM, mode: 'cuts' })).ok, false);
});

test('ship is refused without the approvals', async () => {
  const r = await call('vawe_ship', { film: FILM });
  assert.equal(r.ok, false);
  assert.equal(r.findings[0].code, 'refused');
});

test('read_rules: an unknown topic is refused with the valid ones; a known topic returns lines', async () => {
  const bad = await call('vawe_read_rules', { film: FILM, topic: 'smell' });
  assert.equal(bad.ok, false);
  assert.match(bad.findings[0].fix, /type, colour, motion, cuts, sound, layout/);
  const good = await call('vawe_read_rules', { film: FILM, topic: 'type' });
  assert.equal(good.ok, true);
  assert.ok(good.taste.at(-1).startsWith('read taste/craft/'));
});

test('read_rules kit lists the kit files of the film and the moves index', async () => {
  const r = await call('vawe_read_rules', { film: FILM, topic: 'kit' });
  assert.equal(r.ok, true);
  assert.ok(r.kit.includes(`kit part: films/${FILM}/kit/parts/card.html`), JSON.stringify(r.kit));
  assert.ok(r.kit.some((l) => l.includes('prompts/moves/README.md')));
});

test('a write returns taste lines for the beats it changed, and never the same line twice for the film', async () => {
  const page = (word) => `<meta name="duration" content="3">\n<meta name="message" content="m">\n<section data-world="one"><h1>${word}</h1></section>\n<section data-world="two"><div class="panel"><button>Go</button></div><audio src="assets/a.wav" data-at="1"></audio></section>\n`;
  const first = await call('vawe_write_page', { film: FILM, html: page('Zero') });
  assert.equal(first.ok, true);
  assert.ok(first.taste.length > 0 && first.taste.length <= 8, JSON.stringify(first.taste));
  assert.ok(first.taste.some((l) => l.startsWith('read taste/craft/')));
  const again = await call('vawe_edit_page', { film: FILM, old: 'Zero', new: 'Free' });
  assert.equal(again.ok, true);
  const repeated = again.taste.filter((l) => first.taste.includes(l));
  assert.deepEqual(repeated, []);
  const untouched = await call('vawe_edit_page', { film: FILM, old: 'data-at="1"', new: 'data-at="2"' });
  assert.ok(untouched.taste.every((l) => !first.taste.includes(l)));
});

test('a hand cubic-bezier in a write names the house ease', async () => {
  const html = '<meta name="duration" content="3">\n<meta name="message" content="m">\n<section data-world="one"><h1>x</h1></section>\n<style>h1 { animation: a 1s cubic-bezier(0.55, 0, 1, 0.45) both }</style>\n';
  const r = await call('vawe_write_page', { film: FILM, html });
  assert.equal(r.ok, true);
  const f = r.findings.find((x) => x.code === 'hand-ease');
  assert.match(f.fix, /--ease-carry/);
});

test('wait is refused when nothing runs, and a refusal for a film that does not exist', async () => {
  const r = await call('vawe_wait', { film: FILM });
  assert.equal(r.ok, false);
  assert.equal(r.findings[0].code, 'nothing-running');
  const none = await call('vawe_wait', { film: `${FILM}-nope` });
  assert.equal(none.ok, false);
  assert.equal(none.findings[0].code, 'refused');
});

test('a film name with a path in it is rejected by the schema', async () => {
  const r = await client.callTool({ name: 'vawe_status', arguments: { film: '../x' } });
  assert.equal(r.isError, true);
});

// One real render: a copy of the judged example, whose plan is complete, drafted for its first 3 seconds. Opt in: VAWE_MCP_RENDER=1.
test('render_draft renders a draft of a film whose plan is filled', { skip: process.env.VAWE_MCP_RENDER !== '1' }, async () => {
  const name = `${FILM}-render`;
  const dir = path.join(WORK, 'films', name);
  fs.cpSync(path.join(ROOT, 'films', 'examples', 'colour-sting'), dir, { recursive: true, preserveTimestamps: true });
  const brief = path.join(dir, 'brief.md');
  const stamp = fs.statSync(brief).mtime;
  fs.writeFileSync(brief, fs.readFileSync(brief, 'utf8').replace('## Board', IDEAS + '## Board'));
  fs.utimesSync(brief, stamp, stamp);
  try {
    const frames = await call('vawe_frame', { film: name, mode: 'world' });
    assert.equal(frames.ok, true, frames.output);
    assert.ok(frames.content.some((c) => c.type === 'image'));
    const r = await call('vawe_render_draft', { film: name, from: 0, to: 3 });
    assert.equal(r.ok, true, JSON.stringify(r.findings) + r.output);
    assert.ok(fs.readdirSync(path.join(WORK, 'out')).some((f) => f.startsWith(name) && f.endsWith('.mp4')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    for (const f of fs.readdirSync(path.join(WORK, 'out'))) if (f.startsWith(name)) fs.rmSync(path.join(WORK, 'out', f), { recursive: true, force: true });
  }
});

