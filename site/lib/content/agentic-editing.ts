import { REPO_URL } from "../schema";
import type { Code, Crumb, Link, Meta, NextBlock, Section } from "./types";

const CLUSTER_LINKS = [
  { path: "/edit-video-with-claude-code", item: [{ text: "Edit video with Claude Code", href: "/edit-video-with-claude-code" }, ": the steps in Claude Code, Codex or Cursor, and the questions the agent asks first."] },
  { path: "/agentic-video-editing", item: [{ text: "Agentic video editing", href: "/agentic-video-editing" }, ": how an agent reads footage it cannot watch, and what an edit can and cannot do."] },
] as const;

// The cluster list for one page: every sibling but the page itself.
const cluster = (self: string): Section => ({
  id: "more",
  title: "More on editing with an agent.",
  blocks: [
    {
      ol: [
        ...CLUSTER_LINKS.filter((l) => l.path !== self).map((l) => [...l.item]),
        [{ text: "vawe vs video-use", href: "/vs/video-use" }, ": another open-source way to edit clips with a coding agent, and when it is the better choice."],
        [{ text: "Captions on a video, in HTML", href: "/blog/animated-captions-html" }, ": word-timed captions, the part of an edit a muted viewer reads."],
        [{ text: "Aspect ratios without cropping", href: "/blog/html-video-aspect-ratios" }, ": one edit at 16:9, 9:16, 1:1 or 4:5."],
      ],
    },
  ],
});

export const AGENTIC_EDITING = {
  path: "/agentic-video-editing",
  meta: {
    title: "Agentic video editing: your coding agent cuts your clips | vawe",
    description:
      "Agentic video editing with vawe: a coding agent reads your clips as text, writes the cut as one HTML page, and vawe renders the MP4. Open source and local.",
  } as Meta,
  crumb: { group: "Learn", current: "Agentic video editing" } as Crumb,
  h1: "Agentic video editing: your coding agent cuts your clips.",
  lede: "Agentic video editing is editing where an AI agent makes the cuts: it reads the footage, chooses the order, the trims and the timing, and renders the result. In vawe, a coding agent such as Claude Code, Codex or Cursor reads your clips as text, writes the edit as one HTML page, and vawe renders it frame by frame to an MP4 on your machine.",
  toc: [
    { href: "#how", label: "How an edit runs" },
    { href: "#reads", label: "How the agent reads footage" },
    { href: "#scope", label: "What it can and cannot do" },
    { href: "#moves", label: "The video components" },
    { href: "#more", label: "More on editing" },
  ] as Link[],
  how: {
    id: "how",
    title: "How an edit runs: five steps from a folder to an MP4.",
    blocks: [
      {
        ol: [
          [{ strong: "Hand over the clips. " }, { code: "bin/vawe new trip-edit --footage ~/Movies/trip" }, " copies them into the film’s folder."],
          [{ strong: "Log them. " }, "vawe writes ", { code: "footage.md" }, ": each clip’s length, shots, loudness, a contact sheet and a transcript with a time for every word."],
          [{ strong: "Plan the cut. " }, "The agent fills a Cut list: one row per beat with the clip, the in and out seconds, the speed and the reason."],
          [{ strong: "Write one page. " }, "Each clip is a ", { code: "<video>" }, " inside its beat. ", { code: "data-at" }, ", ", { code: "data-trim" }, " and ", { code: "data-rate" }, " say which second shows when, and the engine seeks it every frame."],
          [{ strong: "Render. " }, { code: "bin/vawe dev" }, " renders a half-size draft with sound. The final render waits for your OK."],
        ],
      },
    ],
    cite: "prompts/edit-from-clips.md · skills/vawe-page/SKILL.md, Video clips",
  } as Section,
  reads: {
    id: "reads",
    title: "An agent cannot watch video, so it reads it.",
    blocks: [
      {
        p: [
          "A model that looked at every frame would spend its budget on noise. ",
          { code: "footage.md" },
          " gives it the facts it can act on: where the shots change, how loud each clip is, and which word is spoken at which second. The agent cuts on a word end or an action, never on a guess from a file name.",
        ],
      },
      {
        p: [
          "The transcripts come from whisper.cpp on your machine, so there is no API key and no upload. Install it once with ",
          { code: "brew install whisper-cpp" },
          " and a 148\u00a0MB model; the first footage log prints the download line if the model is missing.",
        ],
      },
    ],
    cite: "harness/media/footage.mjs",
  } as Section,
  scope: {
    id: "scope",
    title: "What it can and cannot do.",
    blocks: [
      { p: ["Your clips are content, moved whole. An agent edit can:"] },
      {
        ol: [
          ["Trim, order and change the speed of each clip."],
          ["Cut the silences in speech and keep every word whole."],
          ["Add title cards, lower thirds and word-timed captions."],
          ["Grade the colour and add transitions between clips."],
          ["Mix music from a file you give, with speech ducking it."],
        ],
      },
      {
        p: [
          "It does not process the picture inside a clip: no tracking, no rotoscoping, no depth cuts and no generated video. An edit is usually 8 to 60\u00a0seconds, 16:9 by default, and a clip is never cropped to fit another aspect.",
        ],
      },
    ],
    cite: "guides/ROUTING.md, edit scope",
  } as Section,
  moves: {
    title: "The video components an edit uses most.",
    lead: "Captions for a muted viewer, a name on screen, a soft change between clips and a fast one. Open a video component for its snippet and notes.",
    clips: ["caption-karaoke", "lower-third", "luma-matte-dissolve", "whip-pan"],
  },
  more: cluster("/agentic-video-editing"),
  next: {
    title: "Start an edit from your clips.",
    lead: [
      { code: "bin/vawe new <name> --footage <folder>" },
      " logs the clips, writes the Cut list and a starter page, then asks the details the edit needs, each with a default.",
    ],
    primary: { href: REPO_URL, label: "Get vawe on GitHub" },
    related: [
      { href: "/edit-video-with-claude-code", label: "Edit video with Claude Code" },
      { href: "/vs/video-use", label: "vawe vs video-use" },
      { href: "/ai-agents", label: "How an agent writes a film" },
      { href: "/video-components", label: "Every video component, with its clip" },
    ],
  } as NextBlock,
};

