// The page-source traps: a live clock, an unseeded Math.random, a CSS transition, a WebGL canvas that never
// redraws, a path that is not relative, a unit calc, an await the renderer does not wait for. Source-level:
// they read the page's own text, not a booted page, so this file imports no browser.
// Each finding is { code, severity, index, message, where, fix }; `index` is the offset in `src`.
const ABSOLUTE_PATH = /^(?:\/|file:|~\/|[A-Za-z]:[\\/]|https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]))/;
const AWAITED_BY_RENDERER = /fetch\s*\(|document\.fonts\.(?:ready|load)|\.decode\s*\(\s*\)/;

function moduleScripts(src) {
  return [...src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((m) => /\btype\s*=\s*["']module["']/i.test(m[1]))
    .map((m) => ({ code: m[2], offset: m.index + m[0].length - '</script>'.length - m[2].length }));
}

// Replace each match of `re` with `repl`; `at[i]` is the offset in the original text of character i of the result.
function replaceMapped({ text, at }, re, repl) {
  let out = '';
  const map = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    for (let i = last; i < m.index; i++) { out += text[i]; map.push(at[i]); }
    for (const c of repl) { out += c; map.push(at[m.index]); }
    last = m.index + m[0].length;
  }
  for (let i = last; i < text.length; i++) { out += text[i]; map.push(at[i]); }
  return { text: out, at: map };
}

// Each `await` at brace, paren and bracket depth 0 of a script body: the rest of its statement and its offset in `code`.
function topLevelAwaits(code) {
  const start = { text: code, at: [...code].map((_, i) => i) };
  const { text, at } = replaceMapped(replaceMapped(start, /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ' '), /(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
  const found = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if ('{(['.includes(c)) depth++;
    else if ('})]'.includes(c)) depth--;
    else if (depth === 0 && text.startsWith('await', i) && !/[\w$.]/.test(text[i - 1] || ' ') && /[\s(]/.test(text[i + 5] || ' '))
      found.push({ line: text.slice(i, i + 80).split(/[;\n]/)[0], index: at[i] });
  }
  return found;
}

function sourceTraps(src, isFilm) {
  const out = [];
  for (const m of isFilm ? src.matchAll(/\b(src|href|poster)\s*=\s*["']\s*([^"']+)["']|url\(\s*["']?([^"')]+)/gi) : []) {
    const ref = (m[2] || m[3] || '').trim();
    if (ABSOLUTE_PATH.test(ref) && !ref.startsWith('//'))
      out.push({ code: 'absolute-path', severity: 'block', index: m.index, message: `${m[1] ? `${m[1]}="${ref}"` : `url(${ref})`} is an absolute or local-server path`, where: m[1] || 'url()', fix: 'use a path relative to the page (assets/name.png) and keep the file in films/<name>/assets/: an absolute path breaks on any other machine' });
  }
  const calc = /\bcalc\([^)]*\bvar\(--v[wh]\)\s*\*\s*-?[\d.]+px|\b[\d.]+px\s*\*\s*var\(--v[wh]\)/.exec(src);
  if (calc)
    out.push({ code: 'unit-calc', severity: 'advise', index: calc.index, message: 'a calc() multiplies --vw/--vh by a number with px', where: 'style', fix: '--vw and --vh already hold a unit (1920px): write calc(var(--vh) * 0.11), never * 0.11px' });
  for (const { code, offset } of moduleScripts(src))
    for (const a of topLevelAwaits(code).filter((x) => !AWAITED_BY_RENDERER.test(x.line)))
      out.push({ code: 'module-await', severity: 'advise', index: offset + a.index, message: `module-level "${a.line.trim()}"`, where: 'script', fix: 'the renderer waits only for an image decode, a fetch and document.fonts.ready, so frame 0 paints before your vawe.onFrame exists: await only those, or register the hook first and await inside it' });
  return out;
}

const RULES = [
  { code: 'live-clock', re: /requestAnimationFrame\s*\(/, message: 'page uses requestAnimationFrame', where: 'script', fix: 'drive motion from vawe.onFrame((t) => {...}) instead: the render clock seeks CSS/WAAPI/SMIL and calls every onFrame hook with film time t; a live rAF loop never runs under headless capture and makes the frame depend on wall-clock timing' },
  { code: 'live-clock', re: /new\s+THREE\.Clock\b|\.getDelta\s*\(/, message: 'page uses THREE.Clock', where: 'script', fix: 'pose every object from the t argument vawe.onFrame((t) => {...}) hands you, never from an accumulated delta: renderFrame(n) must stay a pure function of n' },
  { code: 'live-clock', re: /\bperformance\.now\s*\(/, message: 'page reads performance.now()', where: 'script', fix: 'use the t argument vawe.onFrame((t) => {...}) already hands you' },
  { code: 'live-clock', re: /\bDate\.now\s*\(/, message: 'page reads Date.now()', where: 'script', fix: 'use the t argument vawe.onFrame((t) => {...}) already hands you' },
  { code: 'unseeded-random', re: /\bMath\.random\s*\(/, message: 'page calls unseeded Math.random()', where: 'script', fix: 'seed a small PRNG (the rng(seed) shape in core/motion/springs.js) so the same seed rebuilds the identical scene across render orders and re-renders' },
  { code: 'timer', re: /\bset(?:Timeout|Interval)\s*\(/, message: 'page uses setTimeout/setInterval', where: 'script', fix: 'the render clock fires a timer only when a seek passes its due time, so a timer that starts motion or changes state lands on the frame after its delay, never mid-frame: put the change in a keyframe table or an element.animate() delay, or compute it from t in window.seek(t)' },
  { code: 'css-transition', re: /(^|[\s;{"'])transition(-property)?\s*:\s*(?!none\b)[^;}]*/m, lead: 1, message: 'page uses a CSS transition for motion', where: 'style', fix: 'a transition starts from a class or style change and runs on its own start time, so a seek cannot place it at t: use @keyframes or element.animate() (both are seeked), or set the value directly from t in window.seek(t)' },
];

/** The traps in page source `src`: [{ code, severity, index, message, where, fix }]. `film` turns on the path check. */
export function pageTraps(src, { film = false } = {}) {
  const out = sourceTraps(src, film);
  for (const r of RULES) {
    const m = r.re.exec(src);
    if (m) out.push({ code: r.code, severity: 'advise', index: m.index + (r.lead ? m[1].length : 0), message: r.message, where: r.where, fix: r.fix });
  }
  const webgl = src.search(/WebGLRenderer/);
  if (webgl >= 0 && !/preserveDrawingBuffer/.test(src))
    out.push({ code: 'webgl-buffer', severity: 'advise', index: webgl, message: 'a WebGLRenderer is built without preserveDrawingBuffer', where: 'script', fix: 'pass {preserveDrawingBuffer:true}, or the capture (a screenshot taken after the draw call) can read a blank/cleared buffer depending on the browser\'s own swap timing' });
  if (webgl >= 0 && !/\.onFrame\s*\(/.test(src))
    out.push({ code: 'webgl-no-onframe', severity: 'advise', index: webgl, message: 'page draws WebGL but registers no onFrame hook', where: 'script', fix: 'call vawe.onFrame((t) => { renderer.render(scene, camera); }) so the render clock actually redraws the canvas each frame; otherwise the capture reads whatever the canvas happened to hold from page load' });
  return out;
}
