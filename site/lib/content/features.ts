import { REPO_URL } from "../schema";
import { GROUPS, MOVES } from "../moves";
import { EASES } from "../easing";
import type { Code, Crumb, Link, Meta, NextBlock, Para } from "./types";

export type Proof =
  | { kind: "code"; code: Code }
  | { kind: "stat"; n: string; label: string }
  | { kind: "blur" }
  | { kind: "curve"; ease: string };

export type Feature = { title: string; body: Para; proof: Proof };
export type FeatureSection = {
  id: string;
  title: string;
  lead: string;
  visual: "session" | "taste-clips" | "speed-bars";
  features: Feature[];
};

export const FEATURES_SESSION: { cmd: string; out: string[] }[] = [
  {
    cmd: `bin/vawe new ax-demo --request "A 6 second sting for Ember coffee…" --defaults`,
    out: [
      `wrote films/ax-demo/page.html, films/ax-demo/brief.md and …/directions.html`,
      `--defaults: details guessed, not asked: subject, message, show, assets, ending`,
      `next: bin/vawe refs list, bin/vawe refs frames <id>, Read the frames at full size, …`,
      `vawe: new ok in 0.1s`,
    ],
  },
  {
    cmd: `bin/vawe dev films/ax-demo/page.html`,
    out: [
      `✓ out/ax-demo-draft.mp4: 180 frame(s) at 30fps, 960x540 (16:9), 0s-6.00s`,
      `@0.7s static window 0.7-2.6 s (1.9 s, limit 0.5 s): nothing moves; give the hold an element motion …`,
      `next: bin/vawe frame films/ax-demo/page.html --cuts and Read every cut at full size; …`,
      `vawe: dev ok in 18.1s`,
    ],
  },
  {
    cmd: `bin/vawe critique films/ax-demo/page.html`,
    out: [
      `- no-settle: S1 h1 "Say the one thing" is still moving at 7.9 px/f when the shot ends [f89 (2.97s)]. Fix: end the move 4 frames before the cut, …`,
      `next: look at the sheets above, or start a critic session with bin/vawe critique films/ax-demo/page.html --fresh`,
      `vawe: critique ok in 20.6s`,
    ],
  },
];

export const FEATURES_BARS: { label: string; s: number }[] = [
  { label: "colour-sting, 5 s film, whole draft", s: 24.9 },
  { label: "moth-photogram, 12 s film, whole draft", s: 23.1 },
  { label: "moth-photogram, seconds 4 to 6 only", s: 6.8 },
];

const SKILLS = "html-to-video, vawe-brief, vawe-page, vawe-critique, vawe-transitions and vawe-reference";

