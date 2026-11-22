import fs from 'node:fs';
import path from 'node:path';
import { ffmpegOrDie, drawtext, drawtextFont } from '../../lib/scratch.mjs';
import { openPreview } from '../preview-server.mjs';
import { die, ROOT, stackImages, tileInGrids, writeJsonAtomic } from './core.mjs';


// Every animation paused at one shared `currentTime`: the same seek --dom already relies on
// (`document.getAnimations()`), the one owner for "make this page hold still at time t" that --probe,
// --look and --layout all call instead of each inventing its own.
export async function seekPage(page, t) {
  return page.evaluate((ms) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, t * 1000);
}

// ── --probe: box, opacity, computed transform/filter, and every active animation's progress, for
// every element matching `sel` at one instant. Built because agents kept writing throwaway
// page.evaluate() scripts by hand to answer exactly this (one stalled twice doing it).
export async function runProbe(htmlPath, atS, sel, outDir) {
  const { page, url, close } = await openPreview(htmlPath, { width: 1920, height: 1080 });
  try {
    await page.goto(url, { waitUntil: 'load' });
    await seekPage(page, atS);
    const rows = await page.evaluate((selector) => {
      const shortSelInPage = (el) => (el.id ? `#${el.id}` : (el.className && String(el.className).trim() ? `.${String(el.className).split(' ')[0]}` : el.tagName.toLowerCase()));
      // getBoundingClientRect() on an SVG shape (not the root <svg>) is inconsistent across engines
      // once it carries its own rotate/scale, some report the rect of the UNTRANSFORMED bbox translated
      // only by position. getBBox() (the shape's own coordinate space) transformed through
      // getScreenCTM() (that space -> screen pixels, folding in every ancestor SVG and CSS transform)
      // is the one path that is always screen-space and always right; box comes from those two calls
      // on any nested SVG shape, getBoundingClientRect only for the root <svg> and every non-SVG element.
      function screenBox(el) {
        if (el instanceof SVGGraphicsElement && el.ownerSVGElement && el.getBBox && el.getScreenCTM) {
          const bbox = el.getBBox();
          const ctm = el.getScreenCTM();
          if (ctm) {
            const corners = [[bbox.x, bbox.y], [bbox.x + bbox.width, bbox.y], [bbox.x, bbox.y + bbox.height], [bbox.x + bbox.width, bbox.y + bbox.height]]
              .map(([px, py]) => ({ x: ctm.a * px + ctm.c * py + ctm.e, y: ctm.b * px + ctm.d * py + ctm.f }));
            const xs = corners.map((p) => p.x), ys = corners.map((p) => p.y);
            const x = Math.min(...xs), y = Math.min(...ys);
            return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
          }
        }
        return el.getBoundingClientRect();
      }
      return [...document.querySelectorAll(selector)].map((el) => {
        const r = screenBox(el);
        const cs = getComputedStyle(el);
        const anims = document.getAnimations().filter((a) => a.effect && a.effect.target === el).map((a) => {
          const t = a.effect.getComputedTiming();
          return { id: a.id || null, playState: a.playState, progress: t.progress, localTimeMs: t.localTime };
        });
        return {
          sel: shortSelInPage(el),
          box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          opacity: Number(cs.opacity), transform: cs.transform === 'none' ? null : cs.transform,
          filter: cs.filter === 'none' ? null : cs.filter, animations: anims,
        };
      });
    }, sel);
    if (!rows.length) die(`--probe: no element matched "${sel}" in ${htmlPath}`);
    fs.mkdirSync(outDir, { recursive: true });
    writeJsonAtomic(path.join(outDir, 'probe.json'), { html: htmlPath, at: atS, sel, rows });
    console.log(`\n  PROBE · ${path.basename(htmlPath)} @ ${atS}s, sel "${sel}"\n`);
    for (const row of rows) {
      console.log(`  ${row.sel}  box(${row.box.x},${row.box.y} ${row.box.w}x${row.box.h})  opacity ${row.opacity.toFixed(2)}`);
      if (row.transform) console.log(`    transform: ${row.transform}`);
      if (row.filter) console.log(`    filter: ${row.filter}`);
      for (const a of row.animations)
        console.log(`    animation${a.id ? ` "${a.id}"` : ''}: ${a.playState}, progress ${a.progress == null ? 'n/a' : a.progress.toFixed(3)}`);
      if (!row.animations.length) console.log('    (no active animation on this element)');
    }
    console.log(`\n  ✓ wrote ${path.relative(ROOT, path.join(outDir, 'probe.json'))}`);
  } finally { await close(); }
}

