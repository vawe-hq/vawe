import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { translateNext, nextAsTools } from '../../harness/mcp/next-as-tools.mjs';
import { SAY, briefStep } from '../../harness/live/stage-say.mjs';
import { SHOW_PLAN } from '../../harness/lib/approval.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REL = 'films/x/page.html';
const t = (text, film = 'x') => nextAsTools(text, { film });

test('each verb with a tool becomes that tool call, with the words around it kept', () => {
  assert.equal(t(`bin/vawe dev ${REL}`), 'vawe_render_draft {"film":"x"}');
  assert.equal(t(`bin/vawe dev ${REL} --from 2 --to 3.5, then more`), 'vawe_render_draft {"film":"x","from":2,"to":3.5}, then more');
  assert.equal(t(`bin/vawe frame ${REL} --world all`), 'vawe_frame {"film":"x","mode":"world"}');
  assert.equal(t(`bin/vawe frame ${REL} --board lists what the taste docs say`), 'vawe_frame {"film":"x","mode":"board"} lists what the taste docs say');
  assert.equal(t(`bin/vawe frame ${REL} --board --all, or the board`), 'vawe_frame {"film":"x","mode":"board"}, or the board');
  assert.equal(t(`bin/vawe frame ${REL} --cuts and Read every cut`), 'vawe_frame {"film":"x","mode":"cuts"} and Read every cut');
  assert.equal(t(`bin/vawe frame ${REL} --directions)`), 'vawe_frame {"film":"x","mode":"directions"})');
  assert.equal(t(`bin/vawe frame ${REL} --moment 4.2 and Read it`), 'vawe_frame {"film":"x","mode":"moment","t":4.2} and Read it');
  assert.equal(t(`bin/vawe frame ${REL} --moment <the second you fixed> and Read it`), 'vawe_frame {"film":"x","mode":"moment","t":"<the second you fixed>"} and Read it');
  assert.equal(t(`bin/vawe frame ${REL} --at 3`), 'vawe_look {"film":"x","t":[3]}');
  assert.equal(t(`bin/vawe critique ${REL} --fresh`), 'vawe_critique {"film":"x"}');
  assert.equal(t(`VAWE_AGENT=critic bin/vawe critique ${REL}`), 'vawe_critique {"film":"x"}');
  assert.equal(t(`bin/vawe ship ${REL}, then bin/vawe wait ${REL} (one call`), 'vawe_ship {"film":"x"}, then vawe_wait {"film":"x"} (one call');
  assert.equal(t('bin/vawe wait films/other-film/page.html'), 'vawe_wait {"film":"other-film"}');
  assert.equal(t('bin/vawe new <other-name> writes the template'), 'vawe_new_film {"name":"<other-name>"} writes the template');
  assert.equal(t('bin/vawe new my-film --request "a sting" now'), 'vawe_new_film {"name":"my-film","request":"a sting"} now');
});

test('a <page> placeholder takes the film of the call; a bare vawe verb maps too', () => {
  assert.equal(t('Read the bin/vawe frame <page> --cuts grids, or prepare', 'launch'), 'Read the vawe_frame {"film":"launch","mode":"cuts"} grids, or prepare');
  assert.equal(t('vawe frame <page> --moment <s> shows the frames', 'launch'), 'vawe_frame {"film":"launch","mode":"moment","t":"<s>"} shows the frames');
});

test('the reference study maps to vawe_refs', () => {
  assert.equal(t('bin/vawe refs list, bin/vawe refs frames <id>, Read the frames'), 'vawe_refs {"action":"list"}, vawe_refs {"action":"frames","id":"<id>"}, Read the frames');
  assert.equal(t('bin/vawe refs frames, then Read the absolute paths'), 'vawe_refs {"action":"frames"}, then Read the absolute paths');
  assert.equal(t('bin/vawe refs frames u6iro1jHujs and more'), 'vawe_refs {"action":"frames","id":"u6iro1jHujs"} and more');
  assert.equal(t('bin/vawe frame <ref-id> --cuts on 2 reference films'), 'vawe_refs {"action":"cuts","id":"<ref-id>"} on 2 reference films');
  assert.equal(t('bin/vawe frame <id> --cuts shows how the film moves'), 'vawe_refs {"action":"cuts","id":"<id>"} shows how the film moves');
});

test('a film doc gets the tool that writes it, once; a doc the agent only reads is left alone', () => {
  assert.equal(t('write films/x/DESIGN.md and films/x/kit/ (format: y)'), 'write films/x/DESIGN.md (vawe_write_doc {"film":"x","file":"DESIGN.md"}) and films/x/kit/ (vawe_write_doc {"film":"x","file":"kit/<path>"}) (format: y)');
  assert.equal(t('then fill "Taken from" in films/x/brief.md: 4 frames, in films/x/brief.md again'), 'then fill "Taken from" in films/x/brief.md (vawe_edit_doc {"film":"x","file":"brief.md"}): 4 frames, in films/x/brief.md again');
  assert.equal(t('create films/x/brief.md: the ask'), 'create films/x/brief.md (vawe_write_doc {"film":"x","file":"brief.md"}): the ask');
  assert.equal(t('Read films/x/brief.md first'), 'Read films/x/brief.md first');
  assert.equal(t(`build one static state per world in ${REL} from the kit`), `build one static state per world in ${REL} (vawe_write_page, then vawe_edit_page) from the kit`);
});

