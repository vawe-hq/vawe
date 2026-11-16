// Copy-paste prompts for the pages that list steps. A person pastes one into Claude Code, Codex or Cursor,
// and the agent does the steps. Each prompt carries the setup, because the reader may have no vawe checkout.

const SETUP = [
  "If vawe is not installed here, install it first:",
  "git clone https://github.com/vawe-hq/vawe.git && cd vawe && npm install && npx puppeteer browsers install chrome",
  "(it needs Node 22 or newer and ffmpeg; bin/vawe-dev doctor prints the install line for anything missing).",
  "Then read AGENTS.md and follow its steps and each command’s next: line.",
].join("\n");

const DRAFT = "Show me the draft video and wait for my OK before the final render.";

const FOOTAGE = (task: string, detail: string) =>
  [`Use vawe (https://github.com/vawe-hq/vawe), the open-source video-from-code tool, to ${task}`, `My clip: <path to your clip or folder>.`, detail, SETUP, `Start with bin/vawe new <name> --footage <my clip>, which logs the clip with a transcript.`, DRAFT].join("\n\n");

const FILM = (task: string, detail: string) =>
  [`Use vawe (https://github.com/vawe-hq/vawe), the open-source HTML-to-video tool, to ${task}`, detail, SETUP, `Start with bin/vawe new <name> --request "<my ask in one line>".`, DRAFT].join("\n\n");

export const PAGE_PROMPTS: Record<string, string> = {
  "/how-to/add-captions-to-video": FOOTAGE(
    "add word-by-word captions to my video.",
    "Time every word from the transcript, show the line being spoken, and light each word on its own second. Keep the captions inside the safe area and easy to read on a phone.",
  ),
  "/how-to/remove-silences-from-video": FOOTAGE(
    "remove the silences and dead pauses from my video.",
    "Find the gaps in speech from the transcript, keep each spoken span as one cut, and leave a short breath at each cut so it does not sound clipped. List the cuts you made with their times.",
  ),
  "/how-to/add-text-to-video": FOOTAGE(
    "add a title card and on-screen text to my video.",
    "Open with a short title card, then play the clip. Add a lower third with my name and role when I first speak. My title text: <your title>.",
  ),
  "/how-to/trim-and-join-video-clips": FOOTAGE(
    "trim my clips and join them into one video.",
    "Keep only these parts: <clip, start and end second for each>. Join them in this order with a clean cut, and match the loudness of every clip.",
  ),
  "/how-to/add-music-to-video": FOOTAGE(
    "add my music track under my video.",
    "My track: <path to your music file>. Keep it under the voice, lower it while I speak, and fade it in at the start and out at the end.",
  ),
  "/how-to/speed-up-or-slow-down-video": FOOTAGE(
    "speed up the slow parts of my video and slow down the key moment.",
    "Play the waits (loading, typing) at 4 times speed, and the moment at <second> at half speed. Keep the voice at normal speed.",
  ),
  "/how-to": FOOTAGE("edit my video.", "What I want: <captions, cut silences, a title, trims, music or speed changes>."),
  "/screen-recording-to-demo-video": FOOTAGE(
    "turn my screen recording into a short product demo video.",
    "Cut the dead time, speed up the waits, add a title card and captions, and zoom in on the part of the screen that matters in each step.",
  ),
  "/edit-video-with-claude-code": FOOTAGE("edit my video.", "What I want from the edit: <one or two lines>. Ask me the questions you need before you cut."),
  "/agentic-video-editing": FOOTAGE("edit my video.", "What I want from the edit: <one or two lines>. Read the footage log before you plan the cuts, and tell me what you cannot see in it."),
  "/programmatic-video-editing": FOOTAGE("edit my video with code, so the edit is a file I can change and render again.", "What I want from the edit: <one or two lines>."),
  "/launch-video": FILM(
    "make a launch video for my product.",
    "My product's site: <URL>. Capture the real UI from the site, use its palette and type, show the product working, and end on the name and one line. Length: about 20 seconds.",
  ),
  "/product-showcase-video": FILM(
    "make a product showcase video.",
    "My product's site: <URL>. Show the real product doing three real things, one per beat, and end on the name. Length: about 30 seconds.",
  ),
  "/explainer-video": FILM(
    "make an explainer video.",
    "Topic: <what to explain>. One idea per beat, visuals that build on screen, plain words, and no sales pitch. Length: about 45 seconds.",
  ),
  "/ai-agents": FILM("make a short motion graphics video.", "What it is about: <topic, product or message>. Length: <seconds>."),
};

export const BLOG_PROMPTS: Record<string, string> = {
  "render-html-to-mp4": FILM("render my HTML page to an MP4.", "My page: <path to your HTML page>. Keep its animations and render it at 1920x1080."),
  "css-animation-to-video": FILM("turn my CSS animation into an MP4.", "My page: <path to your HTML page>. Keep the CSS keyframes as they are."),
  "gsap-to-mp4": FILM("export my GSAP timeline as an MP4.", "My page: <path to your HTML page>. Drive the timeline from the seek time, not the real clock."),
  "canvas-to-video": FILM("render my canvas animation to an MP4.", "My page: <path to your HTML page>. Draw each frame from the seek time, and seed any random numbers."),
  "threejs-to-mp4": FILM("render my three.js scene to an MP4.", "My page: <path to your HTML page>. Render each frame from window.seek(t), not from a real clock."),
  "svg-animation-to-mp4": FILM("render my SVG animation to an MP4.", "My file: <path to your SVG or HTML page>."),
  "batch-render-videos": FILM("render one video per row of my data.", "My data: <path to your JSON or CSV>. One HTML template, one MP4 per row."),
  "animated-captions-html": FOOTAGE("add animated captions to my video.", "Time every word from the transcript and light each word as it is spoken."),
  "cut-silences-with-an-agent": FOOTAGE("cut the silences out of my video.", "Keep each spoken span, leave a short breath at each cut, and list the cuts."),
  "kinetic-typography-css": FILM("make a kinetic typography video.", "The words: <your text>. Each line enters on the beat it is read."),
  "animated-chart-video": FILM("make an animated chart video.", "My data: <path or numbers>. Build the chart on screen and land on the one number that matters."),
};
