// Splits the text of an element into one inline-block span per grapheme or word, so each can be animated, and keeps the resting layout
// of the unsplit text: a letter alone is shaped alone (no kerning, no ligature), so each letter span takes the advance the browser
// gave that letter inside the whole run. Chrome puts a kern pair's adjustment in the advance of the first letter.

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

// [{ text, from, space }] for one text node: words and the white space between them, with their offsets.
function tokensOf(text) {
  return [...text.matchAll(/(\s+)|\S+/g)].map((m) => ({ text: m[0], from: m.index, space: m[1] != null }));
}

function glyphSpan(text, widthEm) {
  const span = document.createElement('span');
  span.textContent = text;
  span.style.display = 'inline-block';
  span.style.whiteSpace = 'pre';
  if (widthEm != null) span.style.width = `${widthEm.toFixed(6)}em`;
  return span;
}

// Widths in em, so the spans keep their places when the font size follows the viewport (--vh) after the split.
function charSpans(node, token, scale) {
  const em = parseFloat(getComputedStyle(node.parentElement).fontSize) * scale;
  let at = token.from;
  return [...SEGMENTER.segment(token.text)].map(({ segment }) => {
    const span = glyphSpan(segment, rangeWidth(node, at, at + segment.length) / em);
    at += segment.length;
    return span;
  });
}

function checkFont(node) {
  const font = getComputedStyle(node.parentElement).font;
  if (!document.fonts.check(font, node.nodeValue)) {
    throw new Error(`splitGlyphs: the face of "${font}" is not loaded, so the widths would be of the fallback face; \`await document.fonts.load(getComputedStyle(el).font)\` first`);
  }
}

// The exact screen scale, from a 100 by 10 px probe (offsetWidth rounds); a rotation or skew widens the short side more, so it fails.
function screenScale(el) {
  const probe = document.createElement('vawe-probe');
  probe.style.cssText = 'display:block;position:absolute;left:0;top:0;width:100px;height:10px;padding:0;border:0;margin:0';
  el.append(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  const sx = rect.width / 100, sy = rect.height / 10;
  if (!(sx > 0) || Math.abs(sx - sy) > 0.001 * sx) throw new Error('splitGlyphs: the element is rotated or skewed, so its letters cannot be measured; split before the transform applies');
  return sx;
}

/**
 * splitGlyphs(el, { by: 'char' | 'word' }): replaces the text of `el` with spans and returns them in reading order.
 * 'char' makes one span per grapheme, each as wide as that letter is in the unsplit text, so the resting layout (kerning included) is the same;
 * a ligature (fi) is drawn as two letters. 'word' makes one span per word, shaped whole. A space stays plain text and wraps as before.
 */
export function splitGlyphs(el, { by = 'char' } = {}) {
  if (by !== 'char' && by !== 'word') throw new Error(`splitGlyphs: by must be 'char' or 'word', got ${JSON.stringify(by)}`);
  if (!el?.getClientRects().length) throw new Error('splitGlyphs: the element is missing or not laid out (display: none?)');
  const nodes = textNodesOf(el);
  nodes.forEach(checkFont);
  const scale = screenScale(el);
  // Measure every node before changing any, so one node's new spans cannot move the next one's range.
  const plans = nodes.map((node) => ({
    node,
    parts: tokensOf(node.nodeValue).map((t) => (t.space ? { text: t.text } : { glyphs: by === 'word' ? [glyphSpan(t.text, null)] : charSpans(node, t, scale) })),
  }));
  for (const { node, parts } of plans) node.replaceWith(...parts.map(partNode));
  return plans.flatMap((p) => p.parts.flatMap((x) => x.glyphs ?? []));
}

function partNode(part) {
  if (!part.glyphs) return document.createTextNode(part.text);
  const word = document.createElement('span');
  word.style.whiteSpace = 'nowrap';
  word.append(...part.glyphs);
  return word;
}