const SETUP: Code = {
  label: "Set up once",
  text: [
    "git clone https://github.com/vawe-hq/vawe && cd vawe",
    "npm install",
    "npx puppeteer browsers install chrome",
    "brew install ffmpeg whisper-cpp",
    "# the first footage log prints the",
    "# whisper model download line (148\u00a0MB)",
  ].join("\n"),
};

const ASK: Code = {
  label: "Then ask in plain words",
  text: ["Edit the clips in ~/Movies/trip", "into a 20-second film.", "Keep the speech whole, cut the silences,", "add a title card and captions."].join("\n"),
};

export const EDIT_WITH_CLAUDE_CODE = {
  path: "/edit-video-with-claude-code",
  meta: {
    title: "Edit video with Claude Code, Codex or Cursor | vawe",
    description:
      "Edit your own video with Claude Code: give it a folder of clips and it writes the cut, the titles and the captions. Open source, local, no API key.",
  } as Meta,
  crumb: { group: "Learn", current: "Edit video with Claude Code" } as Crumb,
  h1: "Edit video with Claude Code.",
  lede: "Claude Code can edit video when it has a tool that turns an edit into text. vawe is that tool: the agent reads your clips through footage.md, writes the edit as one HTML page, and vawe renders the MP4. The same steps work in Codex and Cursor.",
  toc: [
    { href: "#setup", label: "Set up" },
    { href: "#steps", label: "What the agent does" },
    { href: "#questions", label: "The questions it asks" },
    { href: "#gotchas", label: "Mistakes it avoids" },
    { href: "#more", label: "More on editing" },
  ] as Link[],
  setup: {
    id: "setup",
    title: "Set up once, then ask.",
    blocks: [
      {
        p: [
          "You need Node 22 or newer, ffmpeg and whisper.cpp. Open Claude Code in the checkout: it reads ",
          { code: "CLAUDE.md" },
          ", which points to ",
          { code: "AGENTS.md" },
          ", the rules for every agent. Codex and Cursor read ",
          { code: "AGENTS.md" },
          " directly.",
        ],
      },
    ],
    code: SETUP,
    cite: "AGENTS.md, Start",
  } as Section,
  ask: {
    id: "ask",
    title: "Ask for the edit in one sentence.",
    blocks: [{ p: ["Claude Code runs the vawe commands for you. A request like this one is enough:"] }],
    code: ASK,
  } as Section,
  steps: {
    id: "steps",
    title: "What the agent does with your request.",
    blocks: [
      {
        ol: [
          [{ strong: "Logs the clips. " }, { code: "bin/vawe new trip-edit --footage ~/Movies/trip" }, " copies them and writes ", { code: "footage.md" }, "."],
          [{ strong: "Asks what it cannot guess. " }, "Five questions, each with a default, in one message."],
          [{ strong: "Fills the Cut list. " }, "One row per beat: clip, in, out, speed, why."],
          [{ strong: "Writes the page. " }, "The clips, the title card and the captions in one HTML file."],
          [{ strong: "Renders a draft. " }, { code: "bin/vawe dev" }, " renders it half size with sound, for you to watch."],
          [{ strong: "Waits for you. " }, "You approve the plan and the draft with ", { code: "/vawe-approve" }, ". The agent never approves its own work. Then ", { code: "bin/vawe ship" }, " renders the final."],
        ],
      },
    ],
    cite: "prompts/edit-from-clips.md · AGENTS.md, Hard rules",
  } as Section,
  questions: {
    id: "questions",
    title: "The five questions it asks first.",
    blocks: [
      {
        ol: [
          [{ strong: "Story. " }, "What is the one thing the film says? Default: the clips in the order shot, each trimmed to its best moment."],
          [{ strong: "Voice. " }, "Which speech must stay? Default: keep speech whole, cut silence over 0.5\u00a0seconds."],
          [{ strong: "Music. " }, "Is there a track? Default: none, the clips’ own sound with small effects on cuts."],
          [{ strong: "Titles. " }, "A title card and captions, or the clips alone? Default: one title card, and captions where a clip needs context."],
          [{ strong: "Length and canvas. " }, "How long, and which aspect? Default: the sum of the cuts, at 16:9."],
        ],
      },
    ],
    cite: "prompts/edit-from-clips.md, Questions",
  } as Section,
  gotchas: {
    id: "gotchas",
    title: "Mistakes the agent is told to avoid.",
    blocks: [
      {
        ol: [
          ["Choosing a cut from the file name instead of footage.md, which shows the wrong second."],
          ["Playing a clip live. The page states the times, and the engine seeks."],
          ["Removing a clip from the page to hide it, instead of hiding its beat."],
          ["Holding a clip for under 1.2\u00a0seconds, which reads as a flash."],
        ],
      },
    ],
    cite: "prompts/edit-from-clips.md, Gotchas",
  } as Section,
  more: cluster("/edit-video-with-claude-code"),
  next: {
    title: "Give Claude Code your clips.",
    lead: ["Clone vawe, open the checkout in Claude Code, and ask for the edit in one sentence."],
    primary: { href: REPO_URL, label: "Get vawe on GitHub" },
    related: [
      { href: "/agentic-video-editing", label: "Agentic video editing, explained" },
      { href: "/vs/video-use", label: "vawe vs video-use" },
      { href: "/ai-agents", label: "How an agent writes a film" },
    ],
  } as NextBlock,
};
