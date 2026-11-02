import { MOVES } from "../moves";
import { REPO_URL } from "../schema";
import type { Link, NextBlock } from "./types";
export type Source = { label: string; url: string };
export type Mark = "yes" | "no" | "partial";
export type Row = { feature: string; them: string; vawe: string; t?: Mark; v?: Mark };
export type Qa = { q: string; a: string };

export type Rival = {
  slug: string;
  name: string;
  read: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  what: string;
  stronger: string[];
  chooseThem: string[];
  choosevawe: string[];
  rows: Row[];
  faq: Qa[];
  sources: Source[];
  related: { href: string; label: string }[];
};

const READ = "2026-10-03";

export const VAWE_SOURCES: Source[] = [
  { label: "vawe README", url: "https://github.com/vawe-hq/vawe#readme" },
  { label: "vawe LICENSE", url: "https://github.com/vawe-hq/vawe/blob/main/LICENSE" },
];

export const RIVALS: Rival[] = [
  {
    slug: "remotion",
    name: "Remotion",
    read: READ,
    metaTitle: "vawe vs Remotion: React code or one HTML page",
    metaDescription:
      "Remotion builds video from React components under a source-available licence. vawe renders one HTML page under Apache-2.0. A fact-checked comparison of authoring, rendering, licence and agent support.",
    h1: "vawe vs Remotion.",
    intro:
      "Remotion makes video from React components. vawe makes video from one HTML page. Both render in headless Chrome. This page compares them on authoring, rendering, licence and agent support, and says where Remotion is stronger.",
    what:
      "Remotion is a framework to make videos programmatically with React. You write components, preview them in Remotion Studio, and render with Remotion locally or on AWS Lambda or Google Cloud Run.",
    stronger: [
      "Community and history. The Remotion site lists more than 5 million monthly npm installs and 10,000 Discord members, and the GitHub repo showed about 70,000 stars on 2026-11-03.",
      "Distributed rendering. Remotion Lambda splits a render across several functions and stitches the result. vawe renders on one machine.",
      "A React model. If your team already writes React, components, props and a Player you can embed in an app come with it.",
      "Documentation volume. The site lists about 1,000 documentation pages.",
    ],
    chooseThem: [
      "Your team already writes React and wants video in the same component model.",
      "You need to render many videos in parallel on AWS Lambda or Cloud Run.",
      "You want an embeddable Player, or a drag-and-drop Studio that writes back to code.",
      "You are in a group that fits the free licence, or you can buy a company licence.",
    ],
    choosevawe: [
      "You want an agent to write the film in plain HTML, CSS and Web Animations, with no framework to learn.",
      "Your company has more than 3 employees and you want a licence with no size or per-render terms.",
      "You want one page to render to the same frames every time, with the clock, timers and Math.random controlled for you.",
      `You want built-in motion blur, dither and a library of ${MOVES.length} video components with After Effects eases.`,
    ],
    rows: [
      { feature: "What it is", them: "Framework to make videos with React", vawe: "Framework to make films from one HTML page" },
      { feature: "Licence", them: "Source-available Remotion License: free for individuals, for-profit companies up to 3 employees, non-profits and evaluation; Company License above that", vawe: "Apache-2.0, no company-size clause", t: "partial", v: "yes" },
      { feature: "Authoring model", them: "React components", vawe: "One HTML page: CSS, Web Animations, SVG, canvas, three.js" },
      { feature: "Rendering", them: "Headless Chromium frames, encoded with FFmpeg; local, AWS Lambda or Cloud Run", vawe: "Headless Chrome seeks and screenshots each frame; renders on your machine" },
      { feature: "Pricing, company use", them: "$100 a month minimum for Automators ($0.01 per render) or $25 a month per seat for Creators, with 3 seats minimum", vawe: "Free" },
      { feature: "Agent support", them: "Agent Skills (npx skills add remotion-dev/skills); docs served as Markdown", vawe: "bin/vawe CLI and skills for writing, critiquing and judging a film", t: "yes", v: "yes" },
      { feature: "Editor", them: "Remotion Studio, with drag-and-drop that saves to code", vawe: "No timeline editor: the page is the film", t: "yes", v: "no" },
      { feature: "Distributed rendering", them: "Yes: Lambda and Cloud Run", vawe: "No", t: "yes", v: "no" },
    ],
    faq: [
      {
        q: "Is Remotion free?",
        a: "It is free for an individual, a for-profit organisation with up to 3 employees, a non-profit, and evaluation for possible commercial use. A larger for-profit company needs a Company License. vawe has no such threshold.",
      },
      {
        q: "Can I use Remotion with an AI agent?",
        a: "Yes. Remotion publishes Agent Skills that install with npx skills add remotion-dev/skills, and serves its docs as Markdown for agents.",
      },
      {
        q: "Do I need to know React to use vawe?",
        a: "No. A vawe film is one HTML page. You write HTML, CSS and Web Animations, or SVG, canvas or three.js, and the renderer seeks the page frame by frame.",
      },
      {
        q: "Is a vawe render the same every time?",
        a: "Yes. A virtual clock owns Date, requestAnimationFrame, timers and Math.random, and tests check that two renders give identical frames.",
      },
      {
        q: "Can vawe render on AWS Lambda?",
        a: "No. vawe renders on your own machine. If you need distributed rendering, Remotion is the stronger choice today.",
      },
    ],
    sources: [
      { label: "Remotion README", url: "https://github.com/remotion-dev/remotion" },
      { label: "Remotion LICENSE.md", url: "https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md" },
      { label: "Remotion licence pricing", url: "https://www.remotion.pro/license" },
      { label: "Remotion Lambda docs", url: "https://www.remotion.dev/docs/lambda" },
      { label: "Remotion Agent Skills docs", url: "https://www.remotion.dev/docs/ai/skills" },
      { label: "Remotion site", url: "https://www.remotion.dev/" },
    ],
    related: [
      { href: "/remotion-alternatives", label: "Remotion alternatives, categorized" },
      { href: "/vs/hyperframes", label: "vawe vs HyperFrames" },
      { href: "/compare/remotion-vs-hyperframes", label: "Remotion vs HyperFrames vs vawe" },
    ],
  },
  {
    slug: "hyperframes",
    name: "HyperFrames",
    read: READ,
    metaTitle: "vawe vs HyperFrames: two HTML-to-video engines",
    metaDescription:
      "HyperFrames and vawe both render HTML to MP4 under Apache-2.0 with an agent in mind. They differ in timing, determinism and ecosystem. A fact-checked comparison, including where HyperFrames is stronger.",
    h1: "vawe vs HyperFrames.",
    intro:
      "HyperFrames is HeyGen’s open-source framework for rendering HTML to video. It is vawe’s closest peer: Apache-2.0, headless Chrome, and a pitch aimed at agents. This page lists the differences that remain.",
    what:
      "HyperFrames turns HTML, CSS, media and seekable animations into MP4. A composition is plain HTML with data attributes for timing and tracks, animated by GSAP, CSS, Lottie, Three.js, Anime.js or the Web Animations API.",
    stronger: [
      "Ecosystem. The HyperFrames repo showed about 77,600 stars on 2026-11-03. Its README lists 8 published skills, a Studio browser editor and desktop apps, and a registry skill.",
      "Render targets. Its docs list local, AWS Lambda, Google Cloud Run and HeyGen cloud rendering. vawe renders on one machine.",
      "Named workflows. Its README lists on-demand skills such as /figma, /slideshow, /remotion-to-hyperframes and /reverse-any-video.",
      "Time in market.",
    ],
    chooseThem: [
      "You want a block catalog and a browser Studio to start from.",
      "You want cloud rendering on Lambda, Cloud Run or HeyGen.",
      "You like GSAP timelines and data-attribute timing in the HTML.",
      "You want skills for a named workflow such as a Figma import or a slideshow.",
    ],
    choosevawe: [
      "You want ordinary web code to keep working: vawe replaces Date, timers and Math.random with seek-driven versions, where HyperFrames forbids them.",
      "You want timing from CSS keyframes, element.animate() or a seek(t) function, with no timing attributes in the markup.",
      `You want built-in adaptive motion blur and a library of ${MOVES.length} video components with After Effects eases.`,
      "You want a film judged by a fresh session that did not write it.",
    ],
    rows: [
      { feature: "What it is", them: "Open-source framework: HTML to deterministic MP4", vawe: "Framework to make films from one HTML page" },
      { feature: "Licence", them: "Apache-2.0", vawe: "Apache-2.0", t: "yes", v: "yes" },
      { feature: "Authoring model", them: "HTML with data attributes for timing and tracks; GSAP, CSS, Lottie, Three.js, Anime.js, WAAPI", vawe: "One HTML page timed by CSS keyframes, element.animate() or window.seek(t)" },
      { feature: "Rendering", them: "Headless Chrome seeks each frame, FFmpeg encodes; local, Lambda, Cloud Run, HeyGen cloud", vawe: "Headless Chrome seeks and screenshots each frame; renders on your machine" },
      { feature: "Determinism", them: "Forbids Date.now, requestAnimationFrame, system timers and unseeded Math.random in a composition", vawe: "A virtual clock replaces those calls with functions of the seek time", t: "partial", v: "yes" },
      { feature: "Agent support", them: "8 published skills, with /hyperframes as the entry point (README, read 2026-11-03)", vawe: "bin/vawe CLI and skills; a separate session critiques and judges the film", t: "yes", v: "yes" },
      { feature: "Editor", them: "Studio browser editor and a block catalog", vawe: "No timeline editor: the page is the film", t: "yes", v: "no" },
      { feature: "Distributed rendering", them: "Yes: Lambda, Cloud Run, HeyGen cloud", vawe: "No", t: "yes", v: "no" },
    ],
    faq: [
      {
        q: "Are HyperFrames and vawe both open source?",
        a: "Yes. Both are Apache-2.0. Neither has a company-size clause in the licence.",
      },
      {
        q: "How do they keep renders deterministic?",
        a: "HyperFrames states a rule: no Date.now, requestAnimationFrame or system timers, and no Math.random without a seed. vawe lets a page call them, and replaces them with functions of the seek time before any page script runs.",
      },
      {
        q: "Which one has more templates and blocks?",
        a: `HyperFrames. It ships a block catalog and a template gallery. vawe ships ${MOVES.length} video components and film templates in its prompts folder.`,
      },
      {
        q: "Does vawe have cloud rendering?",
        a: "No. vawe renders on your machine. HyperFrames lists local, AWS Lambda, Google Cloud Run and HeyGen cloud rendering. Its hosted price is not public, so this page gives none.",
      },
    ],
    sources: [
      { label: "HyperFrames README", url: "https://github.com/heygen-com/hyperframes" },
      { label: "HyperFrames README (raw)", url: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/README.md" },
      { label: "HyperFrames introduction", url: "https://hyperframes.heygen.com/introduction" },
      { label: "HyperFrames determinism", url: "https://hyperframes.heygen.com/concepts/determinism" },
      { label: "HyperFrames vs Remotion guide", url: "https://hyperframes.heygen.com/guides/hyperframes-vs-remotion.md" },
    ],
    related: [
      { href: "/hyperframes-alternatives", label: "HyperFrames alternatives" },
      { href: "/vs/remotion", label: "vawe vs Remotion" },
      { href: "/compare/remotion-vs-hyperframes", label: "Remotion vs HyperFrames vs vawe" },
      { href: "/determinism", label: "How vawe keeps renders deterministic" },
    ],
  },
  {
    slug: "motion-canvas",
    name: "Motion Canvas",
    read: READ,
    metaTitle: "vawe vs Motion Canvas: generator functions or HTML",
    metaDescription:
      "Motion Canvas animates vector scenes with TypeScript generator functions and an editor. vawe renders one HTML page. A fact-checked comparison of authoring, rendering, licence and agent support.",
    h1: "vawe vs Motion Canvas.",
    intro:
      "Motion Canvas is a TypeScript library for vector animation, with a real-time editor. vawe renders one HTML page to a film. They suit different work, and this page says which.",
    what:
      "Motion Canvas is a TypeScript library that uses generator functions to program animations, plus an editor with a real-time preview. It targets informative vector animation synced to a voice-over.",
    stronger: [
      "A purpose-built editor. It gives a real-time preview and audio sync for scenes you write in code.",
      "A flow model for diagrams. Generators describe what happens step by step, with duration and speed instead of hard-coded keyframes.",
      "Licence and age. It is MIT-licensed and has about 19,700 GitHub stars on 2026-11-03.",
    ],
    chooseThem: [
      "You make explainer or diagram animation synced to a voice-over.",
      "You like writing animation as TypeScript generators with a live preview.",
      "You want an MIT licence.",
      "Your scenes are vector shapes and text, not web pages or video clips.",
    ],
    choosevawe: [
      "You want to use the whole web platform: HTML, CSS, SVG, canvas and three.js, not one scene API.",
      "You want an AI agent to write the film in code it already knows.",
      "You want one command that renders the final MP4 with motion blur and an audio mix.",
      "You want to place video clips and CSS layouts in the film.",
    ],
    rows: [
      { feature: "What it is", them: "TypeScript library and editor for vector animation", vawe: "Framework to make films from one HTML page" },
      { feature: "Licence", them: "MIT", vawe: "Apache-2.0", t: "yes", v: "yes" },
      { feature: "Authoring model", them: "TypeScript generator functions that describe the animation step by step", vawe: "One HTML page: CSS, Web Animations, SVG, canvas, three.js" },
      { feature: "Rendering", them: "Editor renders an image sequence to /output; an FFmpeg exporter makes a video", vawe: "Headless Chrome seeks and screenshots each frame; encodes one MP4 with the page’s audio" },
      { feature: "Agent support", them: "None found in its official docs or site", vawe: "bin/vawe CLI and skills for writing, critiquing and judging a film", t: "no", v: "yes" },
      { feature: "Editor", them: "Web editor with real-time preview and audio sync", vawe: "No timeline editor: the page is the film", t: "yes", v: "no" },
    ],
    faq: [
      {
        q: "What is a generator function in Motion Canvas?",
        a: "It is a TypeScript function that yields as time passes. You write what should happen step by step, and the library plays it. The Motion Canvas docs describe the focus as duration, speed and acceleration instead of hard-coded keyframes.",
      },
      {
        q: "How does Motion Canvas make a video file?",
        a: "The editor can save each frame as an image to an output folder. A separate FFmpeg exporter can make a finished video. Its docs mark the exporter as a relatively new feature.",
      },
      {
        q: "Can an AI agent use Motion Canvas?",
        a: "You can ask an agent to write the TypeScript. This page found no agent skills or agent docs on the official Motion Canvas site.",
      },
      {
        q: "Is Motion Canvas open source?",
        a: "Yes, under the MIT licence. vawe is Apache-2.0.",
      },
    ],
    sources: [
      { label: "Motion Canvas README", url: "https://github.com/motion-canvas/motion-canvas" },
      { label: "Motion Canvas site", url: "https://motioncanvas.io/" },
      { label: "Motion Canvas rendering docs", url: "https://motioncanvas.io/docs/rendering" },
      { label: "Motion Canvas video exporter", url: "https://motioncanvas.io/docs/rendering/video" },
      { label: "Motion Canvas releases", url: "https://github.com/motion-canvas/motion-canvas/releases" },
    ],
    related: [
      { href: "/vs/remotion", label: "vawe vs Remotion" },
      { href: "/vs/lottie", label: "vawe vs Lottie" },
    ],
  },
  {
    slug: "lottie",
    name: "Lottie",
    read: READ,
    metaTitle: "vawe vs Lottie: a playback format or a film renderer",
    metaDescription:
      "Lottie is a JSON format for vector animation, exported from After Effects and played in apps. vawe renders one HTML page to MP4. A fact-checked comparison of authoring, rendering and licence.",
    h1: "vawe vs Lottie.",
    intro:
      "Lottie is a file format for vector animation that apps play at run time. vawe renders a film to MP4. They overlap only when you want a Lottie animation as video. This page explains the line between them.",
    what:
      "Lottie is an open-source vector animation file format, first made in 2015 as an export format for Adobe After Effects. A player draws the JSON in an app or on the web. It is not a video renderer.",
    stronger: [
      "Playback in products. One Lottie file plays on the web, iOS, Android and embedded devices, and can react to clicks and hover.",
      "File size. The dotLottie container compresses animations and shares assets.",
      "A standard. The format has a spec, a validator and a list of implementations, and a non-profit community hosted by the Linux Foundation.",
      "Reach. The lottie-web repo shows about 32,300 stars on 2026-11-03.",
    ],
    chooseThem: [
      "You ship an animated icon, loader or illustration inside an app or web page.",
      "A motion designer works in After Effects and exports with Bodymovin.",
      "You need the animation to stay small and interactive at run time.",
      "You do not need video, audio or arbitrary HTML in the animation.",
    ],
    choosevawe: [
      "You want an MP4 film, with audio, from a page you can write in code.",
      "You need HTML layout, text, video clips, canvas or three.js in the same film.",
      "You want an agent to write the file in web code it already knows.",
      "You want motion blur and the same frames on every render.",
    ],
    rows: [
      { feature: "What it is", them: "Open vector animation file format with players", vawe: "Framework to make films from one HTML page" },
      { feature: "Licence", them: "lottie-web and dotlottie-web: MIT; the spec: Community Specification License 1.0", vawe: "Apache-2.0", t: "yes", v: "yes" },
      { feature: "Authoring model", them: "JSON exported from After Effects with Bodymovin, or made in LottieFiles Creator", vawe: "One HTML page: CSS, Web Animations, SVG, canvas, three.js" },
      { feature: "Rendering", them: "A runtime player draws it (lottie-web: SVG, Canvas, HTML); not an MP4 renderer", vawe: "Headless Chrome seeks and screenshots each frame; encodes one MP4", t: "no", v: "yes" },
      { feature: "Agent support", them: "LottieFiles offers a Creator MCP server and a hosted MCP server", vawe: "bin/vawe CLI and skills for writing, critiquing and judging a film", t: "yes", v: "yes" },
      { feature: "Content it can hold", them: "Vector shapes and animation", vawe: "Anything a browser draws, plus audio" },
    ],
    faq: [
      {
        q: "Can Lottie export to MP4?",
        a: "The Lottie players do not make MP4. LottieFiles lists MP4, WebM and GIF among the export formats of its own tools. vawe renders MP4 from an HTML page directly.",
      },
      {
        q: "Is Lottie the same as After Effects?",
        a: "No. Lottie is a file format. It was first made as an export format for After Effects, and Bodymovin is the plugin that exports it.",
      },
      {
        q: "Can I use a Lottie animation inside a vawe film?",
        a: "vawe pages can use any web library, but this page has not tested a Lottie player with the seek clock, so it makes no claim.",
      },
      {
        q: "Is Lottie free?",
        a: "The formats and players are MIT-licensed. LottieFiles plan prices are not stated here because the pricing page did not load when this page was written.",
      },
    ],
    sources: [
      { label: "Lottie community site", url: "https://lottie.github.io/" },
      { label: "lottie-web", url: "https://github.com/airbnb/lottie-web" },
      { label: "Lottie spec", url: "https://lottie.github.io/lottie-spec/latest/" },
      { label: "dotLottie", url: "https://dotlottie.io/" },
      { label: "dotlottie-web", url: "https://github.com/LottieFiles/dotlottie-web" },
      { label: "LottieFiles Creator MCP", url: "https://docs.lottiefiles.com/en/creator/13_ai-tools/lottie-creator-mcp" },
      { label: "LottieFiles MCP", url: "https://docs.lottiefiles.com/en/platform/mcp" },
      { label: "LottieFiles export help", url: "https://help.lottiefiles.com/hc/en-us/articles/29062996652057-troubleshooting-exporting-lottie-animations-as-gif-or-mp4-files" },
    ],
    related: [
      { href: "/vs/motion-canvas", label: "vawe vs Motion Canvas" },
      { href: "/vs/remotion", label: "vawe vs Remotion" },
    ],
  },
  {
    slug: "revideo",
    name: "Revideo",
    read: "2026-11-03",
    metaTitle: "vawe vs Revideo: TypeScript scenes or one HTML page",
    metaDescription:
      "Revideo renders videos from TypeScript scenes under the MIT licence. vawe renders one HTML page under Apache-2.0. A sourced comparison of authoring, rendering, preview, licence and project status.",
    h1: "vawe vs Revideo.",
    intro:
      "Revideo is an MIT-licensed rendering engine that makes video from TypeScript scenes. vawe makes video from one HTML page. This page compares them on authoring, rendering, preview, agent support and project status, and says where Revideo is stronger.",
    what:
      "Revideo describes itself as a rendering engine for creating videos in code. You write a scene as a TypeScript generator function, render it with renderVideo() or a render endpoint, and preview it with a React Player. Its README calls it the engine behind Midrender.",
    stronger: [
      "A TypeScript scene model. Scenes are generator functions, so duration and order come from yield* calls and not from keyframes.",
      "Parallel rendering. The README says renders can be split across workers and run on serverless platforms such as Google Cloud Run. vawe renders on one machine.",
      "An embeddable Player. A React Player previews the same project that renders the final video and accepts dynamic inputs.",
      "A headless render API with a render endpoint you can expose from its CLI.",
    ],
    chooseThem: [
      "Your team writes TypeScript and wants animation as generator functions.",
      "You need to split renders across workers or run them on Cloud Run.",
      "You want a React Player in your own app.",
      "You want an MIT licence.",
    ],
    choosevawe: [
      "You want an agent to write the film in plain HTML, CSS and Web Animations, with no scene API to learn.",
      "You want one page to give the same frames every time, with the clock, timers and Math.random controlled for you.",
      `You want built-in motion blur and a library of ${MOVES.length} video components with After Effects eases.`,
      "You want a critique of the film by a session that did not write it.",
    ],
    rows: [
      { feature: "What it is", them: "Rendering engine to create videos in code", vawe: "Framework to make films from one HTML page" },
      { feature: "Licence", them: "MIT", vawe: "Apache-2.0", t: "yes", v: "yes" },
      { feature: "Authoring model", them: "TypeScript generator functions (makeScene2D) that add components and animate them with yield*", vawe: "One HTML page: CSS, Web Animations, SVG, canvas, three.js" },
      { feature: "Rendering", them: "renderVideo() or a render endpoint from the CLI; runs where Node and a headless browser run", vawe: "Headless Chrome seeks and screenshots each frame; renders on your machine" },
      { feature: "Distributed rendering", them: "Yes: split across workers; Google Cloud Run named as a target", vawe: "No", t: "yes", v: "no" },
      { feature: "Preview", them: "A React Player that previews the project in the browser", vawe: "bin/vawe studio: a scrubbable preview that edits the page’s literals", t: "yes", v: "partial" },
      { feature: "Agent support", them: "Its GitHub page says Claude or Codex can generate a scene from a prompt; no skills named on the pages read", vawe: "bin/vawe CLI and skills for writing, critiquing and judging a film", t: "partial", v: "yes" },
      { feature: "Project status", them: "Not archived. Latest tag v0.11.0; last commit on main 2026-07-15. docs.re.video redirects to midrender.com/revideo/docs", vawe: "Source install from GitHub" },
    ],
    faq: [
      {
        q: "Is Revideo open source?",
        a: "Yes, under the MIT licence. vawe is Apache-2.0.",
      },
      {
        q: "Is Revideo still maintained?",
        a: "On 2026-11-03 the GitHub repository was not archived. The last commit on main was dated 2026-07-15, and the latest tag was v0.11.0. The old docs address, docs.re.video, now redirects to midrender.com/revideo/docs. Check the repository for recent activity before you depend on it.",
      },
      {
        q: "What is the relation between Revideo and Midrender?",
        a: "The Revideo README says Revideo is the engine behind Midrender. The Revideo docs now sit on the Midrender site. This page found no pricing for Midrender and gives none.",
      },
      {
        q: "Can an AI agent use Revideo?",
        a: "The Revideo GitHub page says Claude or Codex can generate a scene from a prompt. This page found no agent skills named in the Revideo docs or README.",
      },
      {
        q: "Does vawe need TypeScript?",
        a: "No. A vawe film is one HTML page. You write HTML, CSS and Web Animations, or SVG, canvas or three.js.",
      },
    ],
    sources: [
      { label: "Revideo README", url: "https://github.com/redotvideo/revideo" },
      { label: "Revideo README (raw)", url: "https://raw.githubusercontent.com/redotvideo/revideo/main/README.md" },
      { label: "Revideo docs (redirect from docs.re.video)", url: "https://midrender.com/revideo/docs" },
      { label: "Revideo releases and tags", url: "https://github.com/redotvideo/revideo/tags" },
    ],
    related: [
      { href: "/compare/remotion-vs-hyperframes", label: "Remotion vs HyperFrames vs vawe" },
      { href: "/vs/motion-canvas", label: "vawe vs Motion Canvas" },
      { href: "/vs/remotion", label: "vawe vs Remotion" },
    ],
  },
];

export const RIVAL_BY_SLUG = Object.fromEntries(RIVALS.map((r) => [r.slug, r]));

export const MARK_LABEL: Record<Mark, string> = { yes: "Yes", no: "No", partial: "Partly" };

export function vsPage(r: Rival) {
  return {
    path: `/vs/${r.slug}`,
    parent: { href: "/remotion-alternatives", label: "Compare" } as Link,
    current: `vawe vs ${r.name}`,
    note: `Facts read from ${r.name}’s own pages on ${r.read}. Sources are listed at the end. vawe runs on your machine, needs no account and has no per-render fee.`,
    toc: [
      { href: "#choose", label: "Which to choose" },
      { href: "#table", label: "Side by side" },
      { href: "#stronger", label: `Where ${r.name} is stronger` },
      { href: "#faq", label: "Questions" },
    ] as Link[],
    chooseLabel: "Which one to choose",
    chooseThem: `Choose ${r.name} when`,
    choosevawe: "Choose vawe when",
    what: `What ${r.name} is.`,
    table: { title: "Side by side.", feature: "feature" },
    stronger: `Where ${r.name} is stronger.`,
    faqTitle: "Questions.",
    next: {
      title: "Try vawe on one page.",
      lead: ["Write a page, run one command, get an MP4."],
      primary: { href: "/docs/html-to-mp4-with-claude-code", label: "HTML to MP4 with Claude Code" },
      secondary: { href: REPO_URL, label: "Star vawe on GitHub" },
      related: [
        ...r.related,
        { href: "/video-components", label: "See the video components" },
        { href: "/problems", label: "Hard problems and where vawe stands" },
      ],
    } as NextBlock,
  };
}
