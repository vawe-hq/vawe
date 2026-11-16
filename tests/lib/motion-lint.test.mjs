import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRecords, motionLint, exitLength, groupLanding, tightStagger, linearMove, easeFix, seamRepeat, oneBand, durationSize, moveDirection, unwaived, lintLines } from '../../harness/lib/motion-lint.mjs';

const rec = (o) => ({ target: 0, label: 'h1 "Hi"', id: '', props: ['opacity'], delay: 0, duration: 0.5, easing: 'linear',
  kfEasings: ['ease', 'ease'], opacity: null, from: '', fullFrame: false, ...o });

test('an exit as long as its entrance is flagged under rule exits-shorter; a shorter one is not', () => {
  const inn = rec({ opacity: [0, 1], duration: 0.6 });
  const [f] = exitLength([inn, rec({ opacity: [1, 0], delay: 2, duration: 0.6 })]);
  assert.equal(f.rule, 'exits-shorter');
  assert.equal(f.at, 2);
  assert.deepEqual(exitLength([inn, rec({ opacity: [1, 0], delay: 2, duration: 0.36 })]), []);
});

test('three entrances landing on one 60 fps frame are a group landing; a stagger is not', () => {
  const same = [0, 1, 2].map((k) => rec({ target: k, opacity: [0, 1], delay: 1, duration: 0.4 }));
  const [f] = groupLanding(same);
  assert.equal(f.rule, 'stagger');
  assert.equal(f.at, 1.4);
  const staggered = [0, 1, 2].map((k) => rec({ target: k, opacity: [0, 1], delay: 1 + k * 0.05, duration: 0.4 }));
  assert.deepEqual(groupLanding(staggered), []);
});

test('linear easing on a move over 0.3 s is flagged; a per-keyframe curve or a short move is not', () => {
  const move = { props: ['translate'], kfEasings: ['linear', 'linear'] };
  assert.equal(linearMove([rec({ ...move, duration: 0.8 })])[0].rule, 'named-eases');
  assert.deepEqual(linearMove([rec({ ...move, duration: 0.2 })]), []);
  assert.deepEqual(linearMove([rec({ ...move, duration: 0.8, kfEasings: ['linear(0, 0.5, 1)', 'linear'] })]), []);
  assert.deepEqual(linearMove([rec({ props: ['color'], kfEasings: ['linear'], duration: 0.8 })]), []);
});

test('sampled keyframes with linear easing are not a linear move unless their steps are constant', () => {
  const sampled = (value) => Array.from({ length: 30 }, (_, i) => ({ offset: i / 29, translate: `${value(i / 29)}px 0px` }));
  const base = { props: ['translate'], kfEasings: ['linear', 'linear'], duration: 0.8 };
  assert.deepEqual(linearMove([rec({ ...base, stops: sampled((u) => 100 * (1 - (1 - u) ** 3)) })]), []);
  assert.equal(linearMove([rec({ ...base, stops: sampled((u) => 100 * u) })]).length, 1);
  assert.equal(linearMove([rec({ ...base, stops: [{ offset: 0, translate: '0px 0px' }, { offset: 1, translate: '100px 0px' }] })]).length, 1);
  assert.equal(linearMove([rec(base)]).length, 1);
});

test('two entrances 30 ms apart are at the stagger floor, whatever the float error of their seconds', () => {
  const pair = (delay) => [rec({ target: 0, opacity: [0, 1], delay, duration: 0.4 }), rec({ target: 1, opacity: [0, 1], delay: delay + 0.03, duration: 0.4 })];
  assert.deepEqual(tightStagger(pair(2)), []);
  assert.deepEqual(tightStagger(pair(12.4)), []);
  assert.equal(tightStagger([rec({ target: 0, opacity: [0, 1], delay: 1, duration: 0.4 }), rec({ target: 1, opacity: [0, 1], delay: 1.02, duration: 0.4 })]).length, 1);
});

