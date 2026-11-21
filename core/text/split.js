// Splits the text of an element into one inline-block span per grapheme or word, so each can be animated, and keeps the resting layout
// of the unsplit text: a letter alone is shaped alone (no kerning, no ligature), so each letter span takes the advance the browser
// gave that letter inside the whole run. Chrome puts a kern pair's adjustment in the advance of the first letter.
// The page imports it as `import { splitGlyphs } from '/core/text/split.js'` and calls it after `await document.fonts.ready`.

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function textNodesOf(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue) nodes.push(n);
  return nodes;
}

function rangeWidth(node, from, to) {
  const range = document.createRange();
  range.setStart(node, from);
  range.setEnd(node, to);
  return range.getBoundingClientRect().width;
}

// [{ text, from, to, space }] for one text node: words and the white space between them, with their offsets.
function tokensOf(text) {
  return [...text.matchAll(/\S+|\s+/g)].map((m) => ({ text: m[0], from: m.index, to: m.index + m[0].length, space: /^\s/.test(m[0]) }));
}

function glyphSpan(text, width) {
  const span = document.createElement('span');
  span.textContent = text;
  span.style.display = 'inline-block';
  span.style.whiteSpace = 'pre';
  if (width != null) span.style.width = `${width.toFixed(4)}px`;
  return span;
}

function charSpans(node, token, scale) {
  let at = token.from;
  return [...SEGMENTER.segment(token.text)].map(({ segment }) => {
    const span = glyphSpan(segment, rangeWidth(node, at, at + segment.length) / scale);
    at += segment.length;
    return span;
  });
}

// Measure every node before changing any, so one node's new spans cannot move the next one's range.
function plansOf(el, by, scale) {
  return textNodesOf(el).map((node) => ({
    node,
    parts: tokensOf(node.nodeValue).map((t) => (t.space ? { text: t.text } : { glyphs: by === 'word' ? [glyphSpan(t.text, null)] : charSpans(node, t, scale) })),
  }));
}

function apply({ node, parts }, glyphs) {
  const nodes = parts.map((p) => {
    if (!p.glyphs) return document.createTextNode(p.text);
    const word = document.createElement('span');
    word.style.whiteSpace = 'nowrap';
    word.append(...p.glyphs);
    glyphs.push(...p.glyphs);
    return word;
  });
  node.replaceWith(...nodes);
}

/**
 * splitGlyphs(el, { by: 'char' | 'word' }): replaces the text of `el` with spans and returns them in reading order.
 * 'char' makes one span per grapheme, each as wide as that letter is in the unsplit text, so the resting layout (kerning included) is the same;
 * a ligature (fi) is drawn as two letters. 'word' makes one span per word, shaped whole. A space stays plain text and wraps as before.
 */
export function splitGlyphs(el, { by = 'char' } = {}) {
  if (by !== 'char' && by !== 'word') throw new Error(`splitGlyphs: by must be 'char' or 'word', got ${JSON.stringify(by)}`);
  const scale = el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1;
  const plans = plansOf(el, by, scale || 1);
  if (document.fonts.status === 'loading') throw new Error('splitGlyphs: fonts are still loading, so the widths are of the fallback face; `await document.fonts.ready` first');
  const glyphs = [];
  for (const plan of plans) apply(plan, glyphs);
  return glyphs;
}
