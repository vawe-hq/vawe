import test from 'node:test';
import assert from 'node:assert/strict';
import { declaredSilent, declaredNoText, parseBoard, boardChecks, boardFilled, spectacleOf, motionFilled, movesUnused, boardVsPage, shipWarnings, lockedSpectacle } from '../../harness/lib/board.mjs';

const board = ({ cuts = ['0.6', '0.3', '1.1'], spectacle = 'at 7.2', moves = ['whip', 'push', 'overlap'], sound = ['tick', 'tap'] } = {}) => `## Look

## Board

Rhythm: cut lengths vary.

| beat | in s | hold s | cut out s (length) |
|---|---|---|---|
${cuts.map((c, i) => `| s${i + 1} | ${i} | 1.5 | ${c} |`).join('\n')}

Spectacle: the one big moment ${spectacle} (also \`<meta name="spectacle">\`). Quiet before it.

| cut | move (prompts/moves) | what carries the eye | what leaves first | overlap s |
|---|---|---|---|---|
${moves.map((m, i) => `| s${i + 1} to s${i + 2} | ${m} | logo | card | 0.2 |`).join('\n')}

Sound is part of every film.

| at s | voice | gain dB | for |
|---|---|---|---|
${sound.map((v, i) => `| ${i} | ${v} | -20 | cut |`).join('\n')}

## Motion pass
`;

test('the parser reads cut lengths, moves, sound rows and the spectacle second', () => {
  const b = parseBoard(board());
  assert.deepEqual(b.cuts, [0.6, 0.3, 1.1]);
  assert.deepEqual(b.moves, ['whip', 'push', 'overlap']);
  assert.equal(b.sound.length, 2);
  assert.equal(b.spectacle, 7.2);
});

test('the parser gives null for a brief with no Board, and ignores placeholder rows', () => {
  assert.equal(parseBoard('## Look\n'), null);
  assert.equal(parseBoard(null), null);
  const template = '## Board\n\n| beat | in s | hold s | cut out s (length) |\n|---|---|---|---|\n| [s1] | [0] | [s] | [s] |\n';
  assert.deepEqual(parseBoard(template).cuts, []);
  assert.equal(boardFilled(template), false);
});

test('a good board earns no advice', () => {
  assert.deepEqual(boardChecks(board(), 7.2), []);
});

test('a board with a placeholder row, or no board, is left to stage-say', () => {
  assert.deepEqual(boardChecks('## Board\n\n| beat | in s | hold s | cut out s (length) |\n|---|---|---|---|\n| [s1] | [0] | [s] | [s] |\n', 7), []);
  assert.deepEqual(boardChecks('## Look\n', 7), []);
  assert.deepEqual(boardChecks(null, 7), []);
});

test('cuts that are all equal are named', () => {
  const lines = boardChecks(board({ cuts: ['0.6', '0.6', '0.6'] }), 7.2);
  assert.ok(lines.some((l) => /all 3 cuts last 0\.6 s/.test(l)));
});

test('a board with no quick cut but one that breathes longer is clean', () => {
  assert.deepEqual(boardChecks(board({ cuts: ['0.5', '0.7', '1.1'] }), 7.2), []);
});

test('no cut over 0.9 s is named', () => {
  const lines = boardChecks(board({ cuts: ['0.3', '0.7', '0.9'] }), 7.2);
  assert.deepEqual(lines.map((l) => l.replace(/;.*/, '')), ['board: no cut over 0.9 s']);
});

test('a missing spectacle second is named', () => {
  const lines = boardChecks(board({ spectacle: 'near the end' }), 7.2);
  assert.match(lines[0], /Spectacle line names no second/);
});

test('a spectacle more than 0.25 s from the page meta is named; 0.25 s is not', () => {
  assert.match(boardChecks(board(), 7.6)[0], /Spectacle is at 7\.2 s but <meta name="spectacle"> says 7\.6 s/);
  assert.deepEqual(boardChecks(board(), 7.45), []);
  assert.deepEqual(boardChecks(board(), null), []);
});

test('no sound rows is named; effects without a bed are fine', () => {
  assert.match(boardChecks(board({ sound: [] }), 7.2)[0], /no sound rows/);
  assert.deepEqual(boardChecks(board({ sound: ['tick', 'whoosh'] }), 7.2), []);
});

test('a move that says fade or is empty is named by its cut', () => {
  const lines = boardChecks(board({ moves: ['whip', 'crossfade or fade', ''] }), 7.2);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /cut 2 names "crossfade or fade"/);
  assert.match(lines[1], /cut 3 names no move/);
});

test('the spectacle second reads from the page meta', () => {
  assert.equal(spectacleOf('<meta name="spectacle" content="7.2">'), 7.2);
  assert.equal(spectacleOf('<meta name="spectacle" content="">'), null);
  assert.equal(spectacleOf('<p>x</p>'), null);
});

const taken = (moves) => `## Taken from\n\n| move taken | ref id | cut s |\n|---|---|---|\n${moves.map((m) => `| ${m} | a | 1 |`).join('\n')}\n\n`;

