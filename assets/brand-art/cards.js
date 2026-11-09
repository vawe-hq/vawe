import { rng } from './art.js';

// The share-card system: each site page's scene, composition, ink and copy; each blog topic's scene and how a post's
// slug varies it. card.html paints a still from it, loop.html a seamless loop.

// Towers drawn in toward the road, for a card whose copy takes the left half.
const NEAR_TOWERS = [
  { o: [0.42, -0.3], q: [1, -1], zn: 1.3, zf: 3.4 },
  { o: [0.5, 0.25], q: [1, 1], zn: 1.2, zf: 3.6 },
  { o: [0.85, -0.85], q: [1, -1], zn: 1, zf: 2.8 },
  { o: [0.9, 0.7], q: [1, 1], zn: 1, zf: 2.5 },
];

const SEARCH = {
  f: 0.9, vx: 0.68, vy: 0.5, camY: 0.42, z0: 1.7, zg: 1.08, rows: 40, cols: 22, pitch: 0.4, tall: 1.4, crawlers: 22, figH: 0.07, fig: [0.3, 1.9], left: 0.56, groundX: -0.15, fog: 0.42, fogZ: 14,
  haze: [[0.62, 0.5, 0.5], [0.8, 0.6, 0.55], [0.98, 0.5, 0.5]],
  cited: { x: 0.5, z: 3.2, w: 0.26, h: 0.95 }, citedFrom: [0.0, 0.42, 2.0],
  beams: [{ x: -0.2, y: 0.3, z: 5, a: -1.95, w: 0.022 }, { x: 2.4, y: 0.5, z: 6, a: -1.25, w: 0.022 }, { x: 1.2, y: 0.2, z: 11, a: -1.62, w: 0.018 }],
};

// The three searchlights swing at one tempo, out of step with each other; the beam on the cited page stays.
const swing = (p) => [0, 2.1, 4.2].map((k, i) => (0.24 - 0.04 * i) * Math.sin(2 * Math.PI * p + k));

