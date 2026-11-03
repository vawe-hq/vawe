// Every permanent redirect for a URL that used to exist. next.config.mjs reads LEGACY_REDIRECTS;
// scripts/site/redirects-report.mjs checks every old URL against it and writes the mapping table.
//
// Order matters: Next takes the first match, so the exact pages come first and the generic
// /arsenal fallback comes last. `permanent: true` sends a 308.
//
// The JSON engine's pages are gone. A removed page goes to the page that now answers the same
// question: a move for a motion effect, /easing/<name> for an easing, /docs/<page> for an engine
// concept. /video-components is the fallback only for a URL with no nearer page.

const MOVES = "/video-components";
const move = (name) => `/video-components/${name}`;

// Old effect families (/arsenal/effects/family/<id> and /arsenal/effects/<id>--<name>) and where each lands.
export const FAMILY_DESTINATIONS = {
  "drawn-icons": move("mark-trace"),
  "motion-voices-tactile-sound": "/docs/audio",
  backgrounds: move("gradient-mesh-field"),
  "gradient-recipes": move("gradient-mesh-field"),
  "camera-dials": move("rack-focus"),
  "camera-moves": move("camera-moves"),
  "destinations-platform-safe-area": "/docs/aspect-ratios",
  "output-targets": "/docs/aspect-ratios",
  "caption-styles": move("caption-karaoke"),
  "compositions-bespoke-per-beat-timeline": "/docs/the-page",
  "cut-timings": move("cut-on-motion"),
  "scene-finish-keys": "/docs/motion",
  "generators-the-playground": move("halftone-field"),
  "lightfield-dials": move("light-pool"),
  "lightfield-envelope-anchors": move("light-pool"),
  "lightfield-envelope-shapes": move("light-pool"),
  "lightfield-motions": move("light-pool"),
  "lightfield-patterns": move("light-pool"),
  "lightfield-shadow-directions": move("light-pool"),
  "glow-presets": move("light-pool"),
  "layer-types": "/docs/the-page",
  "raymarched-surfaces": move("aurora-drift"),
  "three-js-scenes-real-geometry": move("device-tilt-stage"),
  "universal-surface-decoration": move("card-assemble"),
  "anchor-points": "/docs/the-page",
  "interpolation-modes-not-easings": "/docs/motion",
  "keyframe-handles-the-graph-editor": "/docs/motion",
  "particles-presets": move("grain-field"),
  "ambient-shader-fields": move("aurora-drift"),
  "generative-paint-fx-per-frame": move("ink-warp"),
  "layer-as-texture-resample": move("liquid-displace"),
  "adjustment-layers-grade-what-is-beneath": "/docs/motion",
  "blend-modes": "/docs/backgrounds-and-images",
  "cursor-styles": move("cursor-click"),
  "depths-parallax-planes": move("parallax-dive"),
  "drivers-expressions-as-data": "/docs/motion",
  "effector-drives": move("grid-stagger-wave"),
  "effector-falloffs": move("grid-stagger-wave"),
  "enter-exit-anims": move("mask-rise"),
  "move-shapes-measured-keyframe-tracks": "/docs/motion",
  "part-entrances": move("card-assemble"),
  "path-curves-svg-d-generators": move("text-on-path"),
  "per-layer-modifiers": move("echo-trail"),
  "idles-ambient-hold-motion": move("drift-hold"),
  "gsap-named-effects": "/docs/motion",
  placement: "/docs/the-page",
  "spectacle-devices": move("crash-zoom"),
  "canvas-image-passes-baked": move("halftone-field"),
  "composite-looks-static": "/docs/brand-reflection",
  "filter-presets": move("smear-stretch"),
  "kinetic-text-presets": move("letter-stagger"),
  "ransom-faces": "/docs/brand-reflection",
  "scramble-charsets-chars": move("text-scramble-decode"),
  "font-variation-axes": move("variable-weight-wave"),
  "stagger-order-from": move("grid-stagger-wave"),
  "surface-looks": "/docs/brand-reflection",
  "theme-look-keys": "/docs/brand-reflection",
  easings: "/docs/motion",
  "group-clock-loop-shapes": "/docs/motion",
  "time-remaps-the-layer-s-own-clock": move("speed-ramp-freeze"),
  "film-energy": "/docs/brief",
  "scene-cuts": move("iris-wipe"),
  "seams-2-scene-blends": move("luma-matte-dissolve"),
  "shader-stings": move("liquid-wipe"),
  "transition-relationships": move("chain-beats"),
  "per-frame-accent-layers": move("marker-highlight"),
  "vector-layer-logos-icons": move("shape-trace-morph"),
  "plain-words-feel-duration-camera-comparative": "/docs/brief",
};