export const FEATURES = {
  path: "/features",
  meta: {
    title: "HTML to video features: agent CLI, motion blur, lens",
    description:
      "vawe features, in three groups: agents write a film in plain HTML and every command names the next step, a library of video components and a fresh-session critique keep it from looking generated, and drafts render in seconds.",
  } as Meta,
  crumb: { group: "Product", current: "Features" } as Crumb,
  h1: "Agents write it. It looks made. It renders fast.",
  toc: [
    { href: "#ax", label: "Agent experience" },
    { href: "#taste", label: "Taste" },
    { href: "#speed", label: "Speed" },
  ] as Link[],
  tasteClips: ["caret-typing", "bracket-callout", "iris-wipe", "camera-moves", "text-on-path", "letter-stagger"],
  sections: [
    {
      id: "ax",
      title: "Agents write it well.",
      lead: "A film is plain HTML, and each command tells the agent what to run next.",
      visual: "session",
      features: [
        {
          title: "Plain HTML, no private format",
          body: [
            "A film is ",
            { code: "films/<name>/page.html" },
            " plus an assets folder. CSS, Web Animations, SVG, canvas and three.js all work. If something an agent would naturally write fails, that is a bug in vawe. ",
            { text: "The page contract", href: "/docs/the-page" },
            ".",
          ],
          proof: {
            kind: "code",
            code: {
              label: "page.html",
              text: `<meta name="duration" content="12.4">
<html data-aspect="16:9">
<!-- CSS @keyframes, element.animate(),
     SVG, canvas, three.js -->
<script>window.seek = (t) => draw(t)</script>`,
            },
          },
        },
        {
          title: "Every command names the next step",
          body: [
            "Each verb ends with a ",
            { code: "next:" },
            " line, and each check names the problem, the second and the fix. The agent never guesses the next command.",
          ],
          proof: {
            kind: "code",
            code: {
              label: "a check, with its fix",
              text: `@0.7s static window 0.7-2.6 s (1.9 s, limit 0.5 s):
nothing moves; give the hold an element motion
instead: put one element move in every span that
sits still over 0.5 s (type a line, tick a counter,
pass a glint), never a camera drift`,
            },
          },
        },
        {
          title: "An agent reads vawe directly",
          body: [
            "The site serves the guide as ",
            { code: "llms.txt" },
            ` and markdown. Six skills carry the parts an agent gets wrong: ${SKILLS}. `,
            { text: "How an agent writes the page", href: "/ai-agents" },
            ".",
          ],
          proof: {
            kind: "code",
            code: {
              label: "plain files",
              text: `/llms.txt
/ai-agents.md
/llms-full.txt
/moves/index.json
/moves/<name>.md   // one per move`,
            },
          },
        },
      ],
    },
    {
      id: "taste",
      title: "It looks made, not generated.",
      lead: "Copy a proven video component, let the renderer film it, and let a fresh session judge.",
      visual: "taste-clips",
      features: [
        {
          title: `${MOVES.length} video components and ${EASES.length} easing curves`,
          body: [
            `The video components sit in ${GROUPS.length} groups. Each is a clip and one markdown file with the snippet and its sound cue. Every curve copies as CSS. 15 recipes chain video components into a film type. `,
            { text: "Browse the video components", href: "/video-components" },
            ", ",
            { text: "the curves", href: "/easing" },
            " and ",
            { text: "the recipes", href: "/docs/recipes" },
            ".",
          ],
          proof: { kind: "curve", ease: "land" },
        },
        {
          title: "Real motion blur and a lens",
          body: [
            "A final measures how far things move and takes 1–32 subframes per frame, so a fast move smears and a still frame stays sharp. One lens shader then films the screen: depth of field, bloom, grain and ten named looks. ",
            { text: "Looks and blur", href: "/docs/motion" },
            ".",
          ],
          proof: { kind: "blur" },
        },
        {
          title: "A fresh session judges; the owner approves",
          body: [
            "A pass is never self-recorded. The critique runs in a session that did not write the page, and ",
            { code: "ship" },
            " refuses until the owner approves the full draft.",
          ],
          proof: {
            kind: "code",
            code: {
              label: "the gate",
              text: `bin/vawe critique <page>
// in a session that did not write the page
bin/vawe critique <page> --fresh
// a separate headless session scores
/vawe-approve
// only the owner runs it; ship refuses without it`,
            },
          },
        },
      ],
    },
    {
      id: "speed",
      title: "Fast drafts, exact re-renders.",
      lead: "A 2 s slice of a 12 s film re-rendered in 6.8 s. The whole draft took 23.1 s.",
      visual: "speed-bars",
      features: [
        {
          title: "Drafts at half size",
          body: ["A draft is half size at 30\u00a0fps, with the audio mix, for a quick look. Only the final adds motion blur."],
          proof: {
            kind: "code",
            code: {
              label: "two renders",
              text: `bin/vawe dev  <page>   // half size, 30 fps, audio
bin/vawe ship <page>   // 60 fps, blur, audio`,
            },
          },
        },
        {
          title: "Parallel slices, the same pixels",
          body: [
            "The clock is replaced before the page runs, so a frame does not depend on the others. The renderer captures fixed 60-frame slices at once, and a test renders pages twice and compares every frame. ",
            { text: "How that works", href: "/determinism" },
            ".",
          ],
          proof: { kind: "stat", n: "60", label: "frames per slice, for any worker count" },
        },
        {
          title: "Re-render only the seconds named",
          body: [
            "The critique names the seconds to fix. ",
            { code: "--from" },
            " and ",
            { code: "--to" },
            " render just those seconds into their own file.",
          ],
          proof: {
            kind: "code",
            code: {
              label: "a partial draft",
              text: `bin/vawe dev <page> --from 4 --to 6
✓ …-draft-4-6.mp4: 60 frame(s) at 30fps, 4s-6.00s
time: capture 3.2 s · checks 1.0 s · encode 0.8 s`,
            },
          },
        },
      ],
    },
  ] as FeatureSection[],
  sessionLabel: "a real agent session, trimmed with …",
  barsCaption: [
    { code: "bin/vawe dev" },
    " wall time, measured 2026-10-14 on an Apple M4 laptop (10 cores) with other renders running. Your numbers will differ; the ratio is the point.",
  ] as Para,
  end: { caption: "CINDRE, a 10 s perfume film. One page, rendered by vawe." },
  next: {
    title: "Write your first page",
    lead: ["Run the loop on a six second sting."],
    primary: { href: REPO_URL, label: "Get started on GitHub" },
  } as NextBlock,
};