export const PAGES = {
  '/blog': {
    scene: 'pages', ink: 'a',
    h: 'Notes from building vawe, with the numbers.',
    sub: 'What broke, what we measured<br>and what we changed.',
    lay: {
      f: 0.9, vx: 0.76, vy: 0.5, frameW: 1.1, bridge: ['s6', 's3'], bridgeZ: 2.6, bridgeY: 0.07, figU: 0.5, figH: 0.07,
      stacks: [
        { id: 's1', r: [-0.3, -1.0, 0.0, -0.4], zt: 1.5 },
        { id: 's2', r: [0.14, -1.0, 0.62, -0.34], zt: 1.85 },
        { id: 's3', r: [0.3, -0.22, 0.8, 0.28], zt: 1.55 },
        { id: 's4', r: [0.12, 0.42, 0.62, 1.0], zt: 1.7 },
        { id: 's5', r: [-0.34, 0.38, -0.04, 1.0], zt: 2.0 },
        { id: 's6', r: [-0.32, -0.24, -0.12, 0.26], zt: 1.9 },
      ],
    },
    // The loop's moving parts at loop fraction p: the film below plays, a band of light crosses the stacks, the star
    // twinkles. calm keeps the band off the copy.
    loop: (p) => ({ play: p, sweep: p, twinkle: 1 + 0.35 * Math.sin(4 * Math.PI * p), calm: 0.08, feather: 0.14 }),
  },
  '/resources': {
    scene: 'catalog', ink: 'b',
    h: 'Resources for motion graphics by code.',
    sub: 'Easing curves, video components, files<br>for AI agents, guides and comparisons.',
    lay: {
      f: 0.9, vx: 0.7, vy: 0.5, floorY: 0.5, rowH: 0.26, colZ: 0.5, rows: 26, rightX: 0.62, leftX: 2.4, leftV: 0.2, open: [1, 3], pull: 0.5,
      cards: 9, figX: 0.1, figZ: 1.9, figH: 0.075, lane: [-0.06, 0.3], starDX: 0, starUp: 0.1,
    },
    loop: (p) => ({ pull: 0.5 + 0.12 * Math.sin(2 * Math.PI * p), liftCard: 4, lift: 0.1 * Math.sin(Math.PI * p) ** 4 }),
  },
  '/springs': {
    scene: 'ease', ink: 'a',
    h: 'Spring animation presets as CSS.',
    sub: 'Stiffness, damping and settle time<br>for react-spring, Motion and SwiftUI.',
    lay: { f: 0.9, vx: 0.6, vy: 0.48, floorY: 0.62, origin: [0.0, 2.2], span: [1.55, 0.9], height: 1.5, track: 0.5, bez: [0.34, 1.56, 0.64, 1], frames: 21, figU: -0.03, figH: 0.075, starUp: 0.07 },
  },
  '/easing': {
    scene: 'ease', ink: 'a',
    h: 'Easing functions as CSS.',
    sub: 'Preview a curve, copy its cubic-bezier()<br>or linear(), compare three side by side.',
    lay: { f: 0.9, vx: 0.6, vy: 0.48, floorY: 0.62, origin: [0.0, 2.2], span: [1.55, 0.9], height: 1.5, track: 0.5, bez: [0.65, 0, 0.35, 1], frames: 21, figU: -0.03, figH: 0.075, starUp: 0.07 },
    // A preview loop: the dot runs the curve in 80% of the loop, holds at the end, then starts again.
    loop: (p) => ({ run: Math.min(1, p / 0.8) }),
  },
  '/video-components': {
    scene: 'lanes', ink: 'b',
    h: 'Video components for films in HTML.',
    sub: 'Each one a clip and a markdown file:<br>when to use it, the snippet, the sound.',
    lay: {
      f: 0.95, vx: 0.72, vy: 0.44, figZ: 1.6,
      towers: NEAR_TOWERS,
    },
    loop: (p) => ({ play: p }),
  },
  '/inspiration': {
    scene: 'cinema', ink: 'a',
    h: 'Motion video inspiration.',
    sub: 'Films made with Claude and other AI,<br>each one credited to its creator.',
    lay: {
      f: 0.9, vx: 0.6, vy: 0.5, floorY: 0.55, curtain: 0.12, lens: [0.12, 0.47, 1.3], fig: [0.1, 1.22], figH: 0.075, aisle: 0.12, rowGap: 0.12,
      seats: [0.25, 3.2], starUV: [0.45, 0.3], screen: { x0: 0.6, z0: 3.2, x1: 3.6, z1: 6.0, top: -1.5, bot: 0.15 },
    },
    loop: (p) => ({ flicker: 1 + 0.07 * Math.sin(6 * Math.PI * p) + 0.05 * Math.sin(14 * Math.PI * p), drift: p }),
  },
  '/problems': {
    scene: 'stair', ink: 'b',
    h: 'The hard problems<br>of agent video.',
    sub: 'A page takes a minute to write.<br>A film that looks designed does not.',
    lay: {
      f: 0.95, vx: 0.68, vy: 0.62, cardW: 0.2, cardH: 0.3, depth: 0.25, starUp: 0.6, figStep: 0, figU: 0.4, figH: 0.06,
      steps: [[-0.04, 0.3, 1.2], [0.1, 0.08, 1.5], [0.24, -0.16, 1.85], [0.38, -0.42, 2.25], [0.52, -0.7, 2.7], [0.66, -1.0, 3.2]],
    },
    loop: (p) => ({ twinkle: 1 + 0.45 * (0.5 - 0.5 * Math.cos(4 * Math.PI * p)) }),
  },
  '/determinism': {
    scene: 'strip', ink: 'a',
    h: 'Same page in.<br>Same frames out.',
    sub: 'Ask for the frame at 4.2 s twice,<br>in any order: it comes back the same.',
    lay: { f: 0.95, vy: 0.42, camY: 0.32, pageEnd: 1.6, pageW: 0.5, vx: 0.74, gates: [2.6, 4, 6.2, 9.5], figZ: 1.9, figH: 0.075 },
    loop: (p) => ({ run: p }),
  },
  '/when-determinism-matters': {
    scene: 'strip', ink: 'b',
    h: 'When determinism matters.',
    sub: 'Byte-identical frames are checkable.<br>They are rarely why you pick an engine.',
    lay: { f: 1.05, vy: 0.42, camY: 0.26, pageEnd: 1.3, pageW: 0.45, vx: 0.8, gates: [3.4], figZ: 2.0, figH: 0.08 },
    loop: (p) => ({ run: p }),
  },
  '/ai-agents': {
    scene: 'stair', ink: 'a',
    h: 'Let an agent write the video.',
    sub: 'One HTML page: CSS, Web Animations,<br>SVG, canvas or three.js.',
    lay: {
      f: 0.95, vx: 0.66, vy: 0.6, cardW: 0.22, cardH: 0.32, depth: 0.25, starUp: 0.6, figStep: 1, figU: 0.55, figH: 0.06, figPage: true,
      steps: [[0.0, 0.3, 1.2], [0.15, 0.08, 1.5], [0.3, -0.16, 1.85], [0.45, -0.42, 2.25], [0.6, -0.7, 2.7], [0.75, -1.0, 3.2]],
    },
    loop: (p) => ({ type: p }),
  },
  '/remotion-alternatives': {
    scene: 'search', ink: 'a',
    h: 'Remotion alternatives, by category.',
    sub: 'A hosted JSON API, or an engine<br>you run yourself.',
    lay: { ...SEARCH, cited: { x: 1.1, z: 3.6, w: 0.24, h: 1.05 }, citedFrom: [0.4, 0.4, 2.0] },
    loop: (p) => ({ swing: swing(p) }),
  },
  '/hyperframes-alternatives': {
    scene: 'search', ink: 'b',
    h: 'HyperFrames alternatives.',
    sub: 'HTML and seekable animation to MP4:<br>four tools worth a look.',
    lay: { ...SEARCH, vx: 0.72, vy: 0.56, camY: 0.5 },
    loop: (p) => ({ swing: swing(p) }),
  },
  '/launch-video': {
    scene: 'cinema', ink: 'b',
    h: 'A launch video from the real site.',
    sub: 'The real UI, logo and palette of the<br>product, carried into motion.',
    lay: {
      f: 0.9, vx: 0.58, vy: 0.5, floorY: 0.55, curtain: 0.12, lens: [0.3, 0.47, 1.3], fig: [0.28, 1.22], figH: 0.075, aisle: 0.3, rowGap: 0.12,
      seats: [0.2, 3.4], starUV: [0.55, 0.35], screen: { x0: 0.45, z0: 3.4, x1: 2.6, z1: 5.0, top: -1.4, bot: 0.15 },
    },
    loop: (p) => ({ drift: p }),
  },
  '/features': {
    scene: 'pages', ink: 'b',
    h: 'What the engine decides.',
    sub: 'What one page can use, the same frames<br>every time, and the loop that judges a film.',
    lay: {
      f: 0.75, vx: 0.74, vy: 0.56, frameW: 1.2, bridge: ['s6', 's3'], bridgeZ: 2.6, bridgeY: 0.07, figU: 0.4, figH: 0.06,
      stacks: [
        { id: 's1', r: [-0.3, -1.0, 0.0, -0.4], zt: 1.6 },
        { id: 's2', r: [0.14, -1.0, 0.62, -0.34], zt: 1.95 },
        { id: 's3', r: [0.3, -0.22, 0.8, 0.28], zt: 1.65 },
        { id: 's4', r: [0.12, 0.42, 0.62, 1.0], zt: 1.8 },
        { id: 's5', r: [-0.34, 0.38, -0.04, 1.0], zt: 2.1 },
        { id: 's6', r: [-0.32, -0.24, -0.12, 0.26], zt: 2.0 },
      ],
    },
    loop: (p) => ({ play: p, twinkle: 1 + 0.35 * Math.sin(4 * Math.PI * p) }),
  },
  '/about': {
    scene: 'lanes', ink: 'a',
    h: 'About vawe.',
    sub: 'One HTML page in, one film out.<br>Open source under Apache-2.0.',
    lay: {
      f: 0.95, vx: 0.68, vy: 0.42, figZ: 1.5, road: 0.12,
      towers: [
        { o: [0.95, -0.3], q: [1, -1], zn: 1.3, zf: 3.4 },
        { o: [1.0, 0.25], q: [1, 1], zn: 1.2, zf: 3.6 },
        { o: [0.55, -0.7], q: [1, -1], zn: 1, zf: 2.8 },
        { o: [0.5, 0.55], q: [1, 1], zn: 1, zf: 2.5 },
      ],
    },
    loop: (p) => ({ twinkle: 1 + 0.35 * Math.sin(4 * Math.PI * p) }),
  },
  '/roadmap': {
    scene: 'lanes', ink: 'b',
    h: 'Roadmap: now, next, later.',
    sub: 'The order of work on vawe, with no dates.<br>Each item links to its problem.',
    lay: {
      f: 0.95, vx: 0.7, vy: 0.46, figZ: 1.6,
      towers: [
        { o: [0.45, -0.35], q: [1, -1], zn: 1, zf: 2.0 },
        { o: [0.55, 0.35], q: [1, 1], zn: 1, zf: 3.0 },
        { o: [-0.85, 1.0], q: [-1, 1], zn: 1, zf: 2.4 },
      ],
    },
    loop: (p) => ({ play: p }),
  },
};

