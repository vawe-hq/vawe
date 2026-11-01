import test from 'node:test';
import assert from 'node:assert/strict';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { parseArgs, verbHelp, UsageError } from '../../harness/cli/parse.mjs';

const frame = VERBS.find((v) => v.name === 'frame');
const PAGE = 'films/examples/colour-sting/page.html';

const stepOf = (...argv) => {
  const { values, positional } = parseArgs(frame, [PAGE, ...argv]);
  frame.exists(values, positional);
  const [step] = frame.build(values, positional);
  return [step.script, ...step.args];
};
const refused = (...argv) => assert.throws(() => stepOf(...argv), UsageError);
const refusedWith = (re, ...argv) => assert.throws(() => stepOf(...argv), re);

test('frame: one --at number is a frame, a list or no --at is a sheet, --sheet forces the sheet', () => {
  assert.deepEqual(stepOf('--at', '4.2'), ['harness/media/still.mjs', PAGE, '--at', '4.2']);
  assert.deepEqual(stepOf('--at', '0.5,1.2,3', '--labels'), ['harness/media/sheet.mjs', PAGE, '--at', '0.5,1.2,3', '--labels']);
  assert.deepEqual(stepOf(), ['harness/media/sheet.mjs', PAGE]);
  assert.deepEqual(stepOf('--at', 'cuts'), ['harness/media/sheet.mjs', PAGE, '--at', 'cuts']);
  assert.deepEqual(stepOf('--at', '3', '--sheet'), ['harness/media/sheet.mjs', PAGE, '--at', '3']);
});

test('frame --world builds the frames step; all means every world', () => {
  assert.deepEqual(stepOf('--world', 'all'), ['harness/media/frames.mjs', PAGE]);
  assert.deepEqual(stepOf('--world', 's3,s5', '--full'), ['harness/media/frames.mjs', PAGE, '--full', '--world', 's3,s5']);
  assert.deepEqual(stepOf('--world', 'all', '--sharp'), ['harness/media/frames.mjs', PAGE, '--zoom']);
});

test('frame --cuts and --moment build the strip steps; --onion and --velocity modify --moment', () => {
  assert.deepEqual(stepOf('--cuts'), ['harness/media/see.mjs', PAGE, '--cuts', '--span', '1', '--fps', '8']);
  assert.deepEqual(stepOf('--moment', '8.4'), ['harness/media/see.mjs', PAGE, '--moment', '8.4', '--span', '1', '--fps', '8']);
  assert.deepEqual(stepOf('--moment', '8.4', '--onion', '--span', '0.6', '--n', '6'), ['harness/media/see.mjs', PAGE, '--onion', '8.4', '--span', '0.6', '--n', '6']);
  assert.deepEqual(stepOf('--moment', '2.75', '--velocity', '--sel', '.card'), ['harness/media/see.mjs', PAGE, '--velocity', '2.75', '--span', '1', '--sel', '.card']);
});

test('frame --box and --auto build the zoom step, --looks the looks step, --board and --directions the boards', () => {
  assert.deepEqual(stepOf('--at', '2.4', '--box', '800,400,240,135', '--scale', '8').slice(0, 7), ['harness/media/see/zoom.mjs', PAGE, '--at', '2.4', '--box', '800,400,240,135', '--scale']);
  assert.deepEqual(stepOf('--at', '3', '--auto')[4], '--auto');
  assert.deepEqual(stepOf('--looks', '--at', '4.5,9', '--only', 'crt'), ['harness/media/looks.mjs', PAGE, '--at', '4.5,9', '--only', 'crt']);
  assert.deepEqual(stepOf('--board', '--all'), ['harness/media/storyboard.mjs', PAGE, '--all']);
  assert.deepEqual(stepOf('--directions', '--out', 'd.html'), ['harness/media/directions-board.mjs', PAGE, '--out', 'd.html']);
});

test('frame: two modes are refused in one line that lists the modes', () => {
  refusedWith(/give one of --world, --cuts, --moment, --looks, --board, --directions, --box/, '--cuts', '--world', 'all');
  refusedWith(/give one of/, '--moment', '2', '--box', '1,2,3,4');
  refusedWith(/give one of/, '--board', '--directions');
});

