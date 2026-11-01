import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newFilm, newFilmLines, readDetails, questionsJson } from '../../harness/cli/new.mjs';
import { parseDirections, directionsLines } from '../../harness/lib/directions.mjs';
import { ACCEPTANCE, GUESS, DETAIL_KEYS, optionsFor } from '../../harness/lib/measured-brief.mjs';
import { briefLine } from '../../harness/lib/draft-check.mjs';
import { LOOKS } from '../../core/surfaces/lens.js';

const ROOT = path.resolve(import.meta.dirname, '../..');

function briefFor(template, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-brief-'));
  fs.mkdirSync(path.join(root, 'prompts'));
  fs.copyFileSync(path.join(ROOT, 'prompts', template), path.join(root, 'prompts', template));
  fs.mkdirSync(path.join(root, 'assets'));
  fs.symlinkSync(path.join(ROOT, 'assets/fonts'), path.join(root, 'assets/fonts'));
  const log = console.log;
  console.log = () => {};
  let made;
  try { made = newFilm('zz', { root, from: path.join(root, 'prompts', template), defaults: true, ...options }); } finally { console.log = log; }
  const text = fs.readFileSync(path.join(root, 'films/zz/brief.md'), 'utf8');
  fs.rmSync(root, { recursive: true, force: true });
  return { text, made };
}

const headings = (text) => [...text.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1]);

test('vawe new writes every section of the measured brief, in order', () => {
  const { text } = briefFor('brand-launch-from-url.md', { request: 'a launch film for acme', length: 20, title: 'Ship faster' });
  const order = ['Inputs', 'Task', 'Directions', 'Look', 'Spec', 'Shots', 'Words', 'Objects', 'Acceptance', 'Gates', 'Pitfalls', 'Deliver', 'Build', 'First draft'];
  const found = headings(text);
  const at = order.map((h) => found.indexOf(h));
  assert.ok(at.every((i) => i >= 0), `missing: ${order.filter((h) => !found.includes(h))}`);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
  assert.ok(!found.includes('Keep and swap'), 'a launch film has no reference');
});

test('the Spec and Acceptance tables have the fixed header rows', () => {
  const { text } = briefFor('beat-sheet.md');
  for (const row of [
    '| id | start s | end s | the viewer notices | move in | move out | camera | ground |',
    '| text | shot | appear s | settle s | cap % | x % | y % | weight | colour |',
    '| id | selector | shot | in s | settle s | out s |',
    '| metric | target |',
  ]) assert.ok(text.includes(`${row}\n`), row);
  for (const [metric, target] of ACCEPTANCE) assert.ok(text.includes(`| ${metric} | ${target} |`), metric);
  assert.equal(ACCEPTANCE.length, 15);
});

test('Shots has one row per starter world with its span; Words and Objects one guessed example each', () => {
  const { text } = briefFor('beat-sheet.md', { length: 10, title: 'Ship faster' });
  const spec = text.split('## Spec')[1].split('## Acceptance')[0];
  const rows = spec.split('\n').filter((l) => l.includes(GUESS));
  assert.equal(rows.length, 7);
  assert.match(rows[0], /^\| s1 \| 0 \| 2\.33 \| Ship faster \(guess: change me\) \|/);
  assert.match(rows[2], /^\| s3 \| 4\.\d+ \| 6\.1\d \| one fact \(guess: change me\) \|/);
  assert.match(rows[3], /^\| s4 \| 6\.1\d \| 8\.1\d \| no words: the ground carries it \(guess: change me\) \| ground bloom \|/);
  assert.match(rows[5], /^\| Ship faster \(guess: change me\) \| s1 \|/);
});

test('every field the request does not answer is a marked guess, and one line names them', () => {
  const { text, made } = briefFor('beat-sheet.md', { request: 'a five second sting', length: 5 });
  const look = text.split('## Look')[1].split('## ')[0];
  for (const key of ['ground', 'ink', 'accent', 'typeface', 'cap height', 'surface']) {
    assert.match(look, new RegExp(`^- ${key}: .+ \\(guess: change me\\)$`, 'm'));
  }
  assert.match(text, /^- what: a five second sting$/m);
  assert.match(text, /^- spectacle: 3 s \(guess: change me\)$/m);
  assert.deepEqual(made.guesses.slice(0, 4), ['for', 'message', 'spectacle', 'ground']);
  const line = newFilmLines('zz', made).find((l) => l.startsWith('guessed'));
  assert.match(line, /for, message, spectacle, ground, ink, accent, typeface, cap height, surface, shots, words, objects$/);
});

