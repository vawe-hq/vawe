import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toolNext } from '../../harness/mcp/next-as-tools.mjs';
import { say, vawe, cmd, doc, buildPage } from '../../harness/lib/next-step.mjs';
import { STEP, briefStep } from '../../harness/live/stage-say.mjs';
import { SHOW_PLAN_STEP, shipProblemStep, planProblemStep } from '../../harness/lib/approval.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REL = 'films/x/page.html';
const t = (parts, film = 'x') => toolNext(parts, film);

test('each verb with a tool becomes that tool call, with the words around it kept', () => {
  assert.equal(t(say`${vawe('dev', REL)}`), 'vawe_render_draft {"film":"x"}');
  assert.equal(t(say`${vawe('dev', REL, '--from', '2', '--to', '3.5')}, then more`), 'vawe_render_draft {"film":"x","from":2,"to":3.5}, then more');
  assert.equal(t(say`${vawe('frame', REL, '--world', 'all')}`), 'vawe_frame {"film":"x","mode":"world"}');
  assert.equal(t(say`${vawe('frame', REL, '--board')} lists what the taste docs say`), 'vawe_frame {"film":"x","mode":"board"} lists what the taste docs say');
  assert.equal(t(say`${vawe('frame', REL, '--board', '--all')}, or the board`), 'vawe_frame {"film":"x","mode":"board"}, or the board');
  assert.equal(t(say`${vawe('frame', REL, '--cuts')} and Read every cut`), 'vawe_frame {"film":"x","mode":"cuts"} and Read every cut');
  assert.equal(t(say`(${vawe('frame', REL, '--directions')})`), '(vawe_frame {"film":"x","mode":"directions"})');
  assert.equal(t(say`${vawe('frame', REL, '--moment', '4.2')} and Read it`), 'vawe_frame {"film":"x","mode":"moment","t":4.2} and Read it');
  assert.equal(t(say`${vawe('frame', REL, '--moment', '<the second you fixed>')} and Read it`), 'vawe_frame {"film":"x","mode":"moment","t":"<the second you fixed>"} and Read it');
  assert.equal(t(say`${vawe('frame', REL, '--moment', '<s>', '--onion')}`), 'vawe_frame {"film":"x","mode":"moment","t":"<s>"} (the onion and velocity views have no tool)');
  assert.equal(t(say`${vawe('frame', REL, '--at', '3')}`), 'vawe_look {"film":"x","t":[3]}');
  assert.equal(t(say`${vawe('critique', REL, '--fresh')}`), 'vawe_critique {"film":"x"}');
  assert.equal(t(say`${cmd('critique', [REL], { env: 'VAWE_AGENT=critic' })}`), 'vawe_critique {"film":"x"}');
  assert.equal(t(say`${vawe('ship', REL)}, then ${vawe('wait', REL)} (one call`), 'vawe_ship {"film":"x"}, then vawe_wait {"film":"x"} (one call');
  assert.equal(t(say`${vawe('wait', 'films/other-film/page.html')}`), 'vawe_wait {"film":"other-film"}');
  assert.equal(t(say`${vawe('new', '<other-name>')} writes the template`), 'vawe_new_film {"name":"<other-name>"} writes the template');
  assert.equal(t(say`${vawe('new', 'my-film', '--request', 'a sting')} now`), 'vawe_new_film {"name":"my-film","request":"a sting"} now');
});

test('a <page> placeholder takes the film of the call; a verb with no page takes the film too', () => {
  assert.equal(t(say`Read the ${vawe('frame', '<page>', '--cuts')} grids, or prepare`, 'launch'), 'Read the vawe_frame {"film":"launch","mode":"cuts"} grids, or prepare');
  assert.equal(t(say`then ${vawe('ship')}; ask`, 'launch'), 'then vawe_ship {"film":"launch"}; ask');
});

test('the reference study maps to vawe_refs', () => {
  assert.equal(t(say`${vawe('refs', 'list')}, ${vawe('refs', 'frames', '<id>')}, Read the frames`), 'vawe_refs {"action":"list"}, vawe_refs {"action":"frames","id":"<id>"}, Read the frames');
  assert.equal(t(say`${vawe('refs', 'frames')}, then Read the absolute paths`), 'vawe_refs {"action":"frames"}, then Read the absolute paths');
  assert.equal(t(say`${vawe('refs', 'frames', 'u6iro1jHujs')} and more`), 'vawe_refs {"action":"frames","id":"u6iro1jHujs"} and more');
  assert.equal(t(say`${vawe('frame', '<ref-id>', '--cuts')} on 2 reference films`), 'vawe_refs {"action":"cuts","id":"<ref-id>"} on 2 reference films');
});

test('a film doc gets the tool that writes it, once; a doc the agent only reads is left alone', () => {
  assert.equal(t(say`write ${doc('x', 'DESIGN.md', 'write')} and ${doc('x', 'kit/', 'write')} (format: y)`), 'write films/x/DESIGN.md (vawe_write_doc {"film":"x","file":"DESIGN.md"}) and films/x/kit/ (vawe_write_doc {"film":"x","file":"kit/<path>"}) (format: y)');
  assert.equal(t(say`then fill "Taken from" in ${doc('x', 'brief.md', 'edit')}: 4 frames, in ${doc('x', 'brief.md', 'edit')} again`), 'then fill "Taken from" in films/x/brief.md (vawe_edit_doc {"film":"x","file":"brief.md"}): 4 frames, in films/x/brief.md again');
  assert.equal(t(say`Read ${doc('x', 'brief.md', 'read')} first`), 'Read films/x/brief.md first');
  assert.equal(t(say`build one static state per world in ${buildPage(REL)} from the kit`), `build one static state per world in ${REL} (vawe_write_page, then vawe_edit_page) from the kit`);
});

