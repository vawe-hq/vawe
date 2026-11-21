// core/engine/page-layer.js: render one layer of a page on a transparent ground. harness/media/render-page.mjs injects
// installPageLayer with evaluateOnNewDocument (its source, via toString(), so it may reference nothing outside its own body);
// layerCss builds the style it installs. Only paint is hidden, never layout, so every box, every measurement and every
// frame hook sees the same page as the full render.

const NO_GLYPHS = 'color: transparent !important; -webkit-text-fill-color: transparent !important; -webkit-text-stroke-color: transparent !important; '
  + 'text-shadow: none !important; text-decoration-color: transparent !important; caret-color: transparent !important';
const NO_BOX = 'background: none !important; border-color: transparent !important; box-shadow: none !important; outline-color: transparent !important';

export const OFF_ATTR = 'data-vawe-off';
export const BARE_ATTR = 'data-vawe-bare';

const subtree = (sel) => `${sel}, ${sel} *`;

/**
 * The style of one layer. `hide`: top-level selectors whose whole subtree must not paint. `noText`: selectors whose glyphs must not
 * paint (their boxes and backgrounds still do). `textOnly`: one selector whose subtree alone paints, as the page styles it;
 * installPageLayer marks every other element off and strips the boxes of its ancestors. Pure.
 */
export function layerCss({ hide = [], noText = [], textOnly = null }) {
  const rules = ['html, body { background: transparent !important; }'];
  if (hide.length) rules.push(`:where(${hide.map(subtree).join(', ')}) { visibility: hidden !important; }`);
  if (textOnly) {
    rules.push(`[${OFF_ATTR}] { visibility: hidden !important; }`);
    rules.push(`[${BARE_ATTR}] { ${NO_BOX}; }`, `[${BARE_ATTR}]::before, [${BARE_ATTR}]::after { visibility: hidden !important; }`);
  }
  if (noText.length) rules.push(`:is(${noText.map(subtree).join(', ')}) { ${NO_GLYPHS}; }`);
  return rules.join('\n');
}

// Runs in the page before any page script; the marks and the background-clip: text check need the built page, so they run on load.
// Text painted through background-clip: text is its background, so a glyph-free copy drops the background image too.
export function installPageLayer({ css, noText = [], textOnly = null }) {
  const add = () => {
    const style = document.createElement('style');
    style.id = 'vawe-layer';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  };
  const clipText = () => {
    for (const sel of noText) {
      for (const el of document.querySelectorAll(`${sel}, ${sel} *`)) {
        const s = getComputedStyle(el);
        if ([s.backgroundClip, s.webkitBackgroundClip].includes('text')) el.style.setProperty('background-image', 'none', 'important');
      }
    }
  };
  const markTextOnly = () => {
    const target = textOnly && document.querySelector(textOnly);
    if (!target) return;
    for (const el of document.body.querySelectorAll('*')) {
      if (el === target || target.contains(el)) continue;
      el.setAttribute(el.contains(target) ? 'data-vawe-bare' : 'data-vawe-off', '');
    }
  };
  document.addEventListener('DOMContentLoaded', add, { once: true });
  window.addEventListener('load', () => { clipText(); markTextOnly(); }, { once: true });
}
