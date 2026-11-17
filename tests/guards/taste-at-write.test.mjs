// node --test tests/guards/taste-at-write.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { beatTopics, changedTopics, changedWorlds, closestEase, contractCheck } from '../../harness/guards/index.mjs';

const HEAD = '<meta name="duration" content="6">\n<meta name="message" content="zero fees">\n';
const PAGE = `${HEAD}
<section data-world="title"><div><h1>Zero fees</h1></div></section>
<section data-world="app"><div class="panel"><button>Send</button></div><audio src="assets/click.wav" data-at="3.2"></audio></section>
<section data-world="plain"><div style="background: linear-gradient(#000, #123)"></div></section>
`;

test('beatTopics: a title beat holds type only; the first beat has no cut', () => {
  assert.deepEqual(beatTopics(PAGE, ['title']), { title: ['type', 'motion'] });
});

test('beatTopics: a UI beat with a cut and a sound tag', () => {
  assert.deepEqual(beatTopics(PAGE, ['app']), { app: ['type', 'motion', 'layout', 'cuts', 'sound'] });
});

test('beatTopics: a ground and no text gives colour and a cut; a stylesheet ground counts', () => {
  assert.deepEqual(beatTopics(PAGE, ['plain']), { plain: ['colour', 'cuts'] });
  const css = `${HEAD}<style>[data-world="a"] { background: #111 }</style><section data-world="a"></section>`;
  assert.deepEqual(beatTopics(css), { a: ['colour'] });
});

test('beatTopics: nested same tags close at the matching tag; an unknown world is skipped', () => {
  const html = '<div data-world="a"><div><p>x</p></div></div><div data-world="b"><audio></audio></div>';
  assert.deepEqual(beatTopics(html, ['b', 'zzz']), { b: ['cuts', 'sound'] });
  assert.deepEqual(beatTopics(html, ['a']), { a: ['type', 'motion'] });
});

test('changedWorlds: only the added or edited beats', () => {
  const after = PAGE.replace('Zero fees', 'No fees');
  assert.deepEqual(changedWorlds(PAGE, after), ['title']);
  assert.deepEqual(changedWorlds('', PAGE), ['title', 'app', 'plain']);
  assert.deepEqual(changedWorlds(PAGE, PAGE), []);
});

const hand = (script, extra = '') => `${HEAD}<section data-world="a"><h1>x</h1></section>${extra}<style>${script}</style>`;
const eases = (html) => contractCheck(html).filter((f) => f.code === 'hand-ease');

test('a hand cubic-bezier is a finding that names the closest house ease', () => {
  const [f] = eases(hand('h1 { animation: in 0.5s cubic-bezier(0.4, 0, 0.2, 1) both }'));
  assert.equal(f.severity, 'advise');
  assert.match(f.fix, /var\(--ease-[a-z-]+\) in CSS or EASE\.[a-zA-Z]+ in script/);
  assert.equal(f.line, 3);
});

test('the named replacement is the nearest by curve: an ease-in is a carry, a strong ease-out is a landSoft', () => {
  assert.equal(closestEase('cubic-bezier(0.55, 0, 1, 0.45)'), 'carry');
  assert.equal(closestEase('cubic-bezier(0, 0, 0.2, 1)'), 'landSoft');
  assert.equal(closestEase('cubic-bezier(0.34, 1.56, 0.64, 1)'), 'pop');
  assert.equal(closestEase('nonsense'), null);
});

test('CSS keywords and the WAAPI easing option are findings; linear and var(--ease-*) are not', () => {
  assert.equal(eases(hand('h1 { animation: in 0.5s ease-out both }')).length, 1);
  assert.equal(eases(hand('h1 { transition-timing-function: ease-in-out }')).length, 1);
  assert.equal(eases(`${HEAD}<section data-world="a"></section><script>el.animate(k, { duration: 500, easing: "ease" })</script>`).length, 1);
  assert.equal(eases(hand('h1 { animation: spin 2s linear infinite }')).length, 0);
  assert.equal(eases(hand('h1 { animation: in 0.5s var(--ease-land) both }')).length, 0);
  assert.equal(eases(hand('h1 { animation: ease-in-out-name 1s var(--ease-land) }')).length, 0);
});

test('one finding per distinct curve, and a comment is not a finding', () => {
  assert.equal(eases(hand('a { animation: x 1s ease-out } b { animation: y 1s ease-out }')).length, 1);
  assert.equal(eases(hand('/* animation: x 1s ease-out */')).length, 0);
});

test('a vetted waiver on hand-ease drops the finding', () => {
  const why = 'world a: the 0.2 s fade matches the product UI curve measured at 0.2 s';
  const waive = `<script type="application/json" id="authoring">${JSON.stringify({ allow: ['hand-ease'], _why: { 'hand-ease': why } })}</script>\n`;
  assert.equal(eases(hand('h1 { animation: in 0.5s ease-out both }', waive)).length, 0);
});

test('changedTopics: text outside every beat (a lockup across beats) brings type and motion; an unchanged lockup brings nothing', () => {
  const grounds = `${HEAD}<div data-world="s1"><div class="ground"></div></div><div data-world="s2"><div class="ground"></div></div>\n`;
  const lockup = `${grounds}<div class="lockup"><h1>Ember</h1><p>Roasted slow, poured warm.</p></div>`;
  assert.deepEqual(changedTopics('', grounds), ['cuts']);
  assert.deepEqual(changedTopics(grounds, lockup), ['type', 'motion']);
  assert.deepEqual(changedTopics(lockup, lockup), []);
});