test('frame: a flag outside its mode names the mode it needs', () => {
  refusedWith(/--span needs --moment or --cuts/, '--span', '1');
  refusedWith(/--labels needs --at s,s,s/, '--at', '4', '--labels');
  refusedWith(/--full does not go with --cuts: it needs --world/, '--cuts', '--full');
  refusedWith(/--scale needs --box or --auto/, '--at', '4', '--scale', '3');
  refusedWith(/--only needs --looks/, '--only', 'crt');
  refusedWith(/--n needs --onion/, '--moment', '2', '--n', '4');
  refusedWith(/--sel and --ids need --velocity/, '--moment', '2', '--sel', '.a');
  refusedWith(/--moment takes its own second/, '--moment', '2', '--at', '3');
  refusedWith(/--at-b needs --vs/, '--at', '2', '--box', '1,2,3,4', '--at-b', '1');
  refusedWith(/--n needs --onion/, '--cuts', '--n', '4');
  refusedWith(/--onion does not go with --cuts: it needs --moment/, '--cuts', '--onion');
  refusedWith(/--size needs --at <one second>/, '--size', '100x100');
});

test('frame --vs is the second film; --ref is the same flag and the two must agree', () => {
  refusedWith(/give --vs once/, '--vs', 'a.mp4', '--ref', 'b.mp4');
  refusedWith(/no such file for --vs/, '--at', '3', '--vs', 'no-such-ref.mp4');
});

test('frame --help stays short, groups its modes and names each mode once', () => {
  const help = verbHelp(frame);
  assert.ok(help.split(/\s+/).length <= 300, `${help.split(/\s+/).length} words`);
  for (const mode of ['--at 4.2', '--world', '--cuts', '--moment', '--box', '--looks', '--board', '--directions', '--vs']) assert.ok(help.includes(mode), mode);
});

test('see --plan reads a page as text, --json needs --plan', () => {
  const see = VERBS.find((v) => v.name === 'see');
  const [step] = see.build({ plan: true, json: true }, [PAGE]);
  assert.deepEqual([step.script, step.args], ['harness/media/timeline.mjs', [PAGE, '--json']]);
  assert.throws(() => see.build({ plan: true }, ['a.mp4']), /--plan reads a page/);
  assert.throws(() => see.build({ json: true }, [PAGE]), /--json needs --plan/);
});

test('frame: a missing page, mp4 or folder is refused before any script runs; a reference id or an https mp4 is not', () => {
  const run = (argv) => { const { values, positional } = parseArgs(frame, argv); frame.exists(values, positional); };
  assert.throws(() => run(['no-such.html', '--at', '1,2']), /no such page, mp4 or folder: no-such.html/);
  assert.throws(() => run(['no-such.html', '--at', '2']), /no such page or mp4/);
  assert.throws(() => run(['no-such.html', '--world', 'all']), /no such page: no-such.html/);
  assert.doesNotThrow(() => run(['refid123', '--cuts']));
  assert.doesNotThrow(() => run(['https://x.test/a.mp4', '--at', '2']));
});

test('frame: an error names the flags as typed, and --out is refused in --world mode, where no script takes it', () => {
  refusedWith(/--at does not go with --world: it needs/, '--world', 'all', '--at', '3');
  refusedWith(/--at does not go with --cuts/, '--cuts', '--at', '2');
  refusedWith(/--out does not go with --world/, '--world', 'all', '--out', 'x');
  assert.ok(stepOf('--cuts', '--out', 'x'));
  assert.doesNotMatch(verbHelp(frame), /all: --out path/);
  assert.match(verbHelp(frame), /all but --world: --out path/);
});

test('frame --ref is folded into --vs: the same compare step', () => {
  const ref = 'package.json';
  assert.deepEqual(stepOf('--ref', ref, '--at', '2,3'), stepOf('--vs', ref, '--at', '2,3'));
  assert.deepEqual(stepOf('--vs', ref, '--at', '2,3').slice(0, 2), ['harness/media/compare-frames.mjs', '--page']);
});

test('frame --help documents --sheet, the draft a moment needs and the --span defaults', () => {
  const help = verbHelp(frame);
  assert.match(help, /--at 3 --sheet/);
  assert.match(help, /a move \(a page needs a draft: run vawe dev first\)/);
  assert.match(help, /--span \(default 1 s\)[\s\S]*--span default 0\.3 s[\s\S]*--span default 1 s/);
  assert.doesNotMatch(help, /key state of each world and a sheet/);
});