test('a default CSS keyword on a move over 0.3 s points at the EASE names; a custom curve does not', () => {
  const move = { props: ['translate'], duration: 0.8 };
  const [f] = linearMove([rec({ ...move, easing: 'ease-in-out', kfEasings: ['linear', 'linear'] })]);
  assert.equal(f.code, 'default-ease');
  assert.match(f.fix, /EASE\.land.*EASE\.leave/);
  assert.match(linearMove([rec({ ...move, easing: 'ease', kfEasings: ['ease', 'ease'] })])[0].what, /CSS keyword ease/);
  assert.match(linearMove([rec({ ...move, kfEasings: ['linear', 'linear'] })])[0].fix, /EASE\.land/);
  assert.deepEqual(linearMove([rec({ ...move, easing: 'linear(0, 0.6, 1)', kfEasings: ['ease', 'ease'] })]), []);
  assert.deepEqual(linearMove([rec({ ...move, easing: 'ease', kfEasings: ['ease', 'ease'], duration: 0.2 })]), []);
});

test('moveDirection reads translate, translateX/Y and a single-value translate', () => {
  assert.equal(moveDirection('0 0.5em'), 'y+');
  assert.equal(moveDirection('-0.8em'), 'x-');
  assert.equal(moveDirection('translateY(12%)'), 'y+');
  assert.equal(moveDirection('translate(-40px, 0px)'), 'x-');
  assert.equal(moveDirection('inset(0 0 0 100%)'), '');
});

test('the same full-frame seam move twice in a row is flagged; a changed direction and hard cuts are not', () => {
  const seam = (delay, from) => rec({ fullFrame: true, props: ['translate'], delay, duration: 0.4, kf: { translate: [from, '0px'] }, kfEasings: ['x', 'x'] });
  const [f] = seamRepeat([seam(1, '100% 0'), seam(2, '100% 0')]);
  assert.equal(f.rule, 'seam-variety');
  assert.equal(f.at, 2);
  assert.deepEqual(seamRepeat([seam(1, '100% 0'), seam(2, '0 100%')]), []);
  const cut = (delay) => rec({ fullFrame: true, opacity: [0, 1], delay, duration: 0.001 });
  assert.deepEqual(seamRepeat([cut(1), cut(2)]), []);
});

test('the seam signature reads the real move: scale, slide axis and direction, blur, clip; a changed one is not a repeat', () => {
  const seam = (delay, kf, o = {}) => rec({ fullFrame: true, props: Object.keys(kf), delay, duration: 0.6, kf, kfEasings: ['x', 'x'], ...o });
  const push = (delay) => seam(delay, { scale: ['1', '1.05'] });
  const [f] = seamRepeat([push(1), push(3)]);
  assert.equal(f.at, 3);
  assert.match(f.what, /scale 1 to 1\.05/);
  assert.deepEqual(seamRepeat([push(1), seam(3, { scale: ['1.05', '1'] })]), []);
  const slide = (delay, to) => seam(delay, { translate: ['0px', to] });
  assert.deepEqual(seamRepeat([slide(1, 'calc(var(--vw) * -0.3) 0px'), slide(3, 'calc(var(--vw) * 0.3) 0px')]), []);
  assert.deepEqual(seamRepeat([slide(1, '-40px 0px'), slide(3, '0px 40px')]), []);
  assert.match(seamRepeat([slide(1, '-40px 0px'), slide(3, '-60px 0px')])[0].what, /moves left/);
  assert.match(seamRepeat([seam(1, { filter: ['blur(8px)', 'blur(0px)'] }), seam(3, { filter: ['blur(6px)', 'blur(0px)'] })])[0].what, /blur/);
  assert.deepEqual(seamRepeat([seam(1, { clipPath: ['inset(0 100% 0 0)', 'inset(0)'] }), seam(3, { scale: ['1', '1.05'] })]), []);
});

