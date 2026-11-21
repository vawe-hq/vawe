// The live half of the template export: what the page shows, frame by frame, read from a loaded page through its own seek.
// The functions marked "runs in the page" are sent as source, so each references nothing outside its own body.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../lib/render-harness.mjs';

// Runs in the page: the body's elements in paint order, with the ones that never paint marked.
function readChildren() {
  const silent = new Set(['SCRIPT', 'STYLE', 'AUDIO', 'LINK', 'META', 'TEMPLATE', 'NOSCRIPT', 'TITLE', 'BASE']);
  return [...document.body.children].map((el, i) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
    return { nth: i + 1, label: el.dataset.world || el.id || cls || el.tagName.toLowerCase(), world: el.dataset.world || null, silent: silent.has(el.tagName) };
  });
}

// Runs in the page: for each input selector, how many elements it matches and the nth of its body child.
function readHosts(selectors) {
  const top = (el) => { let n = el; while (n.parentElement && n.parentElement !== document.body) n = n.parentElement; return n.parentElement ? [...document.body.children].indexOf(n) + 1 : null; };
  return selectors.map((sel) => {
    const found = [...document.querySelectorAll(sel)];
    return { count: found.length, nth: found[0] ? top(found[0]) : null };
  });
}

// Runs in the page: one frame. Per body child: whether it paints (elementShows) and its blend mode. Per input: where its first line
// sits (x on its justification, the baseline), its scale against layout, its opacity with its ancestors', its ink colour, and
// whether a clip-path or a mask on it or an ancestor cuts it (a live text layer cannot follow that).
function readFrame(selectors, showsSource) {
  const shows = new Function(`${showsSource}\nreturn elementShows;`)();
  const children = [...document.body.children].map((el) => ({ shown: shows(el, 0.001), blend: getComputedStyle(el).mixBlendMode }));
  const rgb = (css) => { const p = (/rgba?\(([^)]+)\)/.exec(css)?.[1] || '0,0,0').split(/[ ,/]+/).filter(Boolean).map(Number); return { c: p.slice(0, 3).map((v) => v / 255), a: p.length > 3 ? p[3] : 1 }; };
  const inkOf = (el) => [el, ...el.querySelectorAll('*')].find((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) || el;
  const texts = selectors.map((sel) => {
    const el = document.querySelector(sel);
    let opacity = 1, effects = false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') opacity = 0;
      opacity *= Number(s.opacity);
      if (s.clipPath !== 'none' || (s.maskImage && s.maskImage !== 'none')) effects = true;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    const style = getComputedStyle(el);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = style.font;
    const m = ctx.measureText(el.innerText || 'x');
    const content = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
    const first = rects[0];
    if (!first) return { opacity: 0, x: 0, baseline: 0, scale: 1, color: [0, 0, 0], effects };
    const scale = first.height / content;
    const left = Math.min(...rects.map((r) => r.left)), right = Math.max(...rects.map((r) => r.right));
    const align = style.textAlign;
    const x = align === 'center' ? (left + right) / 2 : align === 'right' || align === 'end' ? right : left;
    const ink = rgb(getComputedStyle(inkOf(el)).color);
    return { opacity: opacity * ink.a, x, baseline: first.top + m.fontBoundingBoxAscent * scale, scale, color: ink.c, effects };
  });
  return { children, texts };
}

// Runs in the page: the style of each input as it is now, and the url of the @font-face file that draws it.
function readStyles(selectors) {
  const faces = [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules].filter((r) => r instanceof CSSFontFaceRule).map((r) => ({ rule: r, base: sheet.href || document.baseURI })); } catch { return []; } });
  const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');
  const faceUrl = (family, weight) => {
    const hit = faces.find(({ rule }) => {
      if (unquote(rule.style.getPropertyValue('font-family')).toLowerCase() !== family.toLowerCase()) return false;
      const w = (rule.style.getPropertyValue('font-weight') || '400').split(/\s+/).map(Number);
      return weight >= w[0] && weight <= (w[1] ?? w[0]);
    });
    const src = hit && /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(hit.rule.style.getPropertyValue('src'));
    return src ? new URL(src[1], hit.base).href : null;
  };
  // The face is the one the first words are drawn in: a line whose words are spans of their own weight is that weight, not the line's.
  const inkOf = (el) => [el, ...el.querySelectorAll('*')].find((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) || el;
  return selectors.map((sel) => {
    const el = document.querySelector(sel);
    const s = getComputedStyle(inkOf(el));
    const block = getComputedStyle(el);
    const size = parseFloat(s.fontSize);
    const family = unquote(s.fontFamily.split(',')[0]);
    const weight = Number(s.fontWeight) || 400;
    const align = block.textAlign === 'center' ? 'center' : block.textAlign === 'right' || block.textAlign === 'end' ? 'right' : 'left';
    return {
      text: el.innerText.replace(/\r?\n/g, '\n').trim(), family, weight, italic: s.fontStyle !== 'normal', size,
      tracking: s.letterSpacing === 'normal' ? 0 : (parseFloat(s.letterSpacing) / size) * 1000,
      leading: s.lineHeight === 'normal' ? size * 1.2 : parseFloat(s.lineHeight), align, fontUrl: faceUrl(family, weight),
    };
  });
}

export const pageChildren = (page) => page.evaluate(readChildren);
export const pageHosts = (page, selectors) => page.evaluate(readHosts, selectors);
export const pageFrame = (page, selectors, showsSource) => page.evaluate(`(${readFrame})(${JSON.stringify(selectors)}, ${JSON.stringify(showsSource)})`);
export const pageStyles = (page, selectors) => page.evaluate(readStyles, selectors);

const WEIGHT_NAMES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };

/** The PostScript name a font tool lists for `family` at `weight`, by the usual naming: Unbounded 300 is Unbounded-Light. Pure. */
export function conventionName(family, weight, italic) {
  const style = WEIGHT_NAMES[Math.round(weight / 100) * 100] || 'Regular';
  const tail = italic ? (style === 'Regular' ? 'Italic' : `${style}Italic`) : style;
  return `${family.replace(/\s+/g, '')}-${tail}`;
}

/** The local file a served font url points at, or null when it is not a file of this checkout. */
export function fontFileOf(url) {
  if (!url) return null;
  const file = path.join(REPO_ROOT, decodeURIComponent(new URL(url).pathname));
  return fs.existsSync(file) ? file : null;
}

/**
 * The PostScript name After Effects needs for the face: from the font file's own name table and, for a variable font, the named
 * instance at `weight`. fontkit is a dev dependency, so without it (or without a file) the usual naming stands, marked `guessed`.
 */
export async function postScriptName(file, { family, weight, italic }) {
  const guess = { name: conventionName(family, weight, italic), guessed: true };
  if (!file) return guess;
  let fontkit;
  try { fontkit = await import('fontkit'); } catch { return guess; }
  let font;
  try { font = fontkit.openSync(file); } catch { return guess; }
  const named = Object.entries(font.namedVariations || {});
  if (!named.length) return { name: font.postscriptName, guessed: false };
  const prefix = font.postscriptName.split('-')[0];
  const hit = named.find(([name, axes]) => axes.wght === weight && /italic/i.test(name) === italic);
  return hit ? { name: `${prefix}-${hit[0].replace(/\s+/g, '')}`, guessed: false } : { ...guess, name: conventionName(prefix, weight, italic) };
}