test('the three directions slots still parse, and the brief still counts as unanswered without a request', () => {
  const { text } = briefFor('brand-launch-from-url.md');
  const d = parseDirections(text);
  assert.deepEqual(d.slots.map((s) => s.id), ['A', 'B', 'C']);
  assert.match(directionsLines(text, 'films/zz')[0], /^directions: empty/);
  assert.match(briefLine(text), /template defaults/);
  assert.equal(briefLine(briefFor('brand-launch-from-url.md', { request: 'x' }).text), null);
});

test('a reference template adds Keep and swap between Look and Spec', () => {
  const { text, made } = briefFor('reference-rebuild.md');
  const found = headings(text);
  assert.ok(found.indexOf('Look') < found.indexOf('Keep and swap') && found.indexOf('Keep and swap') < found.indexOf('Spec'));
  assert.ok(made.guesses.includes('keep and swap'));
});

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-ask-'));
  fs.mkdirSync(path.join(root, 'prompts'));
  fs.copyFileSync(path.join(ROOT, 'prompts/beat-sheet.md'), path.join(root, 'prompts/beat-sheet.md'));
  fs.mkdirSync(path.join(root, 'assets'));
  fs.symlinkSync(path.join(ROOT, 'assets/fonts'), path.join(root, 'assets/fonts'));
  return root;
}

function runNew(root, options) {
  const log = console.log;
  console.log = () => {};
  try { return newFilm('zz', { root, from: path.join(root, 'prompts/beat-sheet.md'), ...options }); } finally { console.log = log; }
}

const briefOf = (root) => fs.readFileSync(path.join(root, 'films/zz/brief.md'), 'utf8');

const FULL = 'a launch film for Argus, a log search tool for on-call engineers. The message: find the bug in seconds. '
  + 'Show the dashboard and the result count. Style: dark mode, one red accent, a monospace font';