// One effect with a nearer page than its family's. Keys are the old stem (<family>--<name>).
const EFFECT_OVERRIDES = {
  "camera-moves--panfollow": move("caret-follow"),
  "seams-2-scene-blends--burnthrough": move("light-leak-transition"),
  "shader-stings--blinds": move("split-reveal"),
  "kinetic-text-presets--wave": move("variable-weight-wave"),
  "vector-layer-logos-icons--svg-draw-stroke-draws-on": move("mark-trace"),
  "easings--enter": "/easing/land",
  "easings--exit": "/easing/leave",
  "easings--settle": "/easing/settle",
  "keyframe-handles-the-graph-editor--fling": "/easing/land",
  "keyframe-handles-the-graph-editor--hang": "/easing/swap",
};

// The classic CSS and Penner eases the /easing pages cover: easings--easeinoutback -> /easing/ease-in-out-back.
const CLASSIC_EASES = ["In", "Out", "InOut"].flatMap((side) =>
  ["Sine", "Quad", "Cubic", "Quart", "Quint", "Expo", "Circ", "Back", "Elastic", "Bounce"].map((curve) => `ease${side}${curve}`),
);
const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
export const EASING_SLUGS = [...CLASSIC_EASES, "land", "landSoft", "settle", "swap", "glide", "carry", "leave", "launch", "pop"].map(kebab);

// Old components (/arsenal/<name> and /arsenal/<name>.<variant>), by the name before the first dot.
export const BLOCK_DESTINATIONS = {
  codeBlock: move("caret-typing"), terminal: move("caret-typing"), terminalPro: move("caret-typing"),
  terminalHtml: move("caret-typing"), codeTyping: move("caret-typing"), codeHighlight: move("ui-focus-zoom"),
  codeScroll: move("caret-follow"), codeDiff: move("before-after-wipe"), codeMorph: move("shape-morph-wipe"),
  codeFlight: move("camera-moves"), textCursor: move("caret-typing"),
  loadingBar: move("agent-progress"), deploySuccess: move("success-check"), spinner: move("agent-progress"),
  fileTree: move("agent-progress"), logLines: move("agent-progress"), commitRow: move("agent-progress"),
  statBig: move("count-up"), kpiRow: move("count-up"), gauge: move("count-up"), progressRing: move("count-up"),
  barChart: move("chart-build"), lineChart: move("chart-build"), donutChart: move("chart-build"), stackedBar: move("chart-build"),
  card: move("card-assemble"), browserFrame: move("device-tilt-stage"), phoneFrame: move("device-tilt-stage"),
  uiReveal3d: move("device-tilt-stage"), pillRow: move("card-assemble"), tabBar: move("card-assemble"),
  checklist: move("card-assemble"), table: move("card-assemble"), timeline: move("card-assemble"),
  stepFlow: move("card-assemble"), kanban: move("card-assemble"), profileHeader: move("card-assemble"),
  onboardCard: move("card-assemble"), installCard: move("card-assemble"), followCard: move("card-assemble"),
  borderBeamCard: move("card-assemble"), bento: move("card-assemble"), glassWidgets: move("card-assemble"),
  glassNotification: move("notification-pop"), glassMenu: move("card-assemble"), glassControls: move("card-assemble"),
  glassHome: move("card-assemble"), glassDock: move("card-assemble"),
  notification: move("notification-pop"), toast: move("notification-pop"), nowPlaying: move("notification-pop"),
  reactionBar: move("notification-pop"), avatarStack: move("logo-wall"), socialProof: move("logo-wall"),
  chatBubble: move("ai-stream-response"), emptyState: move("skeleton-reveal"),
  callout: move("bracket-callout"), comparison: move("before-after-wipe"), colorCycle: move("color-block-wipe"),
  lowerThird: move("lower-third"), videoLowerThird: move("lower-third"), searchEngine: move("command-palette-summon"),
  splitScreen: move("split-reveal"), screenSwap: move("split-reveal"), splitFlapBoard: move("flap-resolve"),
  pointer: move("cursor-click"), tapRipple: move("cursor-click"), keyboard: move("cursor-click"), pressButton: move("cursor-click"),
  scanGate: move("camera-moves"), parallaxZoom: move("parallax-dive"), parallaxUnzoom: move("pull-back-reveal"),
  morphText: move("weight-morph"),
  flowchart: move("integration-hub"), nodeGraph: move("integration-hub"), usMapHex: move("integration-hub"),
  usMap: move("integration-hub"), worldMap: move("integration-hub"), usMapBubble: move("integration-hub"),
  usMapFlow: move("integration-hub"),
};

const CATEGORY_DESTINATIONS = {
  code: move("caret-typing"), interface: move("card-assemble"), data: move("chart-build"), core: move("lower-third"),
  type: move("letter-stagger"), social: move("notification-pop"), app: move("card-assemble"),
  interaction: move("cursor-click"), surfaces: move("card-assemble"), camera: move("camera-moves"),
  diagrams: move("integration-hub"), maps: move("integration-hub"), effects: MOVES,
};

const permanent = (source, destination) => ({ source, destination, permanent: true });

function easingRules() {
  return CLASSIC_EASES.map((name) => permanent(`/arsenal/effects/easings--${name.toLowerCase()}`, `/easing/${kebab(name)}`));
}

