import type { Crumb, Link, Meta, NextBlock, Section } from "./types";

export const DETERMINISM = {
  path: "/determinism",
  meta: {
    title: "Deterministic video rendering from HTML: how and when it matters",
    description:
      "The same HTML page renders the same frames every time, in any order. How vawe does it, the test that checks it, and when determinism matters for video.",
  } as Meta,
  crumb: { group: "Learn", current: "Determinism" } as Crumb,
  h1: "Same page in. Same frames out.",
  lede: "A vawe film is an HTML page that the renderer seeks to each frame’s time. Ask for the frame at 4.2 seconds twice, in any order, and it comes back the same. The clock is replaced before the page runs, and a test renders pages twice and compares every frame.",
  toc: [
    { href: "#clock", label: "The fake clock" },
    { href: "#test", label: "The test" },
    { href: "#slices", label: "Parallel slices" },
    { href: "#rates", label: "60 and 30 fps" },
    { href: "#when-it-matters", label: "When it matters" },
  ] as Link[],
  sections: [
    {
      id: "clock",
      title: "The clock is virtual.",
      blocks: [
        {
          p: [
            "Before any script on the page runs, a virtual clock replaces every source of ambient state. ",
            { code: "Date" },
            " and ",
            { code: "performance.now" },
            " return film time, not the wall clock; ",
            { code: "requestAnimationFrame" },
            " callbacks flush once per seek, and timers fire when the seek passes their due time. ",
            { code: "Math.random" },
            " is reseeded from the seek time, so a scatter that looks random is the same scatter on every render.",
          ],
        },
        {
          p: [
            "The page itself is seeked, never played: the renderer sets the clock, calls ",
            { code: "window.seek(t)" },
            " when the page defines one, then seeks every CSS and Web Animation to t before the screenshot. Ordinary code that reads the time keeps working, and still paints a pure function of t.",
          ],
        },
      ],
      cite: "core/engine/page-clock.js · harness/media/render-page.mjs",
      code: {
        label: "page-clock.js",
        text: `Date, performance.now   film time in ms
requestAnimationFrame   flushed once per seek
setTimeout/setInterval  fire when t passes them
Math.random             reseeded from t`,
      },
    },
    {
      id: "test",
      title: "A test proves it.",
      blocks: [
        {
          p: [
            { code: "tests/media/render-page-determinism.test.mjs" },
            " renders two fixture pages twice each and compares the decoded frame hashes. One page paints from ",
            { code: "window.seek(t)" },
            " on a canvas; the other reads ",
            { code: "Date.now" },
            ", ",
            { code: "performance.now" },
            " and ",
            { code: "Math.random" },
            " directly. Both renders must match frame for frame, and the frames must differ over time, so a page that froze would fail too. ",
            { code: "bin/vawe-dev e2e" },
            " runs it.",
          ],
        },
      ],
      cite: "tests/media/render-page-determinism.test.mjs · harness/dev/e2e.mjs",
      code: {
        label: "the test",
        text: `render page -> frame hashes A
render page -> frame hashes B
assert A === B
assert frames differ over t`,
      },
    },
    {
      id: "slices",
      title: "Parallel slices, the same pixels.",
      blocks: [
        {
          p: [
            "Because the frame at t depends on nothing before it, the renderer splits a film into fixed 60-frame slices and captures several at once, each on its own fresh page of one shared browser. The slice size is a constant, never the worker count: a page keeps raster state between seeks, so a frame reached by seeking can differ in the last decimal place from the same frame on a fresh page. Fixing the boundaries makes the pixels identical for any number of workers.",
          ],
        },
      ],
      cite: "harness/media/render-page.mjs, SLICE_FRAMES",
    },
    {
      id: "rates",
      title: "60fps final, 30fps for a fast look.",
      blocks: [
        {
          p: [
            "One page becomes one mp4: ",
            { code: "bin/vawe ship" },
            " renders 60fps at full size with motion blur and audio, and ",
            { code: "bin/vawe dev" },
            " renders a half-size, 30fps draft for a quick check. Frames are seeked at fractional times, so the render rate is independent of the page. Determinism is not a mode you opt into: every render goes through the same virtual clock.",
          ],
        },
      ],
      cite: "harness/cli/verbs.mjs · harness/media/render-page.mjs",
    },
    {
      id: "when-it-matters",
      title: "When it matters, and when it does not.",
      blocks: [
        { p: ["Determinism matters when nobody looks at every frame. Then the guarantee has to come from the renderer."] },
        {
          ol: [
            [{ strong: "An agent approves a draft." }, " The final render must show the same moments as the draft it approved."],
            [{ strong: "One template makes many ad variants." }, " The shared background must be the same in every variant."],
            [{ strong: "A render is split across machines or workers." }, " Frame 4000 from one worker must match frame 4000 from another."],
            [{ strong: "A pipeline checks for regressions." }, " Two renders of the same input are diffed, and any pixel change is a bug. Without determinism every diff is noise, and people stop trusting the check."],
          ],
        },
        {
          p: [
            "It matters less when a person is the last step. A person who watches and approves one edit is already the check. Live compositing has no second render to match. A generative model that makes variation on purpose solves a different problem.",
          ],
        },
        {
          p: [
            "A headless browser does not give determinism for free. A real clock, an unseeded random call or a fetch in the middle of a render breaks it. So an engine that promises it must state its rules. HyperFrames publishes its own rules: integer frame time, no system timers, no unseeded random and no fetch during a render. vawe makes the same promise with a virtual clock instead of a ban.",
          ],
        },
      ],
      cite: "hyperframes.heygen.com/concepts/determinism · read 2026-09-19",
    },
  ] as Section[],
  next: {
    title: "The causes of drift, measured.",
    lead: ["Two renders of one page once gave 70 of 216 different frames. The post lists each cause and its fix."],
    primary: { href: "/blog/determinism", label: "Headless Chrome screenshots differ: the fixes" },
    related: [
      { href: "/ai-agents", label: "How an agent writes the page" },
      { href: "/features", label: "What else the engine decides" },
      { href: "/blog/seekable-css", label: "Seek CSS animations frame by frame" },
      { href: "/remotion-alternatives", label: "Remotion alternatives, categorized" },
      { href: "/hyperframes-alternatives#vs-hyperframes", label: "vawe vs HyperFrames" },
    ],
  } as NextBlock,
};