test('records that start on one second are one seam; texture records are not seams', () => {
  const seam = (delay, kf, o = {}) => rec({ fullFrame: true, props: Object.keys(kf), delay, duration: 0.6, kf, kfEasings: ['x', 'x'], ...o });
  const blob = (delay) => seam(delay, { translate: ['0px', 'calc(var(--vw) * 0.2) 0px'] }, { decorative: true, duration: 2 });
  const world = (delay, kf) => [seam(delay, kf), blob(delay)];
  assert.deepEqual(seamRepeat([...world(0, { scale: ['1', '1.05'] }), ...world(2, { scale: ['1.04', '1'] }), ...world(4, { translate: ['0px', '-3vw 0px'] })]), []);
  const two = (delay) => [seam(delay, { scale: ['1', '1.05'] }), seam(delay + 0.02, { translate: ['0px', '-40px 0px'] })];
  assert.equal(seamRepeat([...two(1), ...two(3)]).length, 1);
});

test('one speed band across the film is flagged unless the page paints in script', () => {
  const same = [rec({ opacity: [0, 1], duration: 0.4 }), rec({ opacity: [0, 1], delay: 1, duration: 0.45 })];
  assert.equal(oneBand(same)[0].rule, 'speed-bands');
  assert.deepEqual(oneBand(same, { scripted: true }), []);
  assert.deepEqual(oneBand([...same, rec({ opacity: [0, 1], duration: 1.2 })]), []);
});

test('a waiver with a reason silences its line, bare or at its second', () => {
  const findings = exitLength([rec({ opacity: [0, 1], duration: 0.3 }), rec({ opacity: [1, 0], delay: 2, duration: 0.3 })]);
  const reason = 'the slow fade at 2.0 s is the ending and lasts 0.3 s';
  assert.equal(unwaived(findings, { allow: ['exit-length'], _why: { 'exit-length': reason } }).length, 0);
  assert.equal(unwaived(findings, { allow: ['exit-length@2.00'], _why: { 'exit-length@2.00': reason } }).length, 0);
  assert.equal(unwaived(findings, { allow: ['exit-length'], _why: { 'exit-length': 'the slow fade is the ending' } }).length, 1, 'a reason with no second and no measure does not waive');
  assert.equal(unwaived(findings, { allow: ['exit-length'] }).length, 1);
});

test('a waiver named by the rule id silences a finding of that rule, scoped to its range', () => {
  const finding = { code: 'left-edges', rule: 'shared-edges', at: 19.9, what: '4 distinct left edges', fix: 'align' };
  const why = 'world poster, 3.4 s: the 4 edges at 19.9 s are a ledger and measure 12 px apart';
  assert.equal(unwaived([finding], { allow: ['shared-edges@17-20.4'], _why: { 'shared-edges@17-20.4': why } }).length, 0);
  assert.equal(unwaived([finding], { allow: ['shared-edges@1-2'], _why: { 'shared-edges@1-2': why } }).length, 1);
  assert.equal(unwaived([finding], { allow: ['shared-edges@17-20.4'] }).length, 1);
});

test('lines carry the rule, the second, the code and one fix, in time order', () => {
  const findings = motionLint({ scripted: false, records: [
    rec({ target: 0, opacity: [0, 1], duration: 0.3 }), rec({ target: 0, opacity: [1, 0], delay: 3, duration: 0.3 }),
    rec({ target: 1, props: ['translate'], kfEasings: ['linear', 'linear'], delay: 1, duration: 0.9 }),
  ] });
  const lines = lintLines(findings);
  assert.match(lines[0], /^rule named-eases @1\.00s linear-move: .*; fix: /);
  assert.match(lines[1], /^rule exits-shorter @3\.00s exit-length: /);
});

test('an element inside aria-hidden is texture: its exit is not measured', () => {
  const inn = rec({ opacity: [0, 1], duration: 0.6, decorative: true });
  assert.deepEqual(exitLength([inn, rec({ opacity: [1, 0], delay: 2, duration: 0.6, decorative: true })]), []);
});

test('an exit sampled at a spacing as long as the exit is not measured; a measured one still is', () => {
  const inn = rec({ opacity: [0, 1], duration: 0.6 });
  const coarse = rec({ opacity: [1, 0], delay: 2, duration: 0.075, step: 0.075 });
  assert.deepEqual(exitLength([inn, coarse]), []);
  const fine = rec({ opacity: [1, 0], delay: 2, duration: 0.3, step: 0.075 });
  assert.deepEqual(exitLength([inn, fine]), []);
  const slow = rec({ opacity: [1, 0], delay: 2, duration: 0.75, step: 0.075 });
  assert.equal(exitLength([inn, slow]).length, 1);
});