// The video-type pages reuse a sibling's scene with their own words; no loop, so no og:video.
const { loop: _launchLoop, ...LAUNCH_STILL } = PAGES['/launch-video'];
const { loop: _blogLoop, ...BLOG_STILL } = PAGES['/blog'];
PAGES['/product-showcase-video'] = {
  ...LAUNCH_STILL, ink: 'a',
  h: 'A product showcase video from code.',
  sub: 'The real product, one feature<br>per beat, about 20 seconds.',
};
PAGES['/explainer-video'] = {
  ...BLOG_STILL, ink: 'b',
  h: 'An explainer video from code.',
  sub: 'Facts first, then one idea per scene.',
};
PAGES['/agentic-video-editing'] = {
  ...LAUNCH_STILL, ink: 'a',
  h: 'Agentic video editing.',
  sub: 'Your coding agent reads the clips<br>and cuts the film.',
};
PAGES['/edit-video-with-claude-code'] = {
  ...BLOG_STILL, ink: 'a',
  h: 'Edit video with Claude Code.',
  sub: 'A folder of clips in,<br>an MP4 out.',
};

// Blog posts: each scene's composition, varied by the post's seed within safe ranges.
const POST_LAY = {
  stair: (R) => {
    const n = 4 + Math.floor(R() * 3), x0 = -0.14 + 0.1 * R(), dx = 0.08 + 0.12 * R(), rise = 0.18 + 0.14 * R(), grow = 1.15 + 0.15 * R();
    const bend = 0.12 * (R() - 0.5);
    return {
      f: 0.95, vx: 0.64 + 0.08 * R(), vy: 0.52 + 0.14 * R(), cardW: 0.18 + 0.07 * R(), cardH: 0.26 + 0.1 * R(), depth: 0.25,
      starUp: 0.4 + 0.3 * R(), figStep: Math.floor(R() * (n - 1)), figU: 0.3 + 0.4 * R(), figH: 0.06,
      steps: Array.from({ length: n }, (_, i) => [x0 + dx * i + bend * i * i, 0.3 - rise * i, 1.2 * grow ** i]),
    };
 },
  strip: (R) => {
    const gates = Array.from({ length: 2 + Math.floor(R() * 4) }, () => 2.4 + 9 * R() ** 1.2);
    return { f: 0.85 + 0.15 * R(), vy: 0.38 + 0.1 * R(), camY: 0.28 + 0.08 * R(), pageEnd: 1.4 + 0.5 * R(), pageW: 0.4 + 0.2 * R(), vx: 0.68 + 0.08 * R(), gates, figZ: 1.9 + 0.6 * R(), figH: 0.075 };
 },
  lanes: (R) => {
    const towers = NEAR_TOWERS.map((t) => ({ ...t, o: [t.o[0] + 0.25 * (R() - 0.5), t.o[1] + 0.25 * (R() - 0.5)], zn: t.zn + 0.3 * R(), zf: t.zf + 1.2 * (R() - 0.3) }));
    return { f: 0.9 + 0.1 * R(), vx: 0.68 + 0.08 * R(), vy: 0.38 + 0.12 * R(), figZ: 1.4 + 0.5 * R(), road: 0.05 + 0.05 * R(), towers: towers.slice(0, 2 + Math.floor(R() * 3)) };
 },
  wave: (R) => ({
    f: 0.9, vx: 0.66 + 0.08 * R(), vy: 0.44 + 0.12 * R(), floorY: 0.28 + 0.12 * R(), amp: 0.62 + 0.12 * R(), target: 0.62, step: 1.035 + 0.01 * R(),
    phase: R() * 6.28, beat: 2 + 3 * R(), left: [0.5, 2.2, 0.7], right: [0.42, 0.9, 0.96], fillZ: 0.7, road: 0.05, figZ: 1.5 + 0.4 * R(), figH: 0.07,
  }),
  ease: (R) => ({
    f: 0.9, vx: 0.6, vy: 0.48, floorY: 0.62, origin: [0.0, 2.2], span: [1.55, 0.9], height: 1.5, track: 0.5,
    bez: [0.15 + 0.7 * R(), -0.1 + 0.3 * R(), 0.15 + 0.7 * R(), 0.8 + 0.3 * R()], frames: 15 + Math.floor(R() * 9), figU: -0.03, figH: 0.075, starUp: 0.07,
  }),
  cinema: (R) => {
    const x0 = 0.5 + 0.35 * R(), z0 = 2.9 + 0.6 * R();
    return {
      f: 0.9, vx: 0.56 + 0.08 * R(), vy: 0.46 + 0.08 * R(), floorY: 0.55, curtain: 0.12, lens: [0.12 + 0.2 * R(), 0.47, 1.3], fig: [0.1, 1.22], figH: 0.075, aisle: 0.12, rowGap: 0.12,
      seats: [0.25, 3.2], starUV: [0.35 + 0.35 * R(), 0.26 + 0.14 * R()],
      screen: { x0, z0, x1: x0 + 2.4 + 0.8 * R(), z1: z0 + 2.4 + 0.8 * R(), top: -1.3 - 0.4 * R(), bot: 0.15 },
    };
 },
  pages: (R) => {
    const j = (v, k) => v + k * (R() - 0.5);
    const stacks = PAGES['/blog'].lay.stacks.map((s) => ({ ...s, r: s.r.map((v) => j(v, 0.1)), zt: j(s.zt, 0.3) }));
    return { ...PAGES['/blog'].lay, f: 0.85 + 0.1 * R(), vx: 0.72 + 0.08 * R(), vy: 0.42 + 0.16 * R(), frameW: 0.95 + 0.25 * R(), figU: 0.25 + 0.5 * R(), stacks };
 },
  catalog: (R) => ({
    ...PAGES['/resources'].lay, vx: 0.64 + 0.1 * R(), vy: 0.46 + 0.1 * R(), rowH: 0.24 + 0.06 * R(), rightX: 0.6 + 0.18 * R(),
    open: [Math.floor(R() * 3), 1 + Math.floor(R() * 4)], pull: 0.4 + 0.25 * R(), cards: 7 + Math.floor(R() * 6), figX: 0.1 * (R() - 0.5), figZ: 1.7 + 0.4 * R(),
  }),
  search: (R) => ({ ...SEARCH, vx: 0.62 + 0.14 * R(), vy: 0.42 + 0.16 * R(), camY: 0.34 + 0.18 * R() }),
};