function effectRules() {
  const overrides = Object.entries(EFFECT_OVERRIDES).map(([stem, to]) => permanent(`/arsenal/effects/${stem}`, to));
  const families = Object.entries(FAMILY_DESTINATIONS).flatMap(([id, to]) => [
    permanent(`/arsenal/effects/family/${id}`, to),
    permanent(`/arsenal/effects/${id}--:name`, to),
  ]);
  return [...overrides, ...easingRules(), ...families];
}

function blockRules() {
  return Object.entries(BLOCK_DESTINATIONS).flatMap(([name, to]) => [
    permanent(`/arsenal/${name}`, to),
    permanent(`/arsenal/${name}.:variant(.+)`, to),
  ]);
}

function categoryRules() {
  return Object.entries(CATEGORY_DESTINATIONS).map(([id, to]) => permanent(`/arsenal/category/${id}`, to));
}

// Pages that lived at /moves/<name> before the move was merged or became an ease. The clip and
// markdown files (/moves/<name>.mp4, .md, .webp) went with them.
const MOVED_TO_EASING = ["carry", "glide", "land", "launch", "leave", "nudge", "pop", "settle", "swap"];
const MERGED_MOVES = { "flash-cut": move("exposure-flash"), "push-in": move("camera-moves") };
const REMOVED_MOVE_RULES = [
  ...MOVED_TO_EASING.flatMap((name) => [
    permanent(`/moves/${name}`, `/easing/${name}`),
    permanent(`/moves/${name}.:ext(.+)`, `/easing/${name}`),
  ]),
  ...Object.entries(MERGED_MOVES).flatMap(([name, to]) => [
    permanent(`/moves/${name}`, to),
    permanent(`/moves/${name}.:ext(.+)`, to),
  ]),
];

// Blog posts merged into another post or dropped in the 2026-10-16 rebuild. Each goes to the kept post that now holds its facts.
const BLOG_MOVED = {
  "chrome-per-lane": "fast-drafts", "slots-reaper": "fast-drafts", "test-suite": "fast-drafts",
  "judge-defect": "drafts-lie", "stall-watchdog": "resumable-finals", "no-synth-bed": "audio-as-written",
  "ten-looks": "site-after-json", "headless-blocks": "site-after-json", "big-deletion": "html-over-json",
  "measured-brief": "loophole-audit", waivers: "advise-refuse",
  "see-truth": "watch-a-film", "calibrate-spec": "watch-a-film", "plan-vs-reference": "watch-a-film",
  shell: "one-binary", "stage-say": "one-binary", land: "one-binary",
  "trace-reviews": "run-logs", "cheap-wait": "run-logs",
  "one-owner": "weaker-model", "taste-digest": "read-load", "data-over-rules": "read-load",
};
const BLOG_MOVED_RULES = Object.entries(BLOG_MOVED).flatMap(([old, kept]) => [
  permanent(`/blog/${old}`, `/blog/${kept}`),
  permanent(`/blog/${old}.md`, `/blog/${kept}.md`),
]);

export const LEGACY_REDIRECTS = [
  ...BLOG_MOVED_RULES,
  ...effectRules(),
  ...blockRules(),
  ...categoryRules(),
  permanent("/arsenal/type", move("letter-stagger")),
  permanent("/arsenal/effects", MOVES),
  // Anything else under /arsenal has no nearer page.
  permanent("/arsenal/:path*", MOVES),
  permanent("/blocks/:path*", MOVES),
  permanent("/showcase/:path*", MOVES),
  permanent("/product-tour-video", MOVES),
  permanent("/type", MOVES),
  permanent("/json-to-video", "/docs/html-to-mp4-with-claude-code"),
  permanent("/docs/the-scene", "/docs/the-page"),
  permanent("/docs/camera", "/docs/motion"),
  permanent("/docs/:slug(layers|blocks|themes|mcp)", "/docs"),
  permanent("/editor/:path*", "/docs/quickstart"),
  permanent("/playground/:path*", MOVES),
  permanent("/deck", "/docs/motion"),
  permanent("/deck.html", "/docs/motion"),
  permanent("/vawe-rules.md", "/docs/brief"),
  ...REMOVED_MOVE_RULES,
  // The gallery was /moves until 2026-10-19. The clip, markdown and index.json files keep that path, so :name stops at a dot.
  permanent("/moves", MOVES),
  permanent("/moves/:name([a-z0-9-]+)", "/video-components/:name"),
];

// Any Host other than the apex gets a 301 to it: the raw server IP and stray alias hostnames were
// crawled as separate sites. Loopback names stay out so local dev, the container healthcheck and the
// docs proxy keep working. The www rule in next.config.mjs runs first and keeps its 308.
const OWN_HOSTS = ["vawe\\.dev", "localhost", "127\\.0\\.0\\.1", "0\\.0\\.0\\.0", "\\[::1\\]"];
export const ALIAS_HOST_PATTERN = `^(?!(?:${OWN_HOSTS.join("|")})(?::\\d+)?$).+`;
export const ALIAS_HOST_REDIRECT = {
  source: "/:path*",
  has: [{ type: "host", value: ALIAS_HOST_PATTERN }],
  destination: "https://vawe.dev/:path*",
  statusCode: 301,
};
