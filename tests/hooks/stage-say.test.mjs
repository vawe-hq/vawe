import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pageDigest, writeApproval, writePlanApproval } from '../../harness/lib/approval.mjs';
import { appendRun, readRuns } from '../../harness/lib/runlog.mjs';
import { afterToolSay, FILM_PAGE, isTestPage, SAY, tasteOnce, sessionOf, BRIEF_ASK, CRITIQUE_ASK, WAIT_WORK, nextStep,takenFromCount, movesTakenCount, boardFilled, missingRungs } from '../../harness/live/stage-say.mjs';

process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-home-'));

const IDEAS = '## Ideas\n\n| at | meaning | i1 | i2 | i3 | i4 | chosen | why |\n|---|---|---|---|---|---|---|---|\n| s1 | m | a: x, 0.1 | b: y, 0.2 | c: z, 0.3 | d: w, 0.4 | 1 | because |\n\n';

function film(html, brief = '## Look\n') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-stage-'));
  fs.mkdirSync(path.join(root, 'films', 'f'), { recursive: true });
  fs.mkdirSync(path.join(root, 'out'));
  const page = path.join(root, 'films', 'f', 'page.html');
  fs.writeFileSync(page, html);
  if (brief) fs.writeFileSync(path.join(root, 'films', 'f', 'brief.md'), brief);
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(page, old, old);
  return { root, page };
}

test('a filled board that fails a check is named before the first draft, as advice', () => {
  const { root, page } = film('<meta name="spectacle" content="3"><p>x</p>');
  const filled = '## Board\n\n| beat | in s | hold s | cut out s (length) |\n|---|---|---|---|\n| s1 | 0 | 1 | 0.6 |\n| s2 | 1 | 1 | 0.6 |\n\nSpectacle: the big moment at 7 s.\n\n| cut | move |\n|---|---|\n| s1 to s2 | whip |\n\n| at s | voice | gain dB | for |\n|---|---|---|---|\n| 0 | bed, loop | -20 | all |\n';
  fs.writeFileSync(path.join(root, 'films', 'f', 'brief.md'), IDEAS + filled);
  const s = nextStep(page, root);
  assert.match(s.why, /all 2 cuts last 0\.6 s/);
  assert.match(s.why, /Spectacle is at 7 s but/);
  assert.match(s.next, /bin\/vawe dev films\/f\/page\.html/);
});

test('a page with worlds and no frames sheet or draft names bin/vawe frame --world all', () => {
  const { root, page } = film('<section data-world="s1"></section>');
  const s = nextStep(page, root);
  assert.equal(s.next, 'bin/vawe frame films/f/page.html --world all');
  assert.match(s.why, /frames come before the motion/);
});

test('an empty Taken from table says so before any design file; four named frames move on to DESIGN.md, then the frames', () => {
  const { root, page } = film('<section data-world="s1"></section>');
  const brief = path.join(root, 'films', 'f', 'brief.md');
  fs.writeFileSync(brief, '## Taken from\n\n| frame (exact path) | what you take |\n|---|---|\n| [path/to/frame.png] | [ground] |\n\n## Look\n');
  assert.match(nextStep(page, root).why, /Taken from not filled/);
  assert.equal(takenFromCount(fs.readFileSync(brief, 'utf8')), 0);
  const rows = [1, 2, 3, 4].map((n) => `| ~/.vawe/refs/frames/a/s${n}.png | ground |`).join('\n');
  fs.writeFileSync(brief, `## Taken from\n\n| frame | take |\n|---|---|\n${rows}\n\n## Look\n`);
  assert.match(nextStep(page, root).next, /DESIGN\.md/);
  const design = path.join(root, 'films', 'f', 'DESIGN.md');
  fs.writeFileSync(design, '# d');
  assert.match(nextStep(page, root).why, /no Skill line for builder, type, colour, depth, frame/);
  fs.writeFileSync(design, '# d\n\nSkill builder: leonxlnx/soft-skill: card and row styles\nSkill colour: pbakaus/colorize: one accent\nSkipped type: one face already set\n');
  assert.match(nextStep(page, root).why, /no Skill line for depth, frame/);
  fs.writeFileSync(design, '# d\n\nSkill builder: a: x\nSkill type: b: x\nSkill colour: c: x\nSkipped depth: flat film\nSkill frame: vawe rules: one line, three things\n');
  assert.match(nextStep(page, root).next, /^build one static state per world in films\/f\/page\.html from the kit/);
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(page, later, later);
  assert.equal(nextStep(page, root).next, 'bin/vawe frame films/f/page.html --world all');
});