test('motionFilled: a placeholder row or the untouched old text is unfilled, a written row or prose is filled, no section is null', () => {
  assert.equal(motionFilled('## Look\n'), null);
  assert.equal(motionFilled('## Motion pass\n\n| cut | read | fixed |\n|---|---|---|\n| [s1 to s2] | [x] | [y] |\n'), false);
  assert.equal(motionFilled('## Motion pass\n\nThe motion is done when `bin/vawe dev` shows overshoot-share.\n'), false);
  assert.equal(motionFilled('## Motion pass\n\n| cut | read | fixed |\n|---|---|---|\n| s1 to s2 | flat | pushed |\n'), true);
  assert.equal(motionFilled('## Motion pass\n\nI read every strip and pushed the cut at 2.\n'), true);
});

test('movesUnused names a Taken from move that no Board row uses', () => {
  const b = board();
  assert.deepEqual(movesUnused(taken(['whip', 'match-cut']) + b), ['match-cut']);
  assert.deepEqual(movesUnused(taken(['whip', 'push']) + b), []);
  assert.deepEqual(movesUnused(taken(['x']) + '## Board\n\n| beat | in s |\n|---|---|\n| [s1] | [0] |\n'), []);
});

test('shipWarnings explains how an unused Taken from move is matched and lists the Board moves', () => {
  const [line] = shipWarnings(taken(['match-cut']) + board()).filter((l) => l.startsWith('Taken from'));
  assert.match(line, /"match-cut"/);
  assert.match(line, /Board move cell contains that move name/);
  assert.match(line, /Board moves seen: "whip/);
});

test('boardVsPage compares the beat starts of the Board with the page worlds', () => {
  const b = board();
  assert.deepEqual(boardVsPage(b, [0, 1, 2]), []);
  assert.deepEqual(boardVsPage(b, [0, 1]), ['the Board lists 3 beats and the page has 2 worlds']);
  assert.deepEqual(boardVsPage(b, [0, 1, 4]), ['beat 3 starts at 2 s in the Board and at 4 s in the page']);
});

test('shipWarnings: unfilled Board and Motion pass, nothing for a brief without them', () => {
  assert.deepEqual(shipWarnings('## Look\n'), []);
  const w = shipWarnings('## Board\n\n| beat | in s |\n|---|---|\n| [s1] | [0] |\n\n## Motion pass\n\n| cut | a |\n|---|---|\n| [x] | [y] |\n');
  assert.equal(w.length, 2);
  assert.match(w[0], /Board is not filled/);
  assert.match(w[1], /Motion pass is not filled/);
});

test('the spectacle second the checks read is the Board\'s: a moved meta changes nothing', () => {
  assert.equal(lockedSpectacle(board(), 4.8), 7.2);
  assert.equal(lockedSpectacle(board(), null), 7.2);
  assert.equal(lockedSpectacle(null, 4.8), 4.8);
  assert.equal(lockedSpectacle('## Look\nno board', 4.8), 4.8);
  assert.match(boardChecks(board(), 4.8).join('\n'), /the spectacle checks read 7\.2 s, the Board's/);
});

test('the spectacle second is read in the forms agents write', () => {
  const read = (spectacle) => parseBoard(board({ spectacle })).spectacle;
  assert.equal(read('7.2'), 7.2);
  assert.equal(read('7.2 s'), 7.2);
  assert.equal(read('7.2s'), 7.2);
  assert.equal(read('at 7.2 s'), 7.2);
  assert.equal(read('at 7.2s'), 7.2);
  assert.equal(read('6.55 to 7.85 s'), 7.2);
  assert.equal(read('at 6.55 to 7.85 s'), 7.2);
  assert.equal(read('[second]'), null);
  assert.equal(read('near the end'), null);
});

test('declaredSilent: a Board sound row of none, or a "sound none" line, declares a silent film; a placeholder row does not', () => {
  const board = (row) => `## Board\n\n| at s | voice | gain dB | for |\n|---|---|---|---|\n${row}\n`;
  assert.equal(declaredSilent(board('| 0 | none | | the film is silent |')), true);
  assert.equal(declaredSilent(`## Facts\n\n- Board: no cuts; sound none.\n`), true);
  assert.equal(declaredSilent(board('| [s] | [voice] | | [a cut] |')), false);
  assert.equal(declaredSilent(board('| 2 | tick | | the cut |')), false);
  assert.equal(declaredSilent(null), false);
});

test('declaredNoText: a request or Facts bullet saying "no text" declares a text-free film; a table cell or prose does not', () => {
  assert.equal(declaredNoText('## Inputs\n\n- request: a 12 s loop of moths, no text\n'), true);
  assert.equal(declaredNoText('- Look: red powder. No text, silent.\n'), true);
  assert.equal(declaredNoText('| s1 | no text yet |\n'), false);
  assert.equal(declaredNoText('Sentence with no text in it.\n'), false);
  assert.equal(declaredNoText(null), false);
});