test('mergeRecords: sampled records get targets of their own, so an entrance never pairs with another element exit', () => {
  const animated = [rec({ target: 0, opacity: [0, 1], duration: 0.6 }), rec({ target: 1, opacity: [0, 1], duration: 0.6 })];
  const sampled = [rec({ target: 0, opacity: [1, 0], delay: 2, duration: 0.9, step: 0.05 })];
  const merged = mergeRecords(animated, sampled);
  assert.deepEqual(merged.map((r) => r.target), [0, 1, 2]);
  assert.deepEqual(exitLength(merged), []);
});

test('durationSize: a small element on a longer move than a large one fires; a size-matched or similar duration does not', () => {
  const mover = (o) => rec({ props: ['translate'], opacity: [0, 1], id: 'enter', ...o });
  const title = mover({ target: 0, label: 'h1 "Title"', area: 400000, duration: 0.2 });
  const chip = mover({ target: 1, label: 'span.chip', area: 20000, duration: 0.8, delay: 1 });
  const [f] = durationSize([title, chip]);
  assert.deepEqual([f.code, f.rule, f.at], ['duration-size', 'speed-bands', 1]);
  assert.match(f.what, /span\.chip \(20k px2\) moves for 0\.80 s, h1 "Title" \(400k px2, 20 times larger\) for 0\.20 s/);
  assert.deepEqual(durationSize([mover({ target: 0, area: 400000, duration: 0.8 }), mover({ target: 1, area: 20000, duration: 0.2 })]), []);
  assert.deepEqual(durationSize([title, { ...chip, duration: 0.3 }]), [], 'under the duration ratio');
  assert.deepEqual(durationSize([title, { ...chip, area: 200000 }]), [], 'under the area ratio');
  assert.deepEqual(durationSize([title, { ...chip, decorative: true }]), []);
  assert.deepEqual(durationSize([title, { ...chip, area: undefined }]), []);
});

test('a keyword-eased move gets the ease-table row for its job as the fix', () => {
  const move = { props: ['translate'], kfEasings: ['linear', 'linear'] };
  assert.match(linearMove([rec({ ...move, id: 'leave', duration: 0.8 })])[0].fix, /^Exit: EASE\.launch, 0\.35 to 0\.6 of the entrance/);
  assert.match(easeFix(rec({ ...move, fullFrame: true, duration: 1.6 })), /^Camera move under 2 s: EASE\.land,/);
  assert.match(easeFix(rec({ ...move, fullFrame: true, duration: 2.4 })), /^Camera move of 2 s or more: EASE\.glide,/);
  assert.match(easeFix(rec({ ...move, opacity: [0, 1], duration: 0.8 })), /^Entrance: EASE\.land, 0\.5 to 0\.8 s for a title, 0\.22 to 0\.5 s for a panel/);
  assert.match(easeFix(rec({ ...move, fullFrame: true, opacity: [0, 1], duration: 2.4 })), /^Entrance:/);
  assert.match(easeFix(rec({ ...move, duration: 0.8 })), /^easing: EASE\.land to arrive.*taste\/craft\/motion-craft\.md$/);
});

test('unseenMotionLines: one line names the skipped checks of a page that paints in seek or onFrame with no boxes', async () => {
  const { unseenMotionLines } = await import('../../harness/lib/motion-lint.mjs');
  const [line, ...rest] = unseenMotionLines({ scripted: true, records: [] });
  assert.match(line, /^checks skipped: .*slideshow.*onFrame/);
  assert.deepEqual(rest, []);
  assert.deepEqual(unseenMotionLines({ scripted: true, records: [], boxes: { tracks: [] } }), []);
  assert.deepEqual(unseenMotionLines({ scripted: false, records: [] }), []);
});