// ── --look: a still per requested time, gridded, optionally paired against the reference at the same
// timestamps. Built because 0 of 7 agents made a still frame before touching motion; layout faults
// then surfaced only after a full render.
export async function runLook(htmlPath, times, refPath, outDir) {
  const { page, url, close } = await openPreview(htmlPath, { width: 1920, height: 1080 });
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const longEdge = 1568;
  const tileW = Math.floor(longEdge / 3);
  const tileH = Math.round((tileW * 1080) / 1920);
  try {
    await page.goto(url, { waitUntil: 'load' });
    const cellFiles = [];
    for (const [i, t] of times.entries()) {
      await seekPage(page, t);
      const raw = path.join(outDir, `.raw_${i}.png`);
      await page.screenshot({ path: raw });
      const pageCell = path.join(outDir, `.page_${i}.png`);
      ffmpegOrDie(['-v', 'error', '-y', '-i', raw, '-frames:v', '1', '-vf',
        `scale=${tileW}:${tileH},drawtext=${drawtextFont}text='${drawtext(`page ${t.toFixed(2)}s`)}':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.65`,
        pageCell], pageCell, `look page cell ${i}`);
      fs.rmSync(raw, { force: true });
      if (!refPath) { cellFiles.push(pageCell); continue; }
      const refCell = path.join(outDir, `.ref_${i}.png`);
      ffmpegOrDie(['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', refPath, '-frames:v', '1', '-vf',
        `scale=${tileW}:${tileH},drawtext=${drawtextFont}text='${drawtext(`ref ${t.toFixed(2)}s`)}':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.65`,
        refCell], refCell, `look ref cell ${i}`);
      const pairOut = path.join(outDir, `.pair_${i}.png`);
      stackImages([refCell, pageCell], pairOut, 'v', tileW, tileH * 2);
      fs.rmSync(refCell, { force: true }); fs.rmSync(pageCell, { force: true });
      cellFiles.push(pairOut);
    }
    const cellH = refPath ? tileH * 2 : tileH;
    const gridPaths = tileInGrids(cellFiles, outDir, 'look', tileW, cellH, 9);
    for (const f of cellFiles) fs.rmSync(f, { force: true });
    const index = `# see --look: ${path.basename(htmlPath)}

${times.length} still(s) at ${times.map((t) => `${t}s`).join(', ')}${refPath ? `, paired with ${path.basename(refPath)} at the same timestamps (ref top, page bottom)` : ''}.

## Grids

${gridPaths.map((p) => `- ${path.relative(ROOT, p)}`).join('\n')}
`;
    fs.writeFileSync(path.join(outDir, 'index.md'), index);
    console.log(`✓ look: ${gridPaths.length} grid(s) -> ${path.relative(ROOT, path.join(outDir, 'index.md'))}`);
  } finally { await close(); }
}

