import { REPO_URL } from "../schema";
import { cluster } from "./agentic-editing";
import type { Code, Crumb, Link, Meta, NextBlock, Section } from "./types";

const ASK: Code = {
  label: "Ask in plain words",
  text: ["Edit the screen recording in ~/Movies/demo.mov", "into a 30-second demo.", "Cut the dead time, speed up the waits,", "add a title card and captions."].join("\n"),
};

const PAGE: Code = {
  label: "A wait, sped up 4\u00a0times",
  text: [
    "<section data-world=\"upload\">",
    "  <video src=\"footage/demo.mp4\" data-at=\"0\"",
    "         data-trim=\"12\" data-trim-end=\"32\"",
    "         data-rate=\"4\" muted></video>",
    "</section>",
  ].join("\n"),
};

export const SCREEN_RECORDING = {
  path: "/screen-recording-to-demo-video",
  meta: {
    title: "Turn a screen recording into a demo video | vawe",
    description:
      "Turn your screen recording into a demo video: cut the dead time, speed up the waits, add titles and captions. A coding agent writes the edit.",
  } as Meta,
  crumb: { group: "Learn", current: "Screen recording to demo video" } as Crumb,
  h1: "Turn a screen recording into a demo video.",
  lede: "A screen recording is footage. In vawe a coding agent trims the dead time, speeds up the waits, adds a title card and captions, and renders the result as an MP4. Your recording is shown as you made it: vawe does not redraw your app.",
  toc: [
    { href: "#steps", label: "How the edit runs" },
    { href: "#waits", label: "Cut and speed up" },
    { href: "#extras", label: "Titles, captions, a push" },
    { href: "#differs", label: "How this differs" },
    { href: "#moves", label: "The video components" },
    { href: "#more", label: "More on editing" },
  ] as Link[],
  steps: {
    id: "steps",
    title: "How the edit runs.",
    blocks: [
      {
        ol: [
          [{ strong: "Hand over the recording. " }, { code: "bin/vawe new demo --footage ~/Movies/demo.mov" }, " copies it into the film’s folder."],
          [{ strong: "Log it. " }, { code: "footage.md" }, " lists the length, the shot changes, the loudness, a contact sheet of 8\u00a0frames and, if you talk over it, a transcript, with every word timed in a words file beside it."],
          [{ strong: "Plan the cut. " }, "The agent fills a Cut list: one row per part with the in and out seconds, the speed and the reason."],
          [{ strong: "Write the page and render. " }, { code: "bin/vawe dev" }, " renders a half-size draft with sound. The final render waits for your OK."],
        ],
      },
      { p: ["A silent screen recording has no words to cut on, so the agent reads the contact sheet and asks you for the seconds it cannot see. vawe has no detector for an idle screen."] },
    ],
    code: ASK,
    cite: "prompts/edit-from-clips.md · harness/media/footage.mjs",
  } as Section,
  waits: {
    id: "waits",
    title: "Cut the dead time, speed up the waits.",
    blocks: [
      {
        p: [
          "Each part of the recording is a ",
          { code: "<video>" },
          " in its own beat. ",
          { code: "data-trim" },
          " and ",
          { code: "data-trim-end" },
          " keep one stretch, and ",
          { code: "data-rate" },
          " sets its speed. The example plays source seconds 12 to 32 at 4\u00a0times speed, so a 20-second upload takes 5\u00a0seconds of film.",
        ],
      },
      { p: ["The engine seeks the clip to an exact second on every frame. It never plays it live, so the same page gives the same frames on every render."] },
    ],
    code: PAGE,
    cite: "skills/vawe-page/SKILL.md, Video clips",
  } as Section,
  extras: {
    id: "extras",
    title: "Titles, captions and a push.",
    blocks: [
      {
        ol: [
          [{ strong: "Titles. " }, "A title card at the start and lower thirds that name a step."],
          [{ strong: "Captions. " }, "Word-timed captions from your narration, for a viewer who watches muted."],
          [{ strong: "A push. " }, "The camera-moves component pushes the whole clip toward a point the agent chooses. vawe does not follow your cursor and does not find the part of the screen that matters."],
        ],
      },
      { p: ["Music only comes from a file you give. Without one, the clip keeps its own sound."] },
    ],
    cite: "prompts/moves/README.md, Scope",
  } as Section,
  differs: {
    id: "differs",
    title: "How this differs from a launch or showcase video.",
    blocks: [
      {
        p: [
          "A ",
          { text: "launch video", href: "/launch-video" },
          " and a ",
          { text: "product showcase video", href: "/product-showcase-video" },
          " are built from captured UI that vawe animates. Here your recording is the picture. The agent trims it, times it and frames it, and it stays your pixels.",
        ],
      },
    ],
  } as Section,
  moves: {
    title: "The video components this edit uses.",
    lead: "A name on screen, captions for a muted viewer, a push on the whole clip and a soft change between parts.",
    clips: ["lower-third", "caption-karaoke", "camera-moves", "luma-matte-dissolve"],
  },
  more: cluster("/screen-recording-to-demo-video"),
  next: {
    title: "Start from your recording.",
    lead: [{ code: "bin/vawe new <name> --footage <file>" }, " logs it and starts the page."],
    primary: { href: REPO_URL, label: "Get vawe on GitHub" },
    related: [
      { href: "/edit-video-with-claude-code", label: "Edit video with Claude Code" },
      { href: "/product-showcase-video", label: "Product showcase videos" },
      { href: "/launch-video", label: "Launch videos" },
      { href: "/video-components", label: "Every video component, with its clip" },
    ],
  } as NextBlock,
};
