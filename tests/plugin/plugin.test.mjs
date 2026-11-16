import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { denial, MCP_PREFIX, NAMED_TOOLS } from '../../harness/live/film-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const json = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const agent = () => {
  const text = fs.readFileSync(path.join(ROOT, 'agents/vawe.md'), 'utf8');
  const front = text.match(/^---\n([\s\S]*?)\n---/)[1];
  return { text, tools: front.match(/^tools:\s*(.+)$/m)[1].split(',').map((t) => t.trim()) };
};

test('the manifest parses and its name matches the marketplace entry', () => {
  const manifest = json('.claude-plugin/plugin.json');
  const entry = json('.claude-plugin/marketplace.json').plugins.find((p) => p.source === './');
  assert.equal(manifest.name, entry.name);
  assert.deepEqual(manifest.mcpServers.vawe.args, ['${CLAUDE_PLUGIN_ROOT}/bin/vawe', 'mcp']);
});

test('every marketplace entry points at files that exist', () => {
  for (const plugin of json('.claude-plugin/marketplace.json').plugins) {
    assert.ok(fs.existsSync(path.join(ROOT, plugin.source)), plugin.source);
    for (const skill of plugin.skills ?? []) assert.ok(fs.existsSync(path.join(ROOT, plugin.source, skill, 'SKILL.md')), skill);
  }
});

test('the hook file runs a script that exists', () => {
  const [group] = json('hooks/hooks.json').hooks.PreToolUse;
  assert.equal(group.matcher, 'Write|Edit|MultiEdit|Bash');
  for (const arg of group.hooks[0].args) assert.ok(fs.existsSync(arg.replace('${CLAUDE_PLUGIN_ROOT}', ROOT)), arg);
});

test('the agent has only the vawe tools plus Read, Grep and Glob', () => {
  const { tools } = agent();
  for (const banned of ['Bash', 'Write', 'Edit', 'MultiEdit']) assert.ok(!tools.includes(banned), banned);
  for (const t of tools) assert.ok(/^(?:Read|Grep|Glob)$/.test(t) || t.startsWith(`${MCP_PREFIX}vawe_`), t);
  for (const name of NAMED_TOOLS) assert.ok(tools.includes(`${MCP_PREFIX}${name}`), `${name} is named by the hook but missing from the agent`);
  assert.ok(!tools.includes(`${MCP_PREFIX}vawe_approve`));
});

test('the agent file never tells the agent to approve', () => {
  assert.match(agent().text, /Only the person approves/);
});

test('the command files exist and the /vawe command names the agent', () => {
  assert.match(fs.readFileSync(path.join(ROOT, 'commands/vawe.md'), 'utf8'), /vawe-agent:vawe/);
  assert.match(fs.readFileSync(path.join(ROOT, 'commands/approve.md'), 'utf8'), /disable-model-invocation: true/);
});

const denies = (name, input, re) => assert.match(denial(name, input) ?? '', re);
const allows = (name, input) => assert.equal(denial(name, input), null);

test('the hook denies a write to a film page and names the vawe tool', () => {
  denies('Write', { file_path: 'films/x/page.html', content: '<p>' }, /vawe_write_page/);
  denies('Edit', { file_path: '/abs/films/x/page.html', old_string: 'a', new_string: 'b' }, /vawe_edit_page/);
  denies('MultiEdit', { file_path: 'films/x/kit/card.html', edits: [] }, /vawe_status/);
});

test('the hook denies a shell write to a film file', () => {
  denies('Bash', { command: 'echo hi > films/x/brief.md' }, /films\/x\/ \(brief\)/);
  denies('Bash', { command: "cat > films/x/page.html <<'EOF'\n<p>\nEOF" }, /vawe_write_page/);
  denies('Bash', { command: 'sed -i "" s/a/b/ films/x/DESIGN.md' }, /\(design\)/);
});

test('the hook denies raw ffmpeg and Chrome, and names the vawe tool', () => {
  denies('Bash', { command: 'ffmpeg -i a.mp4 b.mp4' }, /vawe_render_draft/);
  denies('Bash', { command: 'cd out && ffmpeg -i a.mp4 b.mp4' }, /raw ffmpeg/);
  denies('Bash', { command: 'chrome --headless --screenshot=a.png http://localhost:3000' }, /vawe_look/);
});

test('the hook allows reads, vawe verbs and writes outside films', () => {
  allows('Read', { file_path: 'films/x/page.html' });
  allows('Bash', { command: 'bin/vawe dev films/x/page.html' });
  allows('Bash', { command: 'cat films/x/page.html' });
  allows('Bash', { command: 'grep puppeteer package.json' });
  allows('Write', { file_path: 'notes/page.html', content: '<p>' });
  allows('Bash', { command: 'echo hi > out/notes.txt' });
});