// ── --layout: clipped/overflowing text, text overlapping text, off-frame elements, and two opaque
// full-frame shots visible at once, read straight off the DOM at each requested time. Built because
// one agent lost 8 minutes to a blanket `position:absolute`, another lost most of a session to two
// stacked full-frame shots showing the wrong background, neither caught until the render came back.
// One check per job, called from the single page.evaluate below (one round trip). Nested so each
// keeps its own low complexity instead of one long function carrying the whole rule set.
export async function domLayoutFindings(page) {
  return page.evaluate(() => {
    // Only when the box actually HIDES the overflow: an auto-sized span whose scrollWidth reads a
    // hair over its clientWidth (subpixel rounding, common on single-letter spans) shows nothing
    // clipped at all unless overflow is set to hide or clip it.
    function clippedTextFindings(textEls, shortSelInPage) {
      const findings = [];
      for (const el of textEls) {
        const cs = getComputedStyle(el);
        const clips = cs.overflow === 'hidden' || cs.overflow === 'clip' || cs.overflowX === 'hidden' || cs.overflowX === 'clip';
        if (clips && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
          findings.push({ kind: 'clipped-text', sel: shortSelInPage(el), text: el.textContent.trim().slice(0, 40) });
      }
      return findings;
    }

    function offFrameFindings(all, vw, vh, shortSelInPage) {
      const offFrame = (r) => r.width > 0 && r.height > 0 && (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh);
      return all.filter((el) => offFrame(el.getBoundingClientRect())).map((el) => ({ kind: 'off-frame', sel: shortSelInPage(el) }));
    }

    function textOverlapFindings(textEls) {
      const overlapArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const findings = [];
      for (let i = 0; i < textEls.length; i++) {
        for (let j = i + 1; j < textEls.length; j++) {
          const a = textEls[i], b = textEls[j];
          if (a.contains(b) || b.contains(a)) continue;
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          const areaA = ra.width * ra.height, areaB = rb.width * rb.height;
          if (areaA && areaB && overlapArea(ra, rb) / Math.min(areaA, areaB) > 0.25)
            findings.push({ kind: 'text-overlap', a: a.textContent.trim().slice(0, 30), b: b.textContent.trim().slice(0, 30) });
        }
      }
      return findings;
    }

    // "Opaque" means it actually PAINTS a near-full-frame surface (a solid background-color, or an
    // image/video), not merely CSS `opacity:1`: a bare positioning wrapper is opacity:1 and paints
    // nothing, and a decorative radial-gradient background is meant to layer under other art. Neither
    // is the "two full-frame shots hiding one another" failure this check exists for.
    // ponytail: does not account for `clip-path`, so a fully clipped full-frame layer (a wipe parked
    // at zero width) can still read as stacked; check the grid if this fires oddly.
    function stackedOpaqueFindings(all, vw, vh, shortSelInPage) {
      const frameArea = vw * vh;
      const paintsSolid = (el) => {
        const cs = getComputedStyle(el);
        if (['IMG', 'VIDEO', 'CANVAS'].includes(el.tagName)) return true;
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return false;
        const m = /rgba?\([^)]*?(?:,\s*([\d.]+)\s*)?\)/.exec(cs.backgroundColor);
        const alpha = m && m[1] !== undefined ? Number(m[1]) : (cs.backgroundColor && cs.backgroundColor !== 'transparent' ? 1 : 0);
        return alpha >= 0.95;
      };
      const fullFrame = all.filter((el) => {
        const r = el.getBoundingClientRect();
        return Number(getComputedStyle(el).opacity) >= 0.95 && r.width * r.height >= frameArea * 0.9 && paintsSolid(el);
      });
      const findings = [];
      for (let i = 0; i < fullFrame.length; i++) {
        for (let j = i + 1; j < fullFrame.length; j++) {
          const a = fullFrame[i], b = fullFrame[j];
          if (!a.contains(b) && !b.contains(a)) findings.push({ kind: 'stacked-opaque', a: shortSelInPage(a), b: shortSelInPage(b) });
        }
      }
      return findings;
    }

    const vw = window.innerWidth, vh = window.innerHeight;
    const shortSelInPage = (el) => (el.id ? `#${el.id}` : (el.className && String(el.className).trim() ? `.${String(el.className).split(' ')[0]}` : el.tagName.toLowerCase()));
    const isVisible = (el) => {
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    };
    const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    const all = [...document.querySelectorAll('body *')].filter(isVisible);
    const textEls = all.filter(hasOwnText);
    return [
      ...clippedTextFindings(textEls, shortSelInPage),
      ...offFrameFindings(all, vw, vh, shortSelInPage),
      ...textOverlapFindings(textEls),
      ...stackedOpaqueFindings(all, vw, vh, shortSelInPage),
    ];
  });
}

export async function runLayout(htmlPath, times, outDir) {
  const { page, url, close } = await openPreview(htmlPath, { width: 1920, height: 1080 });
  fs.mkdirSync(outDir, { recursive: true });
  try {
    await page.goto(url, { waitUntil: 'load' });
    const perTime = [];
    for (const t of times) { await seekPage(page, t); perTime.push({ t, findings: await domLayoutFindings(page) }); }
    const total = perTime.reduce((n, p) => n + p.findings.length, 0);
    writeJsonAtomic(path.join(outDir, 'layout.json'), { html: htmlPath, times, perTime, faultCount: total });

    const lines = [`# see --layout: ${path.basename(htmlPath)}`, '', `${times.length} time(s) checked, ${total} fault(s).`, ''];
    for (const p of perTime) {
      lines.push(`## t=${p.t}s`);
      lines.push(...(p.findings.length ? p.findings.map((f) => `- ${f.kind}: ${JSON.stringify(f)}`) : ['- clean']));
      lines.push('');
    }
    fs.writeFileSync(path.join(outDir, 'layout.md'), lines.join('\n'));

    console.log(`\n  LAYOUT · ${path.basename(htmlPath)}, ${times.length} time(s)\n`);
    for (const p of perTime)
      console.log(`  t=${p.t}s: ${p.findings.length} fault(s)${p.findings.length ? ` -> ${p.findings.map((f) => f.kind).join(', ')}` : ''}`);
    console.log(`\n  ✓ wrote ${path.relative(ROOT, path.join(outDir, 'layout.md'))}`);
  } finally { await close(); }
}
