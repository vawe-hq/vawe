import test from 'node:test';
import assert from 'node:assert/strict';
import { kindOfFile, parseSize, slotListProblem, parseSlotArgs, planSlots, placeholderLines } from '../../harness/lib/template-slots.mjs';

const image = { key: 'screen-1', label: 'Main app screen', kind: 'image', size: '1600x1000', file: 'assets/slots/screen-1.png', where: 'the laptop' };
const video = { key: 'clip-1', label: 'Screen recording', kind: 'video', size: '1280x720', file: 'assets/slots/clip-1.mp4', where: 'the phone', span: 4 };
const card = { slots: [image, video] };

test('kindOfFile reads the extension, any case', () => {
  assert.equal(kindOfFile('a/b.PNG'), 'image');
  assert.equal(kindOfFile('shot.jpeg'), 'image');
  assert.equal(kindOfFile('a.webp'), 'image');
  assert.equal(kindOfFile('take.MOV'), 'video');
  assert.equal(kindOfFile('notes.txt'), null);
  assert.equal(kindOfFile('png'), null);
});

test('parseSize wants two whole numbers of two to five digits', () => {
  assert.deepEqual(parseSize('1600x1000'), { width: 1600, height: 1000 });
  for (const bad of ['1600', '1600X1000', '0x100', '1600x', 'x1000', '1x1', '123456x100', '16.5x10', undefined]) assert.equal(parseSize(bad), null, String(bad));
});

test('a good slot list has no problem, and a card with no list has none', () => {
  assert.equal(slotListProblem([image, video]), null);
  assert.equal(slotListProblem(undefined), null);
  assert.equal(slotListProblem([]), null);
});

test('a bad slot list names the slot and the field', () => {
  const cases = [
    [{ slots: 'x' }, /slots must be a list/],
    [[{ ...image, key: 'Screen 1' }], /slots\[0\].*key must be lowercase/],
    [[image, { ...video, key: 'screen-1' }], /slots\[1\] \(screen-1\): key screen-1 is used twice/],
    [[{ ...image, label: '' }], /label is required/],
    [[{ ...image, where: undefined }], /where is required/],
    [[{ ...image, kind: 'audio' }], /kind must be image or video/],
    [[{ ...image, size: '1600' }], /size must look like/],
    [[{ ...image, file: '/abs/screen.png' }], /relative path under assets\//],
    [[{ ...image, file: 'assets/../../x.png' }], /relative path under assets\//],
    [[{ ...image, file: 'page.html' }], /relative path under assets\//],
    [[{ ...image, file: 'assets/slots/screen-1.mp4' }], /is not a image file/],
    [[{ ...video, file: 'assets/slots/clip-1.png' }], /is not a video file/],
    [[{ ...video, span: 0 }], /span is seconds/],
    [[{ ...video, span: 'long' }], /span is seconds/],
    [[{ ...image, span: 3 }], /only a video slot has one/],
  ];
  for (const [slots, want] of cases) assert.match(slotListProblem(Array.isArray(slots) ? slots : slots.slots), want);
});

test('parseSlotArgs splits at the first = and expands ~/', () => {
  assert.deepEqual(parseSlotArgs(['screen-1=/a/b.png', 'clip-1=~/c d/e=f.mp4', 'x=~'], '/home/me'), [
    { key: 'screen-1', path: '/a/b.png' },
    { key: 'clip-1', path: '/home/me/c d/e=f.mp4' },
    { key: 'x', path: '/home/me' },
  ]);
});

test('parseSlotArgs refuses a value without a key or a path', () => {
  for (const bad of ['screen-1', '=a.png', 'screen-1=', '']) assert.throws(() => parseSlotArgs([bad]), /must be key=path/, bad);
});

test('planSlots matches keys and kinds', () => {
  const planned = planSlots(card, [{ key: 'clip-1', path: 'take.mp4' }, { key: 'screen-1', path: 'shot.png' }]);
  assert.deepEqual(planned.map((p) => [p.slot.key, p.path]), [['clip-1', 'take.mp4'], ['screen-1', 'shot.png']]);
});

test('an unknown key names every valid key', () => {
  assert.throws(() => planSlots(card, [{ key: 'screen-9', path: 'a.png' }]), /unknown slot "screen-9": the slots of this template are screen-1, clip-1/);
});

test('a template with no slots says so', () => {
  assert.throws(() => planSlots({}, [{ key: 'a', path: 'a.png' }]), /has no media slots/);
  assert.deepEqual(planSlots({}, []), []);
});

test('a wrong kind says what the slot takes and what it got', () => {
  assert.throws(() => planSlots(card, [{ key: 'screen-1', path: 'take.mp4' }]), /slot screen-1 takes an image \(png, jpg, jpeg, webp\), but take\.mp4 is a video/);
  assert.throws(() => planSlots(card, [{ key: 'clip-1', path: 'shot.png' }]), /slot clip-1 takes a video .*but shot\.png is an image/);
  assert.throws(() => planSlots(card, [{ key: 'clip-1', path: 'notes.txt' }]), /notes\.txt is not a file type vawe reads/);
});

test('the same key twice is refused', () => {
  assert.throws(() => planSlots(card, [{ key: 'screen-1', path: 'a.png' }, { key: 'screen-1', path: 'b.png' }]), /given twice/);
});

test('placeholderLines lists the slots nobody filled, and nothing when all are filled', () => {
  const some = planSlots(card, [{ key: 'screen-1', path: 'a.png' }]);
  const text = placeholderLines(card, some).join('\n');
  assert.match(text, /still placeholders/);
  assert.match(text, /clip-1: Screen recording, video 1280x720, assets\/slots\/clip-1\.mp4/);
  assert.doesNotMatch(text, /screen-1:/);
  assert.deepEqual(placeholderLines(card, planSlots(card, [{ key: 'screen-1', path: 'a.png' }, { key: 'clip-1', path: 'b.mp4' }])), []);
  assert.deepEqual(placeholderLines({}, []), []);
});
