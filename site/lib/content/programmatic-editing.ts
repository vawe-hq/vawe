import { REPO_URL } from "../schema";
import { cluster } from "./agentic-editing";
import type { Crumb, Link, Meta, NextBlock, Section, Table } from "./types";

export const READ_DATE = "2026-11-09";

const TABLE: Table = {
  head: ["Tool", "Licence", "An edit is written as", "Stronger at"],
  rows: [
    { cells: [["ffmpeg"], ["LGPL v2.1 or later; some optional parts GPL"], ["Command-line options and filters such as ", { code: "trim" }, ", ", { code: "setpts" }, ", ", { code: "drawtext" }, " and ", { code: "xfade" }], ["Nearly any audio or video format, and silence filters built in"]] },
    { cells: [["MoviePy"], ["MIT"], ["Python: clips you cut, join and composite, then write out"], ["Custom effects, because every pixel is a numpy array"]] },
    { cells: [["Editly"], ["MIT"], ["A JSON5 spec or a short command, run by Node and ffmpeg"], ["A quick slideshow or trailer with transitions and music"]] },
    { cells: [["Remotion"], ["Free for individuals, small companies and non-profits; a company licence for larger for-profits"], ["React components that render to video"], ["A React team, an editor-like Studio, batch rendering"]] },
    { vawe: true, cells: [["vawe"], ["Apache-2.0"], ["One HTML page: each clip is a ", { code: "<video>" }, " with in, out and speed"], ["An agent that edits clips and builds the titles and captions in the same page"]] },
  ],
};