test('a Skipped line needs a reason, and a Skill line needs a slug and a decision', () => {
  assert.deepEqual(missingRungs('Skipped type:\nSkill depth: slug\n'), ['builder', 'type', 'colour', 'depth', 'frame']);
  assert.deepEqual(missingRungs('Skill color: pbakaus/colorize: one accent\n'), ['builder', 'type', 'depth', 'frame']);
});

test('a brief with no Taken from section (an older film) is not nagged', () => {
  assert.equal(takenFromCount('## Look\n'), null);
});

test('a frames sheet newer than the page moves the next step on to the draft', () => {
  const { root, page } = film('<section data-world="s1"></section>', IDEAS);
  fs.writeFileSync(path.join(root, 'out', 'f-frames.png'), '');
  assert.equal(nextStep(page, root).next, 'bin/vawe dev films/f/page.html');
});

test('a page without worlds, or with a draft already, keeps the draft step', () => {
  const plain = film('<p>x</p>', IDEAS);
  assert.equal(nextStep(plain.page, plain.root).next, 'bin/vawe dev films/f/page.html');
  const { root, page } = film('<section data-world="s1"></section>', IDEAS);
  fs.writeFileSync(path.join(root, 'out', 'f-draft.mp4'), '');
  fs.utimesSync(path.join(root, 'out', 'f-draft.mp4'), new Date(Date.now() - 120000), new Date(Date.now() - 120000));
  assert.equal(nextStep(page, root).next, 'bin/vawe dev films/f/page.html');
});

test('a film with no brief.md is told what to create, not to fill a brief it lacks', () => {
  const { root, page } = film('<section data-world="s1"></section>', '');
  const s = nextStep(page, root);
  assert.match(s.next, /^create films\/f\/brief\.md/);
  assert.match(s.why, /has no brief\.md/);
});

const FRAMES = [1, 2, 3, 4].map((n) => `| ~/.vawe/refs/frames/a/s${n}.png | ground |`).join('\n');
const MOVES = (rows) => `| move taken | ref id | cut s |\n|---|---|---|\n${rows}\n`;

test('three named moves are needed before the design files; a placeholder row does not count', () => {
  const brief = (rows) => `## Taken from\n\n| frame | take |\n|---|---|\n${FRAMES}\n\n${MOVES(rows)}\n## Look\n`;
  const { root, page } = film('<section data-world="s1"></section>', brief('| [move name] | [ref id] | [s] |'));
  assert.equal(movesTakenCount(brief('| [move name] | [ref id] | [s] |')), 0);
  assert.match(nextStep(page, root).next, /bin\/vawe frame <ref-id> --cuts/);
  const three = '| push | abc | 2.4 |\n| whip | abc | 5 |\n| match cut | def | 8 |';
  assert.equal(movesTakenCount(brief(three)), 3);
  fs.writeFileSync(path.join(root, 'films', 'f', 'brief.md'), brief(three));
  assert.match(nextStep(page, root).next, /DESIGN\.md/);
  assert.equal(movesTakenCount('## Taken from\n\nold\n'), null);
});

test('after the frames, an unfilled Board is the next step; a filled one moves on to the draft', () => {
  const placeholder = `${IDEAS}## Board\n\n| beat | in s |\n|---|---|\n| [s1] | [0] |\n\n## Look\n`;
  const { root, page } = film('<section data-world="s1"></section>', placeholder);
  fs.writeFileSync(path.join(root, 'out', 'f-frames.png'), '');
  assert.equal(boardFilled(placeholder), false);
  assert.match(nextStep(page, root).next, /fill "Board"/);
  fs.writeFileSync(path.join(root, 'films', 'f', 'brief.md'), IDEAS + '## Board\n\n| beat | in s | hold s | cut out s (length) |\n|---|---|---|---|\n| s1 | 0 | 1 | 0.3 |\n| s2 | 1 | 1 | 1.2 |\n\nSpectacle: at 7.\n\n| cut | move | handoff (family: object) |\n|---|---|---|\n| s1 to s2 | whip | invisible cut: the blur peak |\n\n| at s | voice | gain dB | for |\n|---|---|---|---|\n| 0 | bed, loop | -20 | all |\n');
  const plan = nextStep(page, root);
  assert.equal(plan.stage, 'plan');
  assert.equal(plan.next, 'show the plan to the person: the directions board (bin/vawe frame films/f/page.html --directions) and the Board, then go on with bin/vawe dev films/f/page.html and end your message with one line, "If you like it, type /vawe-approve"');
  writePlanApproval(page, { root });
  assert.equal(nextStep(page, root).next, 'bin/vawe dev films/f/page.html');
  fs.appendFileSync(path.join(root, 'films', 'f', 'brief.md'), '| s3 | 2 | 1 | 0.3 |\n');
  assert.equal(nextStep(page, root).stage, 'plan');
  assert.equal(boardFilled('## Look\n'), null);
});