test('a thin request asks the unanswered details, in order, and writes nothing', () => {
  const root = sandbox();
  const made = runNew(root, { request: 'a launch film for Argus' });
  assert.deepEqual(made.asked.map((d) => d.key), DETAIL_KEYS);
  assert.equal(fs.existsSync(path.join(root, 'films')), false);
  const lines = newFilmLines('zz', made);
  assert.match(lines[0], /^agents: with AskUserQuestion, run --questions-json; without it, write the answers file/);
  assert.ok(lines.includes('vawe new: 6 facts needed before a good brief'));
  assert.ok(lines.includes('  subject: Argus, a log search tool for on-call engineers at small SaaS teams'));
  assert.ok(!lines.some((l) => /^\d+\. (look|family)\b/.test(l)), 'look and family are phase 3, not asked');
  assert.ok(lines.some((l) => l.startsWith('1. subject: ')));
  assert.ok(lines.some((l) => l.includes('why: ')) && lines.some((l) => l.includes('example: ')));
  assert.ok(lines.some((l) => l.startsWith('  bin/vawe new zz --request "a launch film for Argus"') && l.endsWith('--answers <file>')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('a full request writes the brief with no guess marker on an answered field', () => {
  const root = sandbox();
  const made = runNew(root, { request: FULL });
  assert.equal(made.asked, undefined);
  const text = briefOf(root);
  for (const key of ['what', 'for', 'message', 'show']) assert.match(text, new RegExp(`^- ${key}: (?!.*guess: change me).+$`, 'm'));
  assert.ok(!made.guesses.includes('what') && !made.guesses.includes('for') && !made.guesses.includes('message'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('--detail and --answers fill the fields, and an unanswered optional detail does not stop the run', () => {
  const root = sandbox();
  const file = path.join(root, 'answers.md');
  fs.writeFileSync(file, '# answers\n\n- subject: Argus, log search for on-call engineers\n2. message: find the bug in seconds, big moment at 4 s\nshow: the result list\n');
  const details = readDetails({ answers: file, detail: ['assets=none, invent all', 'format=12 s, 9:16'] });
  assert.equal(details.assets, 'none, invent all');
  const made = runNew(root, { request: 'launch film', details });
  assert.equal(made.asked, undefined);
  const text = briefOf(root);
  assert.match(text, /^- what: Argus, log search for on-call engineers$/m);
  assert.match(text, /^- for: named in what$/m);
  assert.match(text, /^- message: find the bug in seconds, big moment at 4 s$/m);
  assert.match(text, /^- spectacle: 4 s$/m);
  assert.match(text, /^- show: the result list$/m);
  assert.match(text, /^- assets: none, invent all$/m);
  assert.match(fs.readFileSync(path.join(root, 'films/zz/page.html'), 'utf8'), /name="duration" content="12"[\s\S]*name="aspect" content="9:16"/);
  assert.throws(() => readDetails({ detail: ['color=red'] }), /not a detail/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('--questions-json shape: at most 4 questions per call, short headers, 2 to 4 options, recommended first', () => {
  const { calls, answer_with } = questionsJson('zz', { request: 'a launch film for Argus' });
  assert.deepEqual(calls.map((c) => c.questions.length), [4, 2]);
  const all = calls.flatMap((c) => c.questions);
  assert.deepEqual(all.map((q) => q.header), ['Subject', 'Message', 'Show', 'Format', 'Assets', 'Ending']);
  for (const q of all) {
    assert.ok(q.header.length <= 12 && q.question && q.multiSelect === false);
    assert.ok(q.options.length >= 2 && q.options.length <= 4);
    for (const o of q.options) assert.ok(o.description && o.label.replace(/ \(Recommended\)$/, '').split(' ').length <= 5, o.label);
    assert.ok(q.options.slice(1).every((o) => !o.label.endsWith('(Recommended)')));
  }
  assert.equal(all[0].options[0].label, 'Argus for developers (Recommended)');
  assert.equal(answer_with, 'bin/vawe new zz --request "a launch film for Argus" --answers <file>');
});

test('--questions-json lists only the open details, and options fall back to generic choices', () => {
  const { calls } = questionsJson('zz', { request: FULL, details: { show: 'the result list' }, length: 12 });
  assert.deepEqual(calls.flatMap((c) => c.questions.map((q) => q.header)), ['Assets', 'Ending']);
  assert.equal(optionsFor({ key: 'subject' }, 'a film')[0].label, 'A developer tool (Recommended)');
});

test('--defaults keeps the guesses and names the details it guessed', () => {
  const root = sandbox();
  const made = runNew(root, { request: 'a launch film for Argus', defaults: true });
  assert.match(briefOf(root), /^- message: .+ \(guess: change me\)$/m);
  assert.deepEqual(made.defaulted, DETAIL_KEYS);
  assert.ok(newFilmLines('zz', made).some((l) => l.startsWith('--defaults: details guessed, not asked: subject, message')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('a written film names the docs of the later stages, each with its path, in at most 3 lines', () => {
  const root = sandbox();
  const lines = newFilmLines('zz', runNew(root, { request: FULL, defaults: true }));
  const docs = ['taste/craft/transitions.md', 'prompts/moves/README.md', 'taste/craft/sound.md', 'prompts/moves/lens.md', 'prompts/skill-combos.md'];
  const naming = lines.filter((l) => docs.some((d) => l.includes(d)));
  assert.ok(naming.length <= 3, naming.join('\n'));
  for (const d of docs) assert.ok(naming.some((l) => l.includes(d)), d);
  for (const d of docs) assert.ok(fs.existsSync(path.resolve(import.meta.dirname, '../..', d)), d);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a length in the request is the length of the brief and of the page', () => {
  const root = sandbox();
  runNew(root, { request: 'a 6 s sting for Argus', defaults: true });
  assert.match(briefOf(root), /^- length: 6 s$/im);
  assert.match(fs.readFileSync(path.join(root, 'films/zz/page.html'), 'utf8'), /name="duration" content="6"/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('with no length anywhere, the page takes the template default length the brief states', () => {
  const root = sandbox();
  runNew(root, { request: 'a film for Argus', defaults: true });
  const stated = Number(/^- length: (\d+(?:\.\d+)?) s/im.exec(briefOf(root))?.[1]);
  assert.ok(stated > 0);
  assert.match(fs.readFileSync(path.join(root, 'films/zz/page.html'), 'utf8'), new RegExp(`name="duration" content="${stated}"`));
  fs.rmSync(root, { recursive: true, force: true });
});

test('the brief carries a Taken from table, the design system step and the states budget, and no URL or capture line for an invented product', () => {
  const { text } = briefFor('beat-sheet.md', { request: 'a 20 s launch film for Loomline, an invented app', length: 20 });
  const found = headings(text);
  assert.ok(found.indexOf('Taken from') > found.indexOf('Task') && found.indexOf('Taken from') < found.indexOf('Directions'));
  assert.ok(found.indexOf('Design system and kit') > found.indexOf('Look') && found.indexOf('States') > found.indexOf('Design system and kit'));
  assert.match(text, /name 4 to 6 frames/);
  assert.match(text, /about 1 line and 2 or 3 things/);
  assert.match(text, /soft-skill[\s\S]*better-typography[\s\S]*colorize[\s\S]*beautiful-shadows[\s\S]*5\. frame/);
  assert.match(text, /Skill <rung>: <slug>: what it decided/);
  assert.match(text, /prompts\/skill-combos\.md/);
  assert.match(text, /Combo: <name>/);
  assert.match(text, /rung 1 still builds the UI parts/);
  assert.ok(!/^- (url|promise):/im.test(text) && !/never a placeholder/.test(text));
});

test('plain questions and --questions-json ask the same details', () => {
  const root = sandbox();
  const asked = runNew(root, { request: 'a launch film for Argus' }).asked.map((d) => d.key);
  const headers = questionsJson('zz', { request: 'a launch film for Argus' }).calls.flatMap((c) => c.questions.map((q) => q.header.toLowerCase()));
  assert.deepEqual(headers, asked);
  fs.rmSync(root, { recursive: true, force: true });
});

test('the brief carries an Ideas ledger between the States and the Board, read as not yet filled', async () => {
  const { text } = briefFor('beat-sheet.md', { request: 'a 20 s launch film for Loomline, an invented app', length: 20 });
  const found = headings(text);
  assert.ok(found.indexOf('Ideas') > found.indexOf('States') && found.indexOf('Ideas') < found.indexOf('Board'));
  const { ideasFilled } = await import('../../harness/lib/ideas.mjs');
  assert.equal(ideasFilled(text), false);
  assert.match(text, /guides\/IDEATE\.md/);
});

test('the brief carries the strip study, the Board (rhythm, spectacle, cuts, sound) after the states, and the motion pass', () => {
  const { text } = briefFor('beat-sheet.md', { request: 'a 20 s launch film for Loomline, an invented app', length: 20 });
  const found = headings(text);
  assert.ok(found.indexOf('Board') > found.indexOf('States') && found.indexOf('Motion pass') > found.indexOf('Board') && found.indexOf('Board') < found.indexOf('Spec'));
  assert.match(text, /bin\/vawe frame <ref-id> --cuts[\s\S]*name 3 moves/);
  const board = text.split(/^## /m).find((s) => s.startsWith('Board'));
  assert.match(board, /under 0\.4 s/);
  assert.match(board, /over 0\.9 s/);
  assert.match(board, /<meta name="spectacle">/);
  assert.match(board, /recipe 15/);
  assert.match(board, /\| camera/);
  assert.match(board, /overlap/);
  assert.match(board, /\| voice \|/);
  const motion = text.split(/^## /m).find((x) => x.startsWith('Motion pass'));
  assert.match(motion, /motion-craft\.md[\s\S]*core\/motion\/README\.md/);
  assert.match(motion, /\| cut \| anticipation[^\n]*follow-through[^\n]*arcs[^\n]*secondary[^\n]*exits[^\n]*hold[^\n]*camera[^\n]*what read flat/);
  assert.doesNotMatch(board, /\[bed/);
  assert.match(text, /frame films\/zz\/page\.html --cuts/);
});

test('the Look section names bin/vawe frame --world all and --looks every look of the lens, read from the module', () => {
  const { text } = briefFor('beat-sheet.md', { request: 'a five second sting', length: 5 });
  const line = text.split('## Look')[1].split('## ')[0].split('\n').find((l) => l.startsWith('- look:'));
  assert.match(line, /bin\/vawe frame <page> --looks --at <s>/);
  for (const name of Object.keys(LOOKS)) assert.ok(line.includes(name), name);
  assert.doesNotMatch(line, /\(guess: change me\)/);
});
