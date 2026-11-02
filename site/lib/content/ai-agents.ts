import type { Section, Table } from "./types";
import type { QA } from "./alt-evidence";

export const AGENT_STEPS: Section = {
  id: "steps",
  title: "What an agent does, step by step.",
  blocks: [
    {
      ol: [
        [{ strong: "Reads the rules. " }, "The agent reads ", { code: "AGENTS.md" }, " at the root of the checkout. Codex and Cursor read that file. Claude Code reads ", { code: "CLAUDE.md" }, ", which points to it."],
        [{ strong: "Starts a film. " }, { code: "bin/vawe new" }, " asks for the facts the request lacks, then writes ", { code: "page.html" }, " and ", { code: "brief.md" }, ". With ", { code: "--defaults" }, " it guesses and marks each guess."],
        [{ strong: "Plans the shots. " }, "The agent studies reference frames, fills the brief and builds one key frame for each beat with ", { code: "bin/vawe frame" }, "."],
        [{ strong: "Writes the page. " }, "The page is HTML, CSS, Web Animations, SVG, canvas or three.js. Time comes from the seek, so the page has no timers and no unseeded random."],
        [{ strong: "Renders a draft. " }, { code: "bin/vawe dev" }, " renders half size at 30\u00a0fps with the audio mixed. The agent can render only the hard 2 to 4\u00a0seconds."],
        [{ strong: "Asks a fresh session to look. " }, { code: "bin/vawe critique" }, " lays out the frames. A session that did not write the page reads them and names the seconds to fix."],
        [{ strong: "Fixes only those seconds. " }, "The agent renders the named range again, not the whole film."],
        [{ strong: "Ships after approval. " }, "The owner runs ", { code: "bin/vawe approve" }, ". The agent never does. ", { code: "bin/vawe ship" }, " then renders 60\u00a0fps with motion blur, and ", { code: "bin/vawe wait" }, " prints the result."],
      ],
    },
  ],
  cite: "AGENTS.md · bin/vawe --help",
};

export const AGENT_COMMANDS: { title: string; lead: string; data: Table } = {
  title: "The commands an agent uses.",
  lead: "Ten verbs make up the loop. Run bin/vawe --help for them and bin/vawe --help --all for the rest. Every verb takes --help.",
  data: {
    head: ["command", "an agent runs it when"],
    rows: [
      { cells: [[{ code: "new" }], ["it starts a film, or recreates a reference mp4"]] },
      { cells: [[{ code: "see" }], ["it needs to read a film, page or reference as numbers: shots, motion, light, type, sound"]] },
      { cells: [[{ code: "frame" }], ["it needs a picture: one frame, a sheet of frames, one frame per world or per cut"]] },
      { cells: [[{ code: "dev" }], ["it wants a draft: half size, 30\u00a0fps, with sound"]] },
      { cells: [[{ code: "critique" }], ["a draft is ready for fresh eyes: phone sheet, strip, loop seam, measured deltas"]] },
      { cells: [[{ code: "check" }], ["it runs one named gate or report"]] },
      { cells: [[{ code: "sound" }], ["it chooses, checks or cuts to sound"]] },
      { cells: [[{ code: "refs" }], ["it studies references before it designs"]] },
      { cells: [[{ code: "ship" }], ["the owner approved the draft: 60\u00a0fps, motion blur, audio mixed"]] },
      { cells: [[{ code: "wait" }], ["a render or critique is running and the agent needs its result line, so it never sleeps"]] },
    ],
  },
};

export const AGENT_PAGE: Section = {
  id: "page",
  title: "What the agent writes.",
  blocks: [
    {
      p: [
        "A film is ",
        { code: "films/<name>/page.html" },
        " and its own assets folder. One ",
        { code: "<meta name=\"duration\">" },
        " tag sets the length. Each beat is one element with ",
        { code: "data-world" },
        ". Time is the seek: CSS keyframes and ",
        { code: "element.animate()" },
        " follow it, or the page defines ",
        { code: "window.seek(t)" },
        " and paints frame t. A virtual clock owns ",
        { code: "Date" },
        ", timers, ",
        { code: "requestAnimationFrame" },
        " and ",
        { code: "Math.random" },
        ", so a page that works in a draft gives the same frames in the final.",
      ],
    },
    {
      p: [
        "Audio is ",
        { code: "<audio>" },
        " tags with a start time, mixed offline. Layout is CSS, and one page works at 16:9, 9:16, 1:1, 4:5 and 4:3. The full contract is in ",
        { text: "the page contract", href: "/blog/page-contract" },
        " and ",
        { text: "the docs", href: "/docs/the-page" },
        ".",
      ],
    },
  ],
  cite: "AGENTS.md · site/content/agent-guide.md",
};

export const AGENT_LIMITS: Section = {
  id: "limits",
  title: "Limits to know first.",
  blocks: [
    {
      p: [
        "vawe is a source install, not an npm package or a hosted service. It renders on one machine. Output can differ between hosts that rasterize on a different GPU or Chrome version. It is a code-first renderer: if a person wants to edit a timeline by eye, an editor fits better.",
      ],
    },
  ],
  cite: "site/content/agent-guide.md",
};

export const AGENT_FAQ: QA[] = [
  {
    q: "Which AI agents can make a video with vawe?",
    a: ["Any agent that reads files and runs shell commands. Claude Code, Codex and Cursor all read the repo rules, and each ", { code: "bin/vawe" }, " verb prints a ", { code: "next:" }, " line that names the following step."],
  },
  {
    q: "Does the agent need to learn a video format?",
    a: ["No. The film is one HTML page. The agent writes the CSS, Web Animations, SVG, canvas or three.js it already writes. If something it would naturally write fails, that is a bug in the engine."],
  },
  {
    q: "Who judges the film?",
    a: ["A session that did not write the page. The writer fixes the seconds the critique names. A pass is never recorded by the session that wrote the film."],
  },
  {
    q: "Is there a hosted API?",
    a: ["No. vawe runs from source on your machine and needs no account. See ", { text: "install", href: "/docs/install" }, " and ", { text: "the quickstart", href: "/docs/quickstart" }, "."],
  },
  {
    q: "Where do the agent docs live?",
    a: [{ text: "Use with an agent", href: "/docs/agents" }, " in the docs covers setup for each tool. ", { text: "HTML to MP4 with Claude Code", href: "/docs/html-to-mp4-with-claude-code" }, " walks one film through."],
  },
];
