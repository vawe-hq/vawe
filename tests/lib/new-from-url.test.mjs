import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VERBS, siteStep } from '../../harness/cli/verbs.mjs';
import { parseArgs } from '../../harness/cli/parse.mjs';
import { askLines, questionsJson } from '../../harness/cli/new.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const NEW = VERBS.find((v) => v.name === 'new');
const build = (...args) => { const { values, positional } = parseArgs(NEW, args); return NEW.build(values, positional); };

test('new --from-url with no name is the old shot: one capture step, PNGs in out/shot', () => {
  const [step, ...more] = build('--from-url', '/,/blog', '--w', '390', '--full');
  assert.equal(more.length, 0);
  assert.deepEqual([step.script, step.args], ['harness/media/shot.mjs', ['/,/blog', '--w', '390', '--full']]);
});

test('new <name> --from-url starts the film (no step), and its captures go to the film assets', () => {
  assert.equal(build('acme', '--from-url', 'https://acme.com'), null);
  assert.equal(siteStep({ 'from-url': 'https://acme.com', w: '1440' }, 'acme').args.at(-1), 'films/acme/assets/site');
  assert.equal(siteStep({ 'from-url': 'https://acme.com', tour: 't.json', fps: 30 }, 'acme').args.includes('films/acme/assets/tour.mp4'), true);
  assert.equal(siteStep({ 'from-url': 'https://acme.com', out: 'out/x' }, 'acme').args.at(-1), 'out/x');
});

test('a capture flag without --from-url, a bad target and a call with neither name nor url are one-line usage errors', () => {
  assert.throws(() => build('acme', '--w', '390'), /^Error: --w needs --from-url$|--w needs --from-url/);
  assert.throws(() => build('acme', '--tour', 't.json'), /--tour needs --from-url/);
  assert.throws(() => build('acme', '--from-url', 'acme.com'), /"acme.com" is not a route/);
  assert.throws(() => build('acme', '--from-url', 'https://acme.com', '--w', '5'), /--w is not a comma list of widths/);
  assert.throws(() => build('--request', 'x'), /missing <name>; usage: vawe new <name> \[flags\], or vawe new --from-url/);
  assert.throws(() => build('acme', '--ref', 'r.mp4', '--from-url', 'https://acme.com'), /--ref recreates an mp4 and --from-url captures a website: run one/);
});

test('the questions a call leaves open carry --from-url into the command that answers them', () => {
  const lines = askLines('acme', 'a launch', undefined, [{ key: 'subject', required: true, question: 'q', why: 'w', example: 'e' }], 'https://acme.com').join('\n');
  assert.match(lines, /bin\/vawe new acme --request "a launch" --from-url https:\/\/acme\.com --answers <file>/);
  assert.match(questionsJson('acme', { request: 'a launch', fromUrl: 'https://acme.com' }).answer_with, /--from-url https:\/\/acme\.com --answers <file>/);
  const answered = questionsJson('acme', { request: 'a launch', fromUrl: 'https://acme.com' }).calls.flatMap((c) => c.questions.map((q) => q.header));
  assert.ok(!answered.includes('Assets'), 'the captures answer the Assets question');
});

test('bin/vawe new <name> --from-url writes the film and its captures; a second call captures only; a bad width writes nothing', () => {
  const name = `zz-fromurl-${process.pid}`;
  const dir = path.join(ROOT, 'films', name);
  const page = 'films/examples/colour-sting/page.html';
  const run = (...args) => spawnSync(process.execPath, ['bin/vawe', 'new', ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: '' } });
  try {
    const refused = run(name, '--defaults', '--from-url', page, '--w', '5');
    assert.equal(refused.status, 2);
    assert.equal(fs.existsSync(dir), false, 'a refused call writes no film');
    const first = run(name, '--request', 'a launch film for acme', '--defaults', '--from-url', page, '--w', '400');
    assert.equal(first.status, 0, first.stderr + first.stdout);
    assert.match(fs.readFileSync(path.join(dir, 'brief.md'), 'utf8'), /captured in films\/zz-fromurl-\d+\/assets\/site\//);
    assert.deepEqual(fs.readdirSync(path.join(dir, 'assets/site')), ['colour-sting-page-400.png']);
    assert.match(first.stdout, /captured: films\/zz-fromurl-\d+\/assets\/site: Read each PNG at full size/);
    fs.rmSync(path.join(dir, 'assets/site'), { recursive: true });
    const again = run(name, '--from-url', page, '--w', '400');
    assert.equal(again.status, 0, again.stderr);
    assert.doesNotMatch(again.stdout, /wrote films/);
    assert.deepEqual(fs.readdirSync(path.join(dir, 'assets/site')), ['colour-sting-page-400.png']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, 'out', `${name}.runs.jsonl`), { force: true });
  }
});