// A topic's scenes all fit its posts; the slug's seed picks one, so a topic's posts do not all share one picture,
// and prints about half of them in the other ink.
export const TOPICS = {
  agents: { ink: 'b', scenes: ['stair', 'pages', 'search'] },
  determinism: { ink: 'a', scenes: ['strip', 'lanes'] },
  rendering: { ink: 'b', scenes: ['lanes', 'strip', 'catalog'] },
  audio: { ink: 'b', scenes: ['wave'] },
  motion: { ink: 'a', scenes: ['ease', 'wave', 'cinema'] },
  watching: { ink: 'a', scenes: ['cinema'] },
  'how-to': { ink: 'a', scenes: ['pages', 'catalog', 'stair'] },
  site: { ink: 'b', scenes: ['catalog', 'pages'] },
};

const OTHER = { a: 'b', b: 'a' };

function fnv1a(s) {
  let h = 0x811c9dc5;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return h >>> 0;
}

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The scene, ink, composition, seed and copy markup for ?route=<path> (with &word=<w>, one big word: a /resources tile), or for ?post=<slug> with the post's title, its
// section's label and its topic as title, section and topic.
export function cardFor(q) {
  const slug = q.get('post');
  if (slug) {
    const T = TOPICS[q.get('topic')], seed = fnv1a(slug);
    if (!T) throw new Error(`topic must be one of ${Object.keys(TOPICS).join(', ')}, got "${q.get('topic')}"`);
    const scene = T.scenes[(seed >>> 20) % T.scenes.length];
    return {
      kind: 'post', scene, ink: q.get('ink') || (seed & 0x10000 ? OTHER[T.ink] : T.ink), lay: POST_LAY[scene](rng(seed)), seed: seed % 9973,
      html: `<p class="kicker">Blog · ${escape(q.get('section'))}</p><h1>${escape(q.get('title'))}</h1><p class="mono"><span>vawe.dev/blog/${slug}</span></p>`,
    };
  }
  const route = q.get('route') || '/blog', P = PAGES[route];
  if (!P) throw new Error(`no card for route "${route}": the routes are ${Object.keys(PAGES).join(', ')}`);
  const word = q.get('word');
  // Measured on the 1600 px tile: past 6 letters at 260 px the word runs into the scene art.
  const px = word && Math.min(260, Math.round(1300 / word.length));
  return {
    kind: word ? 'tile' : 'page', scene: P.scene, ink: q.get('ink') || P.ink, lay: P.lay, loop: P.loop, seed: 7,
    html: word ? `<h1 style="font-size:${px}px">${escape(word)}</h1>` : `<h1>${P.h}</h1><p class="sub">${P.sub}</p><p class="mono"><span>vawe.dev${route}</span></p>`,
  };
}