test('a command no tool does stays as written and is listed', () => {
  const cases = [
    ['bin/vawe see films/x/page.html', 'bin/vawe see films/x/page.html'],
    ['bin/vawe sound films/x/page.html --at 2', 'bin/vawe sound films/x/page.html --at 2'],
    ['bin/vawe footage log <film>', 'bin/vawe footage log <film>'],
    ['bin/vawe refs add <url> --no-measure', 'bin/vawe refs add <url> --no-measure'],
    ['bin/vawe dev films/x/page.html --animatic', 'bin/vawe dev films/x/page.html --animatic'],
    ['bin/vawe ship films/x/page.html --status', 'bin/vawe ship films/x/page.html --status'],
    ['bin/vawe frame films/x/page.html --world all --full', 'bin/vawe frame films/x/page.html --world all --full'],
    ['bin/vawe frame films/examples/colour-sting/page.html --world all', 'bin/vawe frame films/examples/colour-sting/page.html --world all'],
    ['bin/vawe frame films/x/page.html --vs ref.mp4 --at 2', 'bin/vawe frame films/x/page.html --vs ref.mp4 --at 2'],
  ];
  for (const [input, listed] of cases) {
    const r = translateNext(input);
    assert.equal(r.text, input);
    assert.deepEqual(r.unmapped, [listed]);
  }
});

test('text with no command, and a vawe footer, are unchanged', () => {
  assert.equal(t('vawe: dev ok in 3.0s'), 'vawe: dev ok in 3.0s');
  assert.equal(t('fix the page, then Read it'), 'fix the page, then Read it');
  assert.equal(nextAsTools(null), '');
});

test('every stage line the loop can print has no shell command left but the listed ones', () => {
  const lines = [
    SAY.study('x'), SAY.moves(), SAY.design('x'), SAY.skills('x', ['type']), SAY.states('x', REL), SAY.frames('x', REL), SAY.ideas('x', REL),
    SAY.board('x', REL), SAY.cut('x'), SAY.dev('x', REL), SAY.motion('x', REL), SAY.cutCheck('x', REL), SAY.motionRows('x'), SAY.critique('x', REL),
    SAY.plan(REL, REL), SAY.ship('x', REL), briefStep('x').next, SHOW_PLAN,
    `bring Length, Board and Spec in films/x/brief.md to the page, then bin/vawe frame ${REL} --board`,
    `check "Board" in films/x/brief.md (advice), then ${SAY.dev('x', REL)}`,
    `before anything else: bin/vawe critique ${REL} --fresh (its own session)`,
    `Read the stills at full size and fix the states; then bin/vawe frame ${REL} --world all for the sheet`,
    `bin/vawe frame ${REL} --moment <the second you fixed> and Read it; when every named second is fixed: ${SAY.critique('x', REL)}`,
    `Read the critique file above, fix its top five with bin/vawe dev ${REL} --from s --to s`,
    `next: bin/vawe critique ${REL} --fresh`,
    `fix the acceptance rows above on drafts (bin/vawe dev), then bin/vawe ship ${REL} again`,
  ];
  for (const line of lines) {
    const { text, unmapped } = translateNext(line, { film: 'x' });
    assert.deepEqual(unmapped, [], line);
    assert.doesNotMatch(text, /bin\/vawe (?:dev|frame|new|refs|wait|ship|critique)\b/, line);
  }
});

test('every verb a bin/vawe command in the stage logic names is mapped, or listed here as having no tool', () => {
  const NO_TOOL = new Set(['see', 'sound', 'footage', 'check']);
  const MAPPED = new Set(['frame', 'dev', 'new', 'refs', 'wait', 'ship', 'critique']);
  const files = ['harness/live/stage-say.mjs', 'harness/live/plan-status.mjs', 'harness/cli/verbs.mjs', 'harness/cli/frame.mjs', 'harness/cli/new.mjs', 'harness/lib/approval.mjs', 'harness/lib/ship-status.mjs', 'harness/lib/critique-gate.mjs'];
  const found = new Set();
  for (const f of files) for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/(?<![\w-])bin\/vawe ([a-z]+)(?=[ `'"]|$)/gm)) found.add(m[1]);
  for (const verb of found) {
    if (['and', 'the', 'for', 'names', 'owns', 'passes', 'process', 'turns'].includes(verb)) continue;
    assert.ok(MAPPED.has(verb) || NO_TOOL.has(verb), `bin/vawe ${verb} in the stage logic has neither a tool nor an entry in NO_TOOL`);
  }
});