test('a command no tool does stays as the shell text', () => {
  const cases = [
    [vawe('see', REL), `bin/vawe see ${REL}`],
    [vawe('sound', REL, '--at', '2'), `bin/vawe sound ${REL} --at 2`],
    [vawe('footage', 'log', '<film>'), 'bin/vawe footage log <film>'],
    [vawe('refs', 'add', '<url>', '--no-measure'), 'bin/vawe refs add <url> --no-measure'],
    [vawe('dev', REL, '--animatic'), `bin/vawe dev ${REL} --animatic`],
    [vawe('ship', REL, '--status'), `bin/vawe ship ${REL} --status`],
    [vawe('frame', REL, '--world', 'all', '--full'), `bin/vawe frame ${REL} --world all --full`],
    [vawe('frame', 'films/examples/colour-sting/page.html', '--world', 'all'), 'bin/vawe frame films/examples/colour-sting/page.html --world all'],
    [vawe('frame', REL, '--vs', 'ref.mp4', '--at', '2'), `bin/vawe frame ${REL} --vs ref.mp4 --at 2`],
    [vawe('dev', REL, 'extra'), `bin/vawe dev ${REL} extra`],
    [cmd('moves', ['--only', 'clip'], { bin: 'bin/vawe-dev' }), 'bin/vawe-dev moves --only clip'],
  ];
  for (const [part, shell] of cases) assert.equal(t([part]), shell);
});

test('text with no command is unchanged', () => {
  assert.equal(t('fix the page, then Read it'), 'fix the page, then Read it');
  assert.equal(toolNext(null), '');
});

test('the ui-skills command maps to vawe_ui_skills', () => {
  assert.match(t(STEP.skills('x', ['builder', 'type'])), /list the skills with vawe_ui_skills \{"action":"list"\}$/);
  const skills = (verb, ...args) => cmd(verb, args, { bin: 'command npx -y ui-skills' });
  assert.equal(t([skills('list', '--category', 'motion')]), 'vawe_ui_skills {"action":"list","category":"motion"}');
  assert.equal(t(say`${skills('get', 'zeke/swiss-design')} now`), 'vawe_ui_skills {"action":"get","slug":"zeke/swiss-design"} now');
});

test('every stage step reads the same through toolNext as the text did through the old translation', () => {
  const REF = path.join(ROOT, 'tests/mcp/fixtures/next-tools.json');
  const steps = {
    'SAY.study': STEP.study('x'), 'SAY.moves': STEP.moves(), 'SAY.design': STEP.design('x'), 'SAY.skills': STEP.skills('x', ['type', 'colour']),
    'SAY.states': STEP.states('x', REL), 'SAY.frames': STEP.frames('x', REL), 'SAY.ideas': STEP.ideas('x', REL), 'SAY.board': STEP.board('x', REL),
    'SAY.cut': STEP.cut('x'), 'SAY.dev': STEP.dev('x', REL), 'SAY.motion': STEP.motion('x', REL), 'SAY.cutCheck': STEP.cutCheck('x', REL),
    'SAY.motionRows': STEP.motionRows('x'), 'SAY.critique': STEP.critique('x', REL), 'SAY.plan': STEP.plan(REL, REL), 'SAY.ship': STEP.ship('x', REL),
    'briefStep.next': briefStep('x').step, 'briefStep.why': briefStep('x').whyStep,
    SHOW_PLAN: SHOW_PLAN_STEP, shipProblem: shipProblemStep(REL, { root: '/nonexistent-vawe-root', env: {} }), planProblem: planProblemStep(REL),
  };
  const want = JSON.parse(fs.readFileSync(REF, 'utf8'));
  for (const [k, v] of Object.entries(steps)) assert.equal(t(v), want[k], k);
});

test('the steps the stage logic builds are plain JSON', () => {
  const s = STEP.plan(REL, REL);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  assert.ok(s.every((p) => typeof p === 'string' || typeof p === 'object'));
});

test('every verb a bin/vawe command in the stage logic names is mapped, or listed here as having no tool', () => {
  const NO_TOOL = new Set(['see', 'sound', 'footage', 'check']);
  const MAPPED = new Set(['frame', 'dev', 'new', 'refs', 'wait', 'ship', 'critique']);
  const files = ['harness/live/stage-say.mjs', 'harness/live/plan-status.mjs', 'harness/cli/verbs.mjs', 'harness/cli/frame.mjs', 'harness/cli/new.mjs', 'harness/lib/approval.mjs', 'harness/lib/ship-status.mjs', 'harness/lib/critique-gate.mjs'];
  const found = new Set();
  for (const f of files) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter((l) => !/^\s*(?:\/\/|\/?\*)/.test(l)).join('\n');
    for (const m of code.matchAll(/(?<![\w-])bin\/vawe ([a-z]+)(?=[ `'"]|$)/gm)) found.add(m[1]);
    for (const m of code.matchAll(/\bvawe\('([a-z]+)'/g)) found.add(m[1]);
  }
  for (const verb of found) {
    if (['and', 'the', 'for', 'names', 'owns', 'passes', 'process', 'turns'].includes(verb)) continue;
    assert.ok(MAPPED.has(verb) || NO_TOOL.has(verb), `bin/vawe ${verb} in the stage logic has neither a tool nor an entry in NO_TOOL`);
  }
});
