import { REPO_URL } from "../schema";
import { MOVES } from "../moves";
import type { Link } from "./types";

export type CodePart = { kind?: "dim" | "tag"; text: string };
export type Command = { cmd: string; note: string };

export const HOME = {
  hero: {
    film: "tracking-hud",
    brand: "vawe · HTML to video for developers and AI agents",
    h1: ["One page in.", "One film out."],
    lede: "Write one HTML page. vawe renders it to an mp4. You write the page, or an agent does.",
    primary: { href: REPO_URL, label: "Get started on GitHub" } as Link,
    secondary: { href: "/video-components", label: "See the video components" } as Link,
  },
  chapters: [
    {
      id: "c1",
      tag: "01 / The problem",
      title: "A motion video takes an editor and a week.",
      text: "Timelines, keyframes, private project files. Nothing an agent can read, and nothing you can diff.",
      film: "retro-remix",
    },
    {
      id: "c2",
      tag: "02 / The page · CINDRE, one page.html",
      title: "So write a page.",
      text: "HTML, CSS, Web Animations, SVG, canvas or three.js. Nothing private to learn.",
      film: "cindre",
    },
    {
      id: "c3",
      tag: "03 / The result · showcase, 14 s",
      title: "One mp4. Every canvas.",
      text: "16:9, 9:16, 1:1, 4:5 and 4:3 from the same page. Audio mixed offline.",
      film: "showcase",
    },
  ],
  how: {
    title: "A film is one page.",
    codeLabel: "A complete film page",
    code: [
      { kind: "dim", text: "<!doctype html>\n<html data-aspect=\"16:9\">\n" },
      { kind: "tag", text: "<meta" }, { text: " name=\"duration\" content=\"3\"" }, { kind: "tag", text: ">" }, { text: "\n" },
      { kind: "tag", text: "<meta" }, { text: " name=\"message\" content=\"One page. One film.\"" }, { kind: "tag", text: ">" }, { text: "\n" },
      { kind: "tag", text: "<style>" },
      { text: "\n  body { margin: 0; display: grid; place-items: center start;\n         height: 100vh; padding-left: 8vw; background: #000; }\n  h1 { font: 800 9vh/1 system-ui; color: #fff;\n       animation: rise 0.7s var(--ease-land) 0.3s both; }\n  @keyframes rise {\n    from { translate: 0 6vh; clip-path: inset(0 0 100% 0); }\n    to   { translate: 0 0;   clip-path: inset(0 0 0 0); }\n  }\n" },
      { kind: "tag", text: "</style>" }, { text: "\n" },
      { kind: "tag", text: "<h1>" }, { text: "One page. One film." }, { kind: "tag", text: "</h1>" },
    ] as CodePart[],
    codeFile: "films/hello/page.html",
    side: "Open it in a browser and it plays. Hand it to vawe and it seeks the page to each frame, so frame 412 is the same on every run. A change to the motion is a diff you can read before it ships.",
    commands: [
      { cmd: "bin/vawe new hello", note: "a valid starter" },
      { cmd: "bin/vawe dev films/hello/page.html", note: "draft, 30 fps" },
      { cmd: "bin/vawe ship films/hello/page.html", note: "final, 60 fps" },
    ] as Command[],
    contract: { href: REPO_URL, label: "Read the page contract" } as Link,
  },
  moves: {
    title: `${MOVES.length} video components to copy.`,
    all: { href: "/video-components", label: "See every video component" } as Link,
    shown: ["text-on-path", "letter-stagger", "panel-live-sync", "integration-hub", "outline-fill", "iris-wipe"],
  },
  faqTitle: "Questions.",
  end: {
    title: "Write the page.",
    primary: { href: REPO_URL, label: "Get started on GitHub" } as Link,
    docs: { href: "/docs", label: "Read the docs" } as Link,
    install: [
      { cmd: "npm install", note: "Node 22+, ffmpeg" },
      { cmd: "bin/vawe-dev doctor", note: "checks each tool" },
    ] as Command[],
  },
};
