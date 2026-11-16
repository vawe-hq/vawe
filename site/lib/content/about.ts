import { REPO_URL } from "../schema";
import { MOVES } from "../moves";
import { FACTS } from "./facts";
import type { Crumb, Link, Meta, NextBlock, Para } from "./types";

export type Step = { lead: string; line: Para };
export type AboutSection = {
  id: string;
  title: string;
  className?: string;
  paragraphs?: Para[];
  steps?: Step[];
  cite?: string;
  filmCaption?: string;
};

const OWNER = { name: "Vandit Singh", url: "https://github.com/Vandit1604" };

export const ABOUT = {
  path: "/about",
  meta: {
    title: "About vawe: one HTML page in, one film out",
    description:
      "vawe renders one HTML page into a film. Why it exists, how it is built, the five rules it holds, who makes it and how to help. Open source under Apache-2.0.",
  } as Meta,
  owner: OWNER,
  crumb: { group: "Project", current: "About" } as Crumb,
  h1: "About vawe",
  lede: "vawe is an open source framework that renders one HTML page into a film.",
  toc: [
    { href: "#what", label: "What it is" },
    { href: "#facts", label: "Quick facts" },
    { href: "#why", label: "Why" },
    { href: "#built", label: "How it is built" },
    { href: "#rules", label: "Rules" },
    { href: "#who", label: "Who" },
    { href: "#help", label: "Get involved" },
  ] as Link[],
  sections: [
    {
      id: "what",
      title: "What it is",
      paragraphs: [
        [
          "You write one ",
          { code: "page.html" },
          `. The renderer seeks it frame by frame and encodes an MP4. The library has ${MOVES.length} video components, each a short clip and one markdown file to copy.`,
        ],
      ],
      filmCaption: "The showcase, a 14 s film. One page, rendered by vawe.",
    },
    {
      id: "facts",
      title: "Quick facts",
      steps: FACTS.map((f) => ({ lead: f.lead, line: f.a })),
    },
    {
      id: "why",
      title: "Why it exists",
      paragraphs: [
        [
          "AI agents write web code well. Most video tools ask for a private format that an agent has never seen. In vawe a film is one HTML page, written in what the agent already knows.",
        ],
        [
          "A blind A/B test of a custom JSON format against one HTML page went to the page: ",
          { text: "the test and its numbers", href: "/blog/html-over-json" },
          ".",
        ],
      ],
    },
    {
      id: "built",
      title: "How it is built",
      paragraphs: [
        [
          "vawe is open source under Apache-2.0. The repository started in June 2026 under the name Shortwave and became vawe on 2026-07-15. It has been public since 2026-09-16.",
        ],
        [
          "There is no npm package, no hosted API and no account. You clone the repo and run it on your machine: ",
          { text: "the quickstart", href: "/docs/quickstart" },
          ".",
        ],
      ],
    },
    {
      id: "rules",
      title: "Five rules",
      steps: [
        { lead: "Time is the seek.", line: ["The renderer sets the clock. A page has no timers and no unseeded random."] },
        { lead: "No private format.", line: ["A film is HTML, CSS, Web Animations, SVG, canvas or three.js."] },
        { lead: "Every number is a literal.", line: ["It sits in the page, so the studio edits it in place."] },
        { lead: "Checks advise.", line: ["Only determinism and a missing waiver reason refuse a render."] },
        { lead: "A fresh session judges.", line: ["The agent that wrote the film never records its own pass."] },
      ],
      cite: "AGENTS.md",
    },
    {
      id: "who",
      title: "Who makes it",
      className: "ab-who",
      paragraphs: [[`${OWNER.name} made the first commit and runs the vawe-hq organization, which owns the repository. GitHub profile: `, { text: "github.com/Vandit1604", href: OWNER.url }, "."]],
    },
    {
      id: "help",
      title: "Get involved",
      steps: [
        {
          lead: "Open an issue.",
          line: [
            "Report a bug, or something natural to write that the renderer rejects, in the ",
            { text: "GitHub issues", href: `${REPO_URL}/issues` },
            ". The project treats that as a framework bug.",
          ],
        },
        {
          lead: "Read the repo.",
          line: ["Start with ", { code: "AGENTS.md" }, " and ", { code: "CONTRIBUTING.md" }, " in ", { text: "the repository", href: REPO_URL }, "."],
        },
        {
          lead: "Read the blog.",
          line: ["The ", { text: "blog", href: "/blog" }, " records what broke and what was measured."],
        },
      ],
    },
  ] as AboutSection[],
  next: {
    title: "What is next",
    lead: ["The roadmap lists what is in work now, what comes next and what is later. Each item links to the problem it addresses."],
    primary: { href: "/problems#roadmap", label: "Read the roadmap" },
    secondary: { href: REPO_URL, label: "vawe on GitHub" },
  } as NextBlock,
};
