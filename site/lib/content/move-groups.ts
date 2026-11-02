import { GROUPS, MOVES, groupLabel } from "../moves";
import type { Link } from "./types";

// One hand-written page per move group (/video-components/group/<id>). Each pick names a move that
// must exist in the group; the module throws at build time otherwise.
export type GroupPage = {
  id: string;
  h1: string;
  titleLead: string;
  descriptionLead: string;
  intro: string[];
  pickLead: string;
  picks: { name: string; when: string }[];
  rules: string[];
  more: Link[];
};

const PAGES: GroupPage[] = [
  {
    id: "reveal-a-title",
    h1: "Text reveal animations in CSS.",
    titleLead: "CSS text reveal animation",
    descriptionLead: "Text reveal animations for video in CSS and Web Animations: masked rises, staggers, typing, captions and 3D letter rolls.",
    intro: [
      "The first words on screen set the tone of a film, so how they arrive matters more than how they leave. This group holds every way a line of type enters: from under a mask, letter by letter, typed, flipped, scrambled, or wiped in as a caption.",
      "The house rule is that an entrance is a move, not only a fade. Each component is a CSS and Web Animations snippet with the exact stagger, curve and timing written out, so an agent copies it and changes the words.",
    ],
    pickLead: "Pick by what the copy is, not by the effect.",
    picks: [
      { name: "mask-rise", when: "A quiet editorial headline. The mask box is tall enough that descenders are not cut." },
      { name: "tracking-collapse", when: "A title or wordmark that should land soft and sharpen as it arrives." },
      { name: "scale-punch", when: "One hero word that needs to hit hard on a beat." },
      { name: "caret-typing", when: "A command, a prompt or a name typed in, where the caret becomes the next element." },
      { name: "text-scramble-decode", when: "A codename revealed as a lookup, in a mono face." },
      { name: "caption-karaoke", when: "A spoken line, where the word being said lifts to full ink." },
      { name: "lower-third", when: "A person is on screen and needs a name and a role." },
    ],
    rules: [
      "Text must hold still long enough to read. Add a hold after the arrival instead of slowing the move.",
      "A reveal with a mask cuts descenders unless the box has room, which is why mask-rise makes the mask box tall enough. blur-word-cascade avoids the problem by using no mask at all.",
      "Seeded glyphs keep the scramble and flip components deterministic: flap-resolve and text-scramble-decode use the same wrong letters in every render.",
    ],
    more: [
      { href: "/blog/kinetic-typography-css", label: "Kinetic typography in CSS, rendered to MP4" },
      { href: "/docs/kinetic-type", label: "The kinetic type guide" },
      { href: "/docs/text-and-fonts", label: "Text and fonts in a film" },
    ],
  },
  {
    id: "change-between-shots",
    h1: "CSS video transitions.",
    titleLead: "CSS video transitions",
    descriptionLead: "CSS video transitions for HTML films: whips, wipes, match cuts and zooms that carry the eye across a cut, with the snippet for each.",
    intro: [
      "A cut is where a film is most likely to feel cheap. This is the largest group on the site because a transition has to do a different job each time: hide a seam, change a meaning, hand the eye from one object to the next, or add weight before a change.",
      "The components here fall into a few families. Some carry motion across the cut (cut-on-motion, whip-pan, swipe-continues). Some open the next shot through a shape (iris-wipe, shape-morph-wipe, avatar-world). Some enter the next scene through an object on screen (counter-dive, word-portal, caret-door).",
    ],
    pickLead: "Pick by what the two shots have in common.",
    picks: [
      { name: "cut-on-motion", when: "A moving shape can carry the eye across a hard cut." },
      { name: "whip-pan", when: "The next shot sits to the side and a blurred pan can hide the seam." },
      { name: "match-cut", when: "One shape stays in place and changes meaning, such as a spinner ring and a finished ring." },
      { name: "iris-wipe", when: "The eye is on a click or a mark, and a circle can close on it." },
      { name: "zoom-through", when: "A UI part can fill the frame and the next shot comes out of it." },
      { name: "speed-ramp-freeze", when: "A beat needs weight before a change." },
      { name: "cursor-spotlight", when: "A click opens the next screen." },
    ],
    rules: [
      "Adjacent transitions change axis or direction. Three horizontal wipes in a row read as monotonous.",
      "Arrive fast and land soft, leave faster and shorter. exit-fast shows the pair.",
      "chain-beats overlaps the next beat at 65 percent of the last. Use it once per film.",
      "In push-blur and whip-pan, the directional blur follows the speed of the move.",
    ],
    more: [
      { href: "/docs/transitions", label: "The transitions guide" },
      { href: "/blog/transitions", label: "Transitions that carry the eye" },
      { href: "/easing", label: "The easing curves behind them" },
    ],
  },
  {
    id: "point-the-eye",
    h1: "Text highlight animations in CSS.",
    titleLead: "CSS highlight animation",
    descriptionLead: "Highlight and callout animations in CSS for video: underline draw, marker bar, brackets and spotlight dim that point at one word.",
    intro: [
      "Seven small components answer one question: where should the viewer look now? Each one marks a word or a part of the interface without moving the rest of the frame.",
      "They are the shortest clips on the site, most between 1 and 1.5\u00a0seconds, because a pointer that lingers becomes decoration. Use them on a line that is already on screen and already readable.",
    ],
    pickLead: "Pick by how loud the pointer should be.",
    picks: [
      { name: "underline-draw", when: "A line draws under the key word, fast in and slow out." },
      { name: "marker-highlight", when: "A highlighter bar wipes behind a phrase and the text flips dark." },
      { name: "word-sweep", when: "The accent should run through the line in reading order and stop on the target." },
      { name: "weight-morph", when: "One word should get heavier, on a real variable-font axis." },
      { name: "bracket-callout", when: "A word or a UI part needs corner brackets that snap on." },
      { name: "spotlight-dim", when: "The whole frame should dim around one target." },
      { name: "hand-drawn-notes", when: "A person’s margin notes: a loose circle, an arrow and an underline." },
    ],
    rules: [
      "Every pointer needs a target. A highlight with nothing to point at is decoration.",
      "weight-morph reshapes the glyphs on a variable-font axis. Nothing is scaled.",
      "hand-drawn-notes uses a seeded wobble, so the same render draws the same loose circle.",
    ],
    more: [
      { href: "/docs/motion", label: "The motion guide" },
      { href: "/docs/text-and-fonts", label: "Variable fonts and text in a film" },
      { href: "/video-components/group/reveal-a-title", label: "Text reveal animations" },
    ],
  },
  {
    id: "move-the-camera",
    h1: "Camera move animations in CSS.",
    titleLead: "CSS camera move animation",
    descriptionLead: "Camera move animations for HTML video: push, pull, parallax dive, rack focus and crash zoom, built from one scale and one translate.",
    intro: [
      "A camera move in a page is a transform on a wrapper. Push toward a subject, pull back to the whole, fly through layers at real depths, or move focus from near to far. The group has 16 of these, plus the lens and gradient grounds that make a still frame feel filmed.",
      "Scale runs on a log path, so a zoom reads at an even speed instead of racing at the end. The camera holds still by default: motion earns its place only where the story moves.",
    ],
    pickLead: "Pick by what the camera should discover.",
    picks: [
      { name: "pull-back-reveal", when: "Open tight on a detail and answer with the whole." },
      { name: "ui-focus-zoom", when: "Zoom onto one part of a captured interface." },
      { name: "parallax-dive", when: "Fly forward through layers, near ones rushing past." },
      { name: "pan-stations", when: "Several steps read as one continuous place." },
      { name: "rack-focus", when: "Focus moves from one depth layer to another." },
      { name: "crash-zoom", when: "One detail hits on a beat." },
      { name: "drift-hold", when: "The line holds still and only the ground drifts." },
    ],
    rules: [
      "The camera holds still by default. camera-moves wraps a whole world so a push makes the ground scale less than the layers, and the layers separate.",
      "rack-focus is for one use per film. exposure-flash uses at most 3 flashes a second.",
      "crash-zoom gets its blur from 16 stacked exposures, so the smear is real and not a CSS filter.",
      "A held frame never sits dead: drift-hold moves only the ground so the line stays readable.",
    ],
    more: [
      { href: "/docs/lens-and-effects", label: "Lens and effects" },
      { href: "/blog/real-lens", label: "Why vawe films the screen as a real lens" },
      { href: "/docs/motion-blur", label: "Motion blur" },
    ],
  },
  {
    id: "end-a-film",
    h1: "End card and outro animations in HTML.",
    titleLead: "End card and outro animation",
    descriptionLead: "End card, logo sting and outro animations in HTML and CSS: a mark lands, a name settles and a call to action closes the film.",
    intro: [
      "The last two seconds are the part a viewer keeps. These ten components close a film: a logo hit, a wordmark that falls into place, a mark that draws itself, a quiet lockup, a thank-you sweep and the call to action.",
      "Six of them carry the same note: use once per film. An ending that repeats an earlier gesture feels like a template, so each one is built to be the single closing beat.",
    ],
    pickLead: "Pick by how the film should feel when it stops.",
    picks: [
      { name: "logo-sting", when: "A short logo hit: the mark lands and a light band crosses it." },
      { name: "wordmark-cascade", when: "The name is the last beat, falling onto a rail." },
      { name: "mark-trace", when: "A line mark should draw itself." },
      { name: "calm-lockup", when: "A quiet ending where the logo and line settle slowly." },
      { name: "ui-strip-away", when: "The product UI peels away and its mark becomes the brand lockup." },
      { name: "logo-wall", when: "A proof beat before the call to action." },
      { name: "cta-morph-press", when: "The close moves from brand to action, and a button gets pressed." },
    ],
    rules: [
      "logo-sting, wordmark-cascade, mark-trace, shape-trace-morph, calm-lockup and thanks-sweep are each marked use once per film.",
      "shape-trace-morph morphs between two paths that keep the same command count.",
      "cta-pop uses the one accent colour on the overshoot curve, and the arrow leans to invite the click.",
    ],
    more: [
      { href: "/docs/logo-sting", label: "The logo sting guide" },
      { href: "/launch-video", label: "A launch film built from video components" },
      { href: "/docs/launch-video", label: "The launch video guide" },
    ],
  },
  {
    id: "product-moments",
    h1: "Product UI animations for video.",
    titleLead: "Product UI animation for video",
    descriptionLead: "Product UI animations in CSS for demo and launch video: cursor click, count-up, chart build, AI stream, terminal run and diff cards.",
    intro: [
      "A product film shows the product working. These 21 components are the moments a launch or demo film is made of: a cursor that clicks, a number that counts, a chart that builds, an agent that works through steps, a pull request that merges.",
      "Several copy a real interface on purpose: terminal-run is a Claude Code terminal, model-picker is the claude.ai menu, diff-card is a GitHub pull request. They move as the real surface moves, so a viewer who knows the product trusts the frame.",
    ],
    pickLead: "Pick by the claim the beat has to prove.",
    picks: [
      { name: "cursor-click", when: "A control is pressed and its label changes." },
      { name: "count-up", when: "A number is the proof, with a delta chip and a sparkline." },
      { name: "chart-build", when: "Bars rise in sequence and the newest turns accent." },
      { name: "ai-stream-response", when: "A prompt is sent and the answer streams in chunks." },
      { name: "agent-progress", when: "An AI agent works through numbered steps." },
      { name: "before-after-wipe", when: "The claim is a change, shown as one card in two states." },
      { name: "device-tilt-stage", when: "The product should read as an object on a CSS 3D laptop." },
      { name: "success-check", when: "A button resolves into a drawn check." },
    ],
    rules: [
      "skeleton-reveal is marked use once per film.",
      "A component that copies a product surface does not overshoot where the real interface does not.",
      "integration-hub and logo-wall use invented tool logos. Swap in real marks only with the right to show them.",
      "terminal-run and approval-gate show Claude Code. They suit a film about coding agents.",
    ],
    more: [
      { href: "/docs/product-ui", label: "Product UI in a film" },
      { href: "/docs/ui-demo", label: "The UI demo guide" },
      { href: "/launch-video", label: "Make a product launch video with code" },
    ],
  },
  {
    id: "grounds",
    h1: "Animated backgrounds in CSS and shaders.",
    titleLead: "Animated background in CSS",
    descriptionLead: "Animated backgrounds for HTML video: aurora and ink shaders, film grain, halftone, dot grids, marquees and light pools that never sit flat.",
    intro: [
      "A flat colour behind a line of type reads as unfinished. This group holds the ground layers: soft light, grain, dots, tiles and photo particles that move under the copy without competing with it.",
      "Several run in one fragment shader (aurora-drift, ink-warp), one is plain CSS with no shader (light-pool), and one is a plain SVG dot grid (dot-grid-wave). Each one moves from the seek time, not from a clock.",
    ],
    pickLead: "Pick by how still the frame should feel.",
    picks: [
      { name: "light-pool", when: "A matte held frame needs the stillest ground, one soft pool in plain CSS." },
      { name: "grain-field", when: "A printed or filmic frame should breathe." },
      { name: "aurora-drift", when: "Soft bands of light hang from the top and the copy sits low." },
      { name: "ink-warp", when: "Short, large copy sits on a marbled ink ground." },
      { name: "dot-grid-wave", when: "A clean product or data frame needs a quiet travelling wave." },
      { name: "halftone-field", when: "A physical or retro frame gets a 45 degree dot screen." },
      { name: "photo-particles", when: "A real photo turns into 120,000 lit points." },
      { name: "simple-marquee", when: "Rows of tiles should slide for a whole beat." },
    ],
    rules: [
      "grain-field turns over 24 times a second and is seeded from the seek time, never from Math.random.",
      "aurora-drift and ink-warp thin out the light behind the type.",
      "marquee-along-path moves 8 percent of the path per second, and circling-elements makes one linear turn in 10\u00a0s.",
    ],
    more: [
      { href: "/docs/backgrounds-and-images", label: "Backgrounds and images" },
      { href: "/docs/image-to-particles", label: "Turn an image into particles" },
      { href: "/docs/three-and-canvas", label: "three.js and canvas in a film" },
    ],
  },
];

for (const p of PAGES) {
  const inGroup = new Set(MOVES.filter((m) => m.group === p.id).map((m) => m.name));
  for (const pick of p.picks) if (!inGroup.has(pick.name)) throw new Error(`move-groups: ${pick.name} is not in ${p.id}`);
}
if (PAGES.length !== GROUPS.length || GROUPS.some((g) => !PAGES.some((p) => p.id === g.id))) throw new Error("move-groups: one page per group in moves.json");

export const GROUP_PAGES = PAGES;
export const groupPage = (id: string) => PAGES.find((p) => p.id === id) ?? null;
export const groupPath = (id: string | null) => `/video-components/group/${id}`;

export function groupFacts(id: string) {
  const moves = MOVES.filter((m) => m.group === id);
  const timed = moves.map((m) => m.duration).filter((d): d is number => d !== null);
  return {
    label: groupLabel(id),
    count: moves.length,
    clips: moves.filter((m) => m.clipHash).length,
    shortest: Math.min(...timed),
    longest: Math.max(...timed),
  };
}

export const groupMetaTitle = (p: GroupPage) => `${p.titleLead}: ${groupFacts(p.id).count} components | vawe`;
export const groupMetaDescription = (p: GroupPage) => p.descriptionLead;
