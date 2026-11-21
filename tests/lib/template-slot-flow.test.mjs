// `vawe new <name> --template <id> --slot key=path`, the brief rename and the import warning, through templateFilm. Needs ffmpeg.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { templateFilm, renameInBrief } from '../../harness/cli/template.mjs';
import { EXIT } from '../../harness/lib/exit-codes.mjs';
import { UsageError } from '../../harness/cli/parse.mjs';
import { probe } from '../../harness/media/footage.mjs';
import { ffmpegOrDie } from '../../harness/lib/scratch.mjs';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures/templates');

function setup(templatesDir = FIXTURES) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-slot-flow-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-home-'));
  return { work, home, engine: work, env: { VAWE_TEMPLATES_DIR: templatesDir, VAWE_TEMPLATES_API: 'http://127.0.0.1:1' } };
}

function picture(dir, name = 'shot.png') {
  const file = path.join(dir, name);
  ffmpegOrDie(['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=green:s=640x640', '-frames:v', '1', file], file, 'fixture image');
  return file;
}

const slotFile = (work, name = 'screen-1.png') => path.join(work, 'films', 'mine', 'assets', 'slots', name);

test('--slot fits a picture to the slot size at the slot path and lists the slots left as placeholders', async () => {
  const { work, home, env, engine } = setup();
  const lines = await templateFilm({ id: 'fixture-sting', name: 'mine', slots: [`screen-1=${picture(home)}`], work, engine, env, home });
  assert.deepEqual([probe(slotFile(work)).width, probe(slotFile(work)).height], [320, 200]);
  const text = lines.join('\n');
  assert.match(text, /slot screen-1: shot\.png fitted to 320x200 at assets\/slots\/screen-1\.png/);
  assert.match(text, /still placeholders[\s\S]*clip-1: Screen recording, video 320x180/);
  assert.doesNotMatch(text, /still placeholders[\s\S]*screen-1:/);
  assert.equal(fs.readFileSync(slotFile(work, 'clip-1.mp4'), 'utf8'), 'placeholder\n', 'an unfilled slot keeps the template placeholder');
});

test('with no --slot every slot is listed as a placeholder', async () => {
  const { work, home, env, engine } = setup();
  const text = (await templateFilm({ id: 'fixture-sting', name: 'mine', work, engine, env, home })).join('\n');
  assert.match(text, /screen-1: Main app screen, image 320x200/);
  assert.match(text, /clip-1: Screen recording, video 320x180/);
});

test('--slot with ~/ reads from the home folder', async () => {
  const { work, home, env, engine } = setup();
  picture(home, 'app.png');
  await templateFilm({ id: 'fixture-sting', name: 'mine', slots: ['screen-1=~/app.png'], work, engine, env, home });
  assert.equal(probe(slotFile(work)).width, 320);
});

test('an unknown slot key is a usage error that names the valid keys, and no film is written', async () => {
  const { work, home, env, engine } = setup();
  await assert.rejects(templateFilm({ id: 'fixture-sting', name: 'mine', slots: [`nope=${picture(home)}`], work, engine, env, home }), (e) => {
    assert.ok(e instanceof UsageError);
    assert.match(e.message, /unknown slot "nope": the slots of this template are screen-1, clip-1/);
    return true;
  });
  assert.equal(fs.existsSync(path.join(work, 'films', 'mine')), false);
});

test('a picture for a video slot, a missing file and a bad --slot value are usage errors', async () => {
  const { work, home, env, engine } = setup();
  const shot = picture(home);
  const run = (slots) => templateFilm({ id: 'fixture-sting', name: 'mine', slots, work, engine, env, home });
  await assert.rejects(run([`clip-1=${shot}`]), (e) => e instanceof UsageError && /slot clip-1 takes a video .*shot\.png is an image/.test(e.message));
  await assert.rejects(run([`screen-1=${path.join(home, 'gone.png')}`]), (e) => e instanceof UsageError && /no such file/.test(e.message));
  await assert.rejects(run(['screen-1']), (e) => e instanceof UsageError && /must be key=path/.test(e.message));
  assert.equal(fs.existsSync(path.join(work, 'films', 'mine')), false);
});

test('a file ffmpeg cannot read removes the half-written film', async () => {
  const { work, home, env, engine } = setup();
  const fake = path.join(home, 'fake.png');
  fs.writeFileSync(fake, 'not a picture');
  await assert.rejects(templateFilm({ id: 'fixture-sting', name: 'mine', slots: [`screen-1=${fake}`], work, engine, env, home }), (e) => e.exitCode === EXIT.IO);
  assert.equal(fs.existsSync(path.join(work, 'films', 'mine')), false);
});

test('a template with no slots refuses --slot', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-plain-'));
  fs.mkdirSync(path.join(dir, 'plain'));
  fs.writeFileSync(path.join(dir, 'plain', 'page.html'), '<p>x</p>');
  const { work, home, env, engine } = setup(dir);
  await assert.rejects(templateFilm({ id: 'plain', name: 'mine', slots: [`screen-1=${picture(home)}`], work, engine, env, home }), (e) => e instanceof UsageError && /has no media slots/.test(e.message));
});

test('the copied brief names the new film where it named the template', async () => {
  const { work, home, env, engine } = setup();
  await templateFilm({ id: 'fixture-sting', name: 'mine', work, engine, env, home });
  const brief = fs.readFileSync(path.join(work, 'films', 'mine', 'brief.md'), 'utf8');
  assert.match(brief, /^Page: films\/mine\/page\.html, films\/mine\/page\.html$/m);
  assert.match(brief, /^Draft: out\/mine-draft\.mp4$/m);
  assert.match(brief, /^Kept: films\/fixture-sting-2\/page\.html$/m, 'a longer id that starts the same is another film');
});

test('renameInBrief escapes the id and leaves a same-name film alone', () => {
  assert.equal(renameInBrief('films/a.b/x and films/aXb/x', 'a.b', 'new'), 'films/new/x and films/aXb/x');
  assert.equal(renameInBrief('see films/title-sting/page.html', 'title-sting', 'title-sting'), 'see films/title-sting/page.html');
  assert.equal(renameInBrief('the film films/title-sting.', 'title-sting', 'x'), 'the film films/x.');
});

test('a template page that loads a file outside its folder and ../../core/ gets one warning line', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-leaky-'));
  fs.mkdirSync(path.join(dir, 'leaky'));
  fs.writeFileSync(path.join(dir, 'leaky', 'page.html'), `<script type="module">import { a } from '../../prompts/moves/a.js'; import { b } from '../../core/motion/b.js';</script>`);
  const { work, home, env, engine } = setup(dir);
  const lines = await templateFilm({ id: 'leaky', name: 'mine', work, engine, env, home });
  const warnings = lines.filter((l) => l.startsWith('warning: '));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /page\.html loads \.\.\/\.\.\/prompts\/moves\/a\.js/);
});
