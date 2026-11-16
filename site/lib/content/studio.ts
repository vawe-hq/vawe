import { REPO_URL } from "../schema";
import type { Code, Crumb, Link, Meta, NextBlock, Section } from "./types";

const OPEN: Code = {
  label: "Open a film in the studio",
  text: ["bin/vawe dev films/my-film/page.html --studio", "", "  vawe studio (page): films/my-film/page.html", "    open  http://127.0.0.1:8799/studio", "    Ctrl-C to stop."].join("\n"),
};

const PATCH: Code = {
  label: "Drag a key from 2\u00a0s to 2.4\u00a0s: one literal changes",
  text: ["-  [2, 0.62], [3.4, 1]", "+  [2.4, 0.62], [3.4, 1]"].join("\n"),
};

export const STUDIO = {
  path: "/studio",
  meta: {
    title: "Edit an AI-made video by hand: the vawe studio | vawe",
    description: "Open any vawe film in a live editor: scrub the timeline, drag keys, change colours and text. Every edit is a text patch in the HTML page.",
  } as Meta,
  crumb: { group: "Learn", current: "The studio" } as Crumb,
  h1: "Edit an AI-made video by hand.",
  lede: "An agent writes your film as one HTML page. The vawe studio opens that page in a live editor on your machine. You scrub the film, drag its keys and change its colours and text. Each change is a small text edit in the page file, so the agent can keep working on the same film.",
  toc: [
    { href: "#open", label: "Open it" },
    { href: "#panels", label: "What each panel does" },
    { href: "#patch", label: "Edits are text" },
    { href: "#limits", label: "What it does not do" },
    { href: "#more", label: "More" },
  ] as Link[],
  open: {
    id: "open",
    title: "Open it with one command.",
    blocks: [
      {
        p: [
          "Run the command with ",
          { code: "--studio" },
          " and open the address it prints. Leave it running while you work and press Ctrl-C to stop. The default port is 8799. ",
          { code: "--port" },
          " changes it.",
        ],
      },
      { p: ["The studio seeks the page to a time. It does not play it on a clock. It uses the same clock and seek code as the renderer, so a frame you see is the frame the render makes."] },
    ],
    code: OPEN,
    shot: { src: "/studio/studio-main.webp", alt: "The vawe studio showing the colour-sting example: a preview of the film, aspect buttons, a timeline of keys, and the Key panel on the right.", w: 1440, h: 900 },
    cite: "studio/README.md · harness/cli/verbs.mjs",
  } as Section,
  panels: {
    id: "panels",
    title: "What each panel does.",
    blocks: [
      {
        ol: [
          [{ strong: "Preview and aspect. " }, "The film in a frame. Buttons switch between 16:9, 9:16, 1:1, 4:5 and 4:3 to check one page at each size."],
          [{ strong: "Transport. " }, "Play, step one frame, scrub the ruler, zoom the timeline. Space plays. Left and right step a frame."],
          [{ strong: "Timeline. " }, "One row for each animated element, with a diamond for each key. Drag a diamond to move that key in time."],
          [{ strong: "Key. " }, "Select a key to change its duration, delay and easing. The ease menu draws each curve and tries it in the preview as you hover."],
          [{ strong: "Vars. " }, "The colours and numbers in the page’s ", { code: ":root" }, " properties, with a swatch for each colour."],
          [{ strong: "Text. " }, "Every line of text in the film, in a box you can edit."],
          [{ strong: "Chat. " }, "Ask for a change in words. It runs ", { code: "claude -p" }, " on this machine, so Claude Code must be installed. It may edit only this page file."],
          [{ strong: "Job. " }, "The output of the buttons at the top: Critique runs ", { code: "vawe critique" }, ", Draft render runs ", { code: "vawe dev" }, " and Final render runs ", { code: "vawe ship" }, ". Undo takes back your last edit."],
        ],
      },
    ],
    shot: { src: "/studio/studio-vars.webp", alt: "The Vars panel of the vawe studio listing three colour properties, each with a swatch and a hex value.", w: 1440, h: 900 },
    cite: "studio/ui/page-studio.html · studio/ui/page-studio.js",
  } as Section,
  patch: {
    id: "patch",
    title: "Every edit is a text patch in the page.",
    blocks: [
      {
        p: [
          "A tunable is a literal in the page: a ",
          { code: "[[frame, value]]" },
          " table, a ",
          { code: "@keyframes" },
          " stop, an ",
          { code: "element.animate" },
          " keyframe or a ",
          { code: ":root" },
          " property. The studio changes that text and nothing else. A save that changes nothing is a zero-byte diff.",
        ],
      },
      { p: ["The studio checks the file about once a second. If you or an agent change the page outside the studio, it reloads the new page. The agent reads the same file and carries on."] },
    ],
    code: PATCH,
    cite: "studio/README.md · studio/page-source.mjs",
  } as Section,
  limits: {
    id: "limits",
    title: "What it does not do.",
    blocks: [
      {
        ol: [
          [{ strong: "It edits what the page states as a literal. " }, "A value the page computes has no number to change, so the studio leaves it locked. Ask the agent for that one."],
          [{ strong: "It does not make the film. " }, "The agent writes the page. The studio is for the changes you can see and want to make by hand."],
          [{ strong: "The final render keeps its gate. " }, { code: "vawe ship" }, " refuses to run until the plan and the draft have your OK."],
        ],
      },
    ],
    cite: "AGENTS.md · studio/ui/page-edit.js",
  } as Section,
  more: {
    id: "more",
    title: "More on how an agent makes the film.",
    blocks: [
      {
        ol: [
          [{ text: "How an agent writes the page", href: "/ai-agents" }, ": the loop from request to final render."],
          [{ text: "Edit video with Claude Code", href: "/edit-video-with-claude-code" }, ": the steps in Claude Code, Codex or Cursor."],
          [{ text: "What vawe does for you", href: "/features" }, ": the decisions the engine makes."],
          [{ text: "How-to guides", href: "/how-to" }, ": one guide per editing task."],
        ],
      },
    ],
  } as Section,
  next: {
    title: "Open your film in the studio.",
    lead: [{ code: "bin/vawe dev films/<name>/page.html --studio" }, " prints the address."],
    primary: { href: REPO_URL, label: "Get vawe on GitHub" },
    related: [
      { href: "/ai-agents", label: "How an agent writes the page" },
      { href: "/features", label: "What vawe does for you" },
      { href: "/how-to", label: "How-to guides" },
    ],
  } as NextBlock,
};