test('a fresh draft names strip --cuts before critique; once the strips exist it names critique', () => {
  const { root, page } = film('<section data-world="s1"></section>');
  const draft = path.join(root, 'out', 'f-draft.mp4');
  fs.writeFileSync(draft, '');
  const later = new Date(Date.now() - 1000);
  fs.utimesSync(draft, later, later);
  const s = nextStep(page, root);
  assert.match(s.next, /^bin\/vawe frame films\/f\/page\.html --cuts and Read every cut/);
  assert.match(s.why, /overshoot-share, live-hold and seam-variety/);
  fs.mkdirSync(path.join(root, 'out', 'strip', 'f'), { recursive: true });
  assert.equal(nextStep(page, root).next, 'bin/vawe critique films/f/page.html --fresh');
});

test('a stripped draft with an empty Motion pass names the rows to write; a filled one names critique', () => {
  const empty = '## Motion pass\n\n| cut | what read flat | what I fixed |\n|---|---|---|\n| [s1 to s2] | [x] | [y] |\n';
  const { root, page } = film('<section data-world="s1"></section>', empty);
  fs.writeFileSync(path.join(root, 'out', 'f-draft.mp4'), '');
  const later = new Date(Date.now() - 1000);
  fs.utimesSync(path.join(root, 'out', 'f-draft.mp4'), later, later);
  fs.mkdirSync(path.join(root, 'out', 'strip', 'f'), { recursive: true });
  assert.match(nextStep(page, root).next, /write one row per cut in "Motion pass"/);
  fs.writeFileSync(path.join(root, 'films', 'f', 'brief.md'), empty.replace('[s1 to s2] | [x] | [y]', 's1 to s2 | flat | pushed'));
  assert.equal(nextStep(page, root).next, 'bin/vawe critique films/f/page.html --fresh');
});

test('the motion step names onion and velocity for the spectacle', () => {
  const { root, page } = film('<section data-world="s1"></section>');
  fs.writeFileSync(path.join(root, 'out', 'f-draft.mp4'), '');
  const later = new Date(Date.now() - 1000);
  fs.utimesSync(path.join(root, 'out', 'f-draft.mp4'), later, later);
  assert.match(nextStep(page, root).next, /frame films\/f\/page\.html --cuts.*onion.*velocity/);
});

test('the motion step names the doc and each principle to check; every stage line carries a designer question', () => {
  const line = SAY.motion('f', 'films/f/page.html');
  assert.match(line, /taste\/craft\/motion-craft\.md.*core\/motion\/README\.md.*anticipation.*follow-through.*overlap.*spacing.*arcs.*secondary action.*exits faster.*holds alive.*camera still/);
  for (const text of [BRIEF_ASK, SAY.study('f'), SAY.moves(), SAY.design('f'), SAY.states('f', 'p'), SAY.board('f'), CRITIQUE_ASK]) assert.match(text, /ask: /);
});

test('the ship step names the work for the wait', () => {
  assert.match(WAIT_WORK, /Board and Motion pass rows.*frame <page> --cuts.*critique notes/);
  assert.match(SAY.ship('f', 'films/f/page.html'), /bin\/vawe wait films\/f\/page\.html \(one call waits up to 100 seconds, then says STILL RUNNING: call it again; run it alone, not in parallel\); while it renders, fill/);
});

