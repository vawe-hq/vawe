import type { Crumb, Link, Meta, NextBlock, Section } from "./types";

export const DETERMINISM = {
  path: "/determinism",
  meta: {
    title: "Deterministic video rendering from HTML | vawe",
    description:
      "A Vawe film is a page seeked to each frame’s time, never played: the same page produces the same frames on every render, in any order. How Vawe makes that true, how it checks it, and why that lets a render split into parallel slices.",
  } as Meta,
  crumb: { group: "Learn", current: "Determinism" } as Crumb,
  h1: "Same page in. Same frames out.",
  lede: "A Vawe film is an HTML page that the renderer seeks to each frame’s time. Ask for the frame at 4.2 seconds twice, in any order, and it comes back the same. The clock is replaced before the page runs, and a test renders pages twice and compares every frame.",
  toc: [
    { href: "#clock", label: "The fake clock" },
    { href: "#test", label: "The test" },
    { href: "#slices", label: "Parallel slices" },
    { href: "#rates", label: "60 and 30 fps" },
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
  ] as Section[],
  next: {
    title: "When this decides the engine",
    lead: ["Byte-identical output matters most where nobody looks at every frame."],
    primary: { href: "/when-determinism-matters", label: "When determinism matters" },
    related: [
      { href: "/ai-agents", label: "How an agent writes the page" },
      { href: "/features", label: "What else the engine decides" },
      { href: "/blog/seekable-css", label: "Seek CSS animations frame by frame" },
      { href: "/blog/page-clock", label: "Seed Math.random and freeze Date.now" },
    ],
  } as NextBlock,
};
