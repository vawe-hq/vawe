import test from 'node:test';
import assert from 'node:assert/strict';
import { verbStage } from '../../harness/lib/trace/stages.mjs';

const stage = (verb, args, seen = {}) => verbStage({ verb, args }, seen);

test('a frame call has the stage its mode names, in the new and the old spelling alike', () => {
  const rows = [
    ['frame', 'p --world all', {}, 'frames'], ['frames', 'p', {}, 'frames'],
    ['frame', 'p --looks --at 4', {}, 'frames'],
    ['frame', 'p --board', {}, 'storyboard'], ['frame', 'p --directions', {}, 'storyboard'], ['storyboard', 'p', {}, 'storyboard'], ['see', 'p --plan', {}, 'storyboard'],
    ['frame', 'p --cuts', {}, 'study'], ['strip', 'p --cuts', {}, 'study'],
    ['frame', 'p --cuts', { dev: true }, 'motion'], ['strip', 'p --cuts', { dev: true }, 'motion'],
    ['frame', 'p --moment 2 --onion', { dev: true }, 'motion'],
    ['frame', 'p --moment 2', { dev: true }, null],
    ['frame', 'p --at 1,2,3', {}, 'study'], ['frame', 'p --at 1,2,3', { dev: true }, null],
    ['frame', 'p --at 4.2', {}, null], ['still', 'p --at 4.2', {}, null],
    ['frame', 'p --at 2 --box 1,2,3,4', {}, null],
    ['frame', 'p --vs r.mp4 --at 2.5,3', {}, 'study'],
  ];
  for (const [verb, args, seen, want] of rows) assert.equal(stage(verb, args, seen), want, `${verb} ${args}`);
});

test('the animatic is the board stage in the old and the new spelling, the studio names none, and a draft is still dev', () => {
  const rows = [
    ['dev', 'p --animatic', {}, 'board'], ['animatic', 'p', {}, 'board'],
    ['dev', 'p --studio --port 8800', {}, null], ['studio', 'p', {}, null],
    ['new', '--from-url /blog --full', {}, null], ['shot', '/blog', {}, null], ['new', 'acme --request a --from-url https://acme.com', {}, 'new'],
    ['dev', 'p', {}, 'dev'], ['dev', 'p --from 2 --to 4', { critique: true }, 'fix'],
  ];
  for (const [verb, args, seen, want] of rows) assert.equal(stage(verb, args, seen), want, `${verb} ${args}`);
});