test('after a draft the next step follows what is done: strips under any out/strip/<name>* folder, Motion pass rows, critique, then ship', () => {
  const { root, page } = film('<section data-world="s1"></section>');
  const out = (f) => path.join(root, 'out', f);
  const now = Date.now();
  const draft = out('f-draft.mp4');
  fs.writeFileSync(draft, '');
  fs.utimesSync(draft, new Date(now - 30000), new Date(now - 30000));
  assert.equal(nextStep(page, root).stage, 'motion');
  fs.mkdirSync(out('strip/f-cut-3.1'), { recursive: true });
  const brief = path.join(root, 'films', 'f', 'brief.md');
  fs.writeFileSync(brief, '## Board\n\nplan\n\n## Motion pass\n\n| cut | what read flat | fixed |\n|---|---|---|\n| [cut] | [x] | [y] |\n');
  assert.equal(nextStep(page, root).next, SAY.motionRows('f'));
  fs.writeFileSync(brief, '## Board\n\nplan\n\n## Motion pass\n\n| cut | what read flat | fixed |\n|---|---|---|\n| s1 | too slow | shortened |\n');
  assert.equal(nextStep(page, root).stage, 'critique');
  fs.writeFileSync(out('f.runs.jsonl'), `${JSON.stringify({ cmd: 'verb', verb: 'critique', exitCode: 0, pageHash: pageDigest(page), at: new Date(now).toISOString(), start: new Date(now).toISOString() })}\n`);
  const asked = nextStep(page, root);
  assert.equal(asked.stage, 'approve');
  assert.match(asked.next, /^waiting for the person's OK on the plan of f: /);
  writePlanApproval(page, { root });
  const draftAsk = nextStep(page, root);
  assert.equal(draftAsk.stage, 'approve');
  assert.match(draftAsk.next, /^waiting for the person's OK on the draft of f: show the person the draft \(bin\/vawe frame <draft>\), then end your message with one line, \"If you like it, type \/vawe-approve\", and stop$/);
  assert.doesNotMatch(draftAsk.next, /run bin\/vawe(-dev)? approve/);
  writeApproval(page, { root });
  const s = nextStep(page, root);
  assert.equal(s.stage, 'ship');
  assert.equal(s.next, SAY.ship('f', 'films/f/page.html'));
});

test('an empty Ideas ledger is named before the Board; a filled one moves on', () => {
  const { root, page } = film('<meta name="spectacle" content="3"><p>x</p>');
  const brief = path.join(root, 'films', 'f', 'brief.md');
  const head = '## Ideas\n\n| at | meaning | i1 | i2 | i3 | i4 | chosen | why |\n|---|---|---|---|---|---|---|---|\n';
  fs.writeFileSync(brief, `${head}| [s1] | [m] | [a] | [b] | [c] | [d] | [n] | [because] |\n\n## Board\n\n| beat | in s |\n|---|---|\n| [s1] | [0] |\n`);
  const s = nextStep(page, root);
  assert.equal(s.stage, 'ideas');
  assert.match(s.next, /guides\/IDEATE\.md/);
  fs.writeFileSync(brief, `${head}| s1 | m | a: x, 0.1 | b: y, 0.2 | c: z, 0.3 | d: w, 0.4 | 1 | because |\n\n## Board\n\n| beat | in s |\n|---|---|\n| [s1] | [0] |\n`);
  assert.equal(nextStep(page, root).stage, 'board');
});

test('a brief with no Ideas section names guides/IDEATE.md and the storyboard before the board', () => {
  const { root, page } = film('<meta name="spectacle" content="3"><p>x</p>', '## Look\n');
  const s = nextStep(page, root);
  assert.equal(s.stage, 'ideas');
  assert.match(s.next, /guides\/IDEATE\.md.*typicality number.*bin\/vawe frame films\/f\/page\.html --board/);
});

test('a brief length that differs from the page duration is named before the ideas', () => {
  const { root, page } = film('<meta name="duration" content="8.15"><p>x</p>', '- Length: 22.8 s\n\n## Look\n');
  const s = nextStep(page, root);
  assert.equal(s.stage, 'board');
  assert.match(s.why, /brief says 22\.8 s and the page is 8\.15 s/);
  assert.match(s.next, /bin\/vawe frame films\/f\/page\.html --board/);
});

test('a test page under a film folder is not a film', () => {
  assert.ok(FILM_PAGE.test('films/riso-brand/page.html'));
  assert.ok(FILM_PAGE.test('films/examples/colour-sting/page.html'));
  assert.ok(!FILM_PAGE.test('films/riso-brand/variations/bleed/page.html'));
  assert.ok(!FILM_PAGE.test('films/riso-brand/kit/page.html'));
});

test('a long-form chapter page is a film page that reads its parent film', () => {
  assert.ok(FILM_PAGE.test('films/long/ch/01-intro.html'));
  const { root } = film('<p>x</p>');
  const ch = path.join(root, 'films', 'f', 'ch');
  fs.mkdirSync(ch, { recursive: true });
  const page = path.join(ch, '01-intro.html');
  fs.writeFileSync(page, '<p>x</p>');
  assert.ok(!isTestPage(page, root));
  const s = nextStep(page, root);
  assert.equal(s.name, 'f');
  assert.notEqual(s.stage, 'test');
});

test('a test page inside a film folder gets no brief advice from nextStep', () => {
  const { root } = film('<p>x</p>');
  const dir = path.join(root, 'films', 'f', 'directions', 'a');
  fs.mkdirSync(dir, { recursive: true });
  const page = path.join(dir, 'page.html');
  fs.writeFileSync(page, '<p>x</p>');
  const s = nextStep(page, root);
  assert.equal(s.stage, 'test');
  assert.doesNotMatch(`${s.next} ${s.why}`, /brief\.md: the ask/);
  assert.ok(isTestPage(page, root));
  assert.ok(!isTestPage(path.join(root, 'films', 'f', 'page.html'), root));
  assert.ok(!isTestPage('/elsewhere/page.html', root));
});

function drafted(brief) {
  const { root, page } = film('<section data-world="s1"></section>', brief);
  const draft = path.join(root, 'out', 'f-draft.mp4');
  fs.writeFileSync(draft, '');
  const at = new Date(Date.now() - 30000);
  fs.utimesSync(draft, at, at);
  return { root, page, drafted: at.getTime() };
}

test('a draft made with an empty Ideas or Board sends the agent back to that stage, as advice', () => {
  const emptyBoard = '## Board\n\n| beat | in s |\n|---|---|\n| [s1] | [0] |\n';
  const { root, page } = drafted(`${IDEAS.replace('| s1 | m | a: x, 0.1 | b: y, 0.2 | c: z, 0.3 | d: w, 0.4 | 1 | because |', '| [s1] | [m] | [a] | [b] | [c] | [d] | [n] | [because] |')}${emptyBoard}`);
  const s = nextStep(page, root);
  assert.equal(s.stage, 'ideas');
  assert.match(s.why, /draft was made without a plan/);
  fs.writeFileSync(path.join(root, 'films', 'f', 'brief.md'), IDEAS + emptyBoard);
  assert.equal(nextStep(page, root).stage, 'board');
  fs.writeFileSync(path.join(root, 'films', 'f', 'brief.md'), `${IDEAS}## Board\n\n| beat | in s |\n|---|---|\n| s1 | 0 |\n`);
  assert.equal(nextStep(page, root).stage, 'motion');
});

test('strips rendered but not Read: the motion stage names the first unread strip; Read strips move on', () => {
  const { root, page, drafted: at } = drafted('## Look\n');
  const strips = ['a', 'b'].map((n) => path.join(root, 'out', 'strip', 'f', `${n}.png`));
  fs.mkdirSync(path.join(root, 'out', 'strip', 'f'), { recursive: true });
  const call = { cmd: 'verb', verb: 'strip', exitCode: 0, start: new Date(at + 1000).toISOString(), images: strips };
  fs.writeFileSync(path.join(root, 'out', 'f.runs.jsonl'), `${JSON.stringify(call)}\n${JSON.stringify({ cmd: 'read', image: strips[0], at: new Date(at + 2000).toISOString() })}\n`);
  const s = nextStep(page, root);
  assert.equal(s.stage, 'motion');
  assert.equal(s.next, `Read the 2 cut strips of this draft (1 of 2 read): ${strips[1]}`);
  fs.appendFileSync(path.join(root, 'out', 'f.runs.jsonl'), `${JSON.stringify({ cmd: 'read', image: strips[1], at: new Date(at + 3000).toISOString() })}\n`);
  assert.equal(nextStep(page, root).stage, 'critique');
});

test('with no read event anywhere the hook is missing: the agent is not nagged to Read', () => {
  const { root, page, drafted: at } = drafted('## Look\n');
  fs.mkdirSync(path.join(root, 'out', 'strip', 'f'), { recursive: true });
  const call = { cmd: 'verb', verb: 'strip', exitCode: 0, start: new Date(at + 1000).toISOString(), images: [path.join(root, 'out', 'strip', 'f', 'a.png')] };
  fs.writeFileSync(path.join(root, 'out', 'f.runs.jsonl'), `${JSON.stringify(call)}\n`);
  assert.equal(nextStep(page, root).stage, 'critique');
});

test('the taste lines of a stage print the first time only, and a stage with no step prints none', () => {
  const { root } = film('<p>x</p>');
  const first = tasteOnce('motion', 'f', root);
  assert.match(first[0], /^taste, /);
  assert.deepEqual(tasteOnce('motion', 'f', root), []);
  assert.ok(tasteOnce('states', 'f', root).length > 0);
  assert.deepEqual(tasteOnce('critique', 'f', root), []);
  assert.equal(readRuns('f', root).filter((r) => r.cmd === 'taste-shown').length, 2);
});

test('the taste lines print once per session: a new session sees them again, the same one does not', () => {
  const { root } = film('<p>x</p>');
  assert.ok(tasteOnce('motion', 'f', root, 's1').length > 0);
  assert.deepEqual(tasteOnce('motion', 'f', root, 's1'), []);
  assert.ok(tasteOnce('motion', 'f', root, 's2').length > 0);
  assert.equal(sessionOf('{"session_id":"abc","prompt":"x"}'), 'abc');
  assert.equal(sessionOf(''), null);
  assert.equal(sessionOf('not json'), null);
});

test('no plan OK never holds the draft: the plan stage names dev, and once a draft exists the film moves on', () => {
  const { root, page } = film('<section data-world="s1"></section>', IDEAS + '## Board\n\n| beat | in s | hold s | cut out s (length) |\n|---|---|---|---|\n| s1 | 0 | 1 | 0.3 |\n| s2 | 1 | 1 | 1.2 |\n\nSpectacle: at 7.\n\n| cut | move | handoff (family: object) |\n|---|---|---|\n| s1 to s2 | whip | invisible cut: the blur peak |\n\n| at s | voice | gain dB | for |\n|---|---|---|---|\n| 0 | bed, loop | -20 | all |\n');
  fs.writeFileSync(path.join(root, 'out', 'f-frames.png'), '');
  assert.equal(nextStep(page, root).stage, 'plan');
  assert.match(nextStep(page, root).next, /then go on with bin\/vawe dev films\/f\/page\.html and end your message with one line, "If you like it, type \/vawe-approve"$/);
  const draft = path.join(root, 'out', 'f-draft.mp4');
  fs.writeFileSync(draft, '');
  const later = new Date(Date.now() - 1000);
  fs.utimesSync(draft, later, later);
  assert.equal(nextStep(page, root).stage, 'motion');
});

test('after a vawe verb a subagent hears the stage line once per change; a parent session that saw it does not silence it', () => {
  const { root, page } = film('<section data-world="s1"></section>');
  const call = (agent, command = 'bin/vawe refs list') => afterToolSay({ session_id: 's1', agent_id: agent, tool_input: { command } }, page, root);
  const first = call('a1');
  assert.match(first, /^vawe: f: .*\n  next: bin\/vawe frame films\/f\/page\.html --world all/);
  assert.equal(call('a1'), null);
  assert.match(call('a2'), /next: bin\/vawe frame/);
  assert.equal(call('a3', 'ls films'), null);
  assert.equal(call('a3', 'bin/vawe dev --help'), null);
  assert.equal(call('a3', `echo '{"command":"bin/vawe frame x"}' | node hook.mjs`), null);
  assert.equal(call('a3', 'grep -n "vawe dev" AGENTS.md'), null);
  assert.match(call('a3', 'export VAWE_AGENT=f && VAWE_MODEL=m bin/vawe frame films/f/page.html'), /next:/);
  assert.equal(afterToolSay({ session_id: 's1', agent_id: 'a4', tool_input: { command: 'bin/vawe refs list' } }, null, root), null);
});
