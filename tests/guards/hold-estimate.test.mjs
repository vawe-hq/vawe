// node --test tests/guards/hold-estimate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contractCheck } from '../../harness/guards/index.mjs';
import { holdFindings } from '../../harness/guards/hold-estimate.mjs';

const page = ({ duration = 5, beat3 = '3s', tagline = 'Roasted slow. Poured warm.' } = {}) => `<meta name="duration" content="${duration}">
<meta name="message" content="ember">
<style>:root { --beat-2: 1.5s; --beat-3: ${beat3}; }</style>
<section data-world="a"><h1>Ember</h1></section>
<section data-world="b"><h1>Ember</h1></section>
<section data-world="c"><p>${tagline}</p></section>
`;

test('a 4 word tagline in a 2 s beat is a finding with the length that fits', () => {
  const [f] = holdFindings(page());
  assert.equal(f.code, 'read-hold');
  assert.equal(f.severity, 'advise');
  assert.match(f.message, /world "c" shows from 3\.0 to 5\.0 s \(2\.0 s\).*4 words.*needs 2\.4 s/);
  assert.match(f.fix, /at least 2\.6 s.*cut the line to 3 words/);
});

test('a beat long enough for its line has no finding, and a one word title in a 1.5 s beat has none', () => {
  assert.deepEqual(holdFindings(page({ beat3: '2.7s' })), []);
  assert.deepEqual(holdFindings(page({ tagline: 'Ember' })), []);
});

test('a word split into letter spans is one word', () => {
  const spans = [...'Ember'].map((c) => `<span>${c}</span>`).join('');
  assert.deepEqual(holdFindings(page({ tagline: spans })), []);
});

test('a page that does not name its beats, or an auto duration, is not estimated', () => {
  assert.deepEqual(holdFindings(page().replace('--beat-3: 3s;', '')), []);
  assert.deepEqual(holdFindings(page({ duration: 'auto' })), []);
});

test('texture and chrome are not lines to read, and the finding reaches contractCheck and honours a waiver', () => {
  assert.deepEqual(holdFindings(page({ tagline: '' }).replace('<p></p>', '<p aria-hidden="true">one two three four five</p>')), []);
  assert.ok(contractCheck(page()).some((f) => f.code === 'read-hold'));
  const waiver = `<script type="application/json" id="authoring">${JSON.stringify({ allow: ['read-hold'], _why: { 'read-hold': 'world c: the tagline is read before the cut, measured at 1.9 s' } })}</script>`;
  assert.ok(!contractCheck(page() + waiver).some((f) => f.code === 'read-hold'));
});