export const PROGRAMMATIC_EDITING = {
  path: "/programmatic-video-editing",
  meta: {
    title: "Edit video with code: ffmpeg, MoviePy, Editly, Remotion, vawe",
    description:
      "Edit video with code: ffmpeg, MoviePy, Editly, Remotion and vawe compared on licence, how an edit is written and what an agent must learn.",
  } as Meta,
  crumb: { group: "Learn", current: "Edit video with code" } as Crumb,
  h1: "Edit video with code: ffmpeg, MoviePy, Editly, Remotion and vawe compared.",
  lede: "Programmatic video editing means the cut is written as code or data, so a script or an AI agent can make it and make it again. This page compares five tools that do it: what each one is, its licence, how you write an edit, and what an agent has to learn first. The facts come from each tool’s own repo or docs, read on 2026-11-09.",
  toc: [
    { href: "#table", label: "The five side by side" },
    { href: "#tools", label: "What each one is" },
    { href: "#agent", label: "What an agent must learn" },
    { href: "#pick", label: "Pick by the job" },
    { href: "#sources", label: "Sources" },
    { href: "#more", label: "More on editing" },
  ] as Link[],
  table: {
    title: "The five side by side.",
    lead: "Licences and write-ups are from each project’s own repo.",
    data: TABLE,
  },
  tools: {
    id: "tools",
    title: "What each one is.",
    blocks: [
      {
        ol: [
          [{ strong: "ffmpeg. " }, "A multimedia toolkit for decoding, transcoding and filtering nearly any audio or video. It has filters for trimming, speed, text, transitions and silence. Editly needs it installed, and MoviePy’s own README says MoviePy is slower than using ffmpeg directly. The repo showed about 66,800 stars."],
          [{ strong: "MoviePy. " }, "A Python library for cuts, concatenations, title insertions and compositing. A short script opens a file, takes the subclip from 10 to 20\u00a0seconds, adds a text clip and writes the result. It turns frames into numpy arrays, so you can write any pixel effect. MoviePy 2.0 broke the v1 API and v1 is no longer maintained. The repo showed about 15,100 stars."],
          [{ strong: "Editly. " }, "A declarative editor for Node.js and ffmpeg. You list clips, images, audio and titles in a JSON5 spec or on the command line. It adds transitions and music, fits clips to any size and aspect with letterboxing, and accepts custom canvas, Fabric.js and GL shader code. The repo showed about 5,600 stars, and its last push was on 2025-05-12."],
          [{ strong: "Remotion. " }, "A way to make video with React. You write components, and its ", { code: "<Html5Video>" }, " has ", { code: "trimBefore" }, " and ", { code: "playbackRate" }, " props for a clip. Its README lists making video with an agent, and batch rendering. The licence is free for individuals, for-profit companies of up to 3 employees and non-profits; larger for-profits need a company licence. The repo showed about 72,000 stars."],
          [{ strong: "vawe. " }, "An open-source framework: the agent writes one HTML page and vawe renders it frame by frame to an MP4. A clip is a ", { code: "<video>" }, " with ", { code: "data-at" }, ", ", { code: "data-trim" }, " and ", { code: "data-rate" }, ". Titles, captions and transitions are in the same page. Transcripts come from whisper.cpp on your machine."],
        ],
      },
    ],
  } as Section,
  agent: {
    id: "agent",
    title: "What an agent must learn before it can cut.",
    blocks: [
      { p: ["An agent cannot watch the footage, so each tool asks for something different."] },
      {
        ol: [
          [{ strong: "ffmpeg. " }, "Filter and option syntax. A cut is a start and an end in seconds that the agent must work out from the file."],
          [{ strong: "MoviePy. " }, "The v2 API, not the v1 one it may remember, and the Python around it. It cuts where the agent says; it does not say where."],
          [{ strong: "Editly. " }, "A spec format with a short list of clip, title and transition types. Custom motion means canvas, Fabric.js or shader code."],
          [{ strong: "Remotion. " }, "React, the component model and the timeline in frames."],
          [{ strong: "vawe. " }, "The page rules in ", { code: "AGENTS.md" }, " and the clip attributes. ", { code: "footage.md" }, " gives it each clip’s length, shots, loudness and a transcript, and a words file beside it times every word, so it cuts on a word end."],
        ],
      },
    ],
    cite: "prompts/edit-from-clips.md · harness/media/footage.mjs",
  } as Section,
  pick: {
    id: "pick",
    title: "Pick by the job.",
    blocks: [
      {
        ol: [
          ["You convert, join or cut files in bulk and need no graphics: ffmpeg."],
          ["You are in Python and want a custom pixel effect: MoviePy."],
          ["You want a quick edit of clips, images and titles from one spec: Editly."],
          ["Your team writes React and wants an editor-like Studio: Remotion."],
          ["An agent edits your clips and builds the titles, captions and transitions in one place: vawe. It does not cut filler words, and it does not track or mask objects."],
        ],
      },
    ],
  } as Section,
  sources: {
    id: "sources",
    title: "Sources, read on 2026-11-09.",
    blocks: [
      {
        ol: [
          [{ text: "FFmpeg LICENSE.md", href: "https://github.com/FFmpeg/FFmpeg/blob/master/LICENSE.md" }, ": licence."],
          [{ text: "FFmpeg filters documentation", href: "https://ffmpeg.org/ffmpeg-filters.html" }, ": the trim, setpts, drawtext, xfade, silencedetect and silenceremove filters."],
          [{ text: "FFmpeg about page", href: "https://ffmpeg.org/about.html" }, ": what it describes itself as."],
          [{ text: "MoviePy README", href: "https://github.com/Zulko/moviepy#readme" }, ": the example, numpy arrays, the v2 note and the speed note. MIT licence on the repo."],
          [{ text: "Editly README", href: "https://github.com/mifi/editly#readme" }, ": features and requirements. MIT licence on the repo."],
          [{ text: "Remotion LICENSE.md", href: "https://github.com/remotion-dev/remotion/blob/main/LICENSE.md" }, ": the free and company licences."],
          [{ text: "Remotion README", href: "https://github.com/remotion-dev/remotion#readme" }, ": agents, batch rendering."],
          [{ text: "Remotion Html5Video docs", href: "https://www.remotion.dev/docs/video" }, ": trimBefore and playbackRate."],
          ["Star counts and last push dates: each repo’s GitHub page, read through the GitHub API."],
          [{ text: "vawe LICENSE", href: "https://github.com/vawe-hq/vawe/blob/main/LICENSE" }, "; vawe’s own facts are in the repo’s ", { code: "prompts/edit-from-clips.md" }, " and ", { code: "skills/vawe-page/SKILL.md" }, "."],
        ],
      },
    ],
  } as Section,
  more: cluster("/programmatic-video-editing"),
  next: {
    title: "Try the edit with an agent.",
    lead: [{ code: "bin/vawe new <name> --footage <folder>" }, " logs the clips and starts the page."],
    primary: { href: REPO_URL, label: "Get vawe on GitHub" },
    related: [
      { href: "/agentic-video-editing", label: "Agentic video editing" },
      { href: "/remotion-alternatives", label: "Remotion alternatives" },
      { href: "/vs/remotion", label: "vawe vs Remotion" },
      { href: "/vs/openedit", label: "vawe vs OpenEdit" },
    ],
  } as NextBlock,
};
