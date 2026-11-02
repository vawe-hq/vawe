import type { Crumb, Link, Meta, NextBlock, Section } from "./types";

export const WHEN_DETERMINISM = {
  path: "/when-determinism-matters",
  meta: {
    title: "Deterministic video rendering: when it matters",
    description:
      "Use cases for deterministic video rendering: agent drafts that match the final, ad variants, parallel renders and regression diffs, and when a human editing a timeline makes it beside the point.",
  } as Meta,
  crumb: { group: "Compare", current: "When determinism matters" } as Crumb,
  h1: "When deterministic video rendering matters.",
  lede: "Byte-identical rendering is a real, checkable property. It is also not the reason to pick a rendering engine most of the time. Here is what changes when it is, and what stays the same when it is not.",
  toc: [
    { href: "#nobody", label: "Nobody looks" },
    { href: "#regression", label: "Regressions" },
    { href: "#human", label: "A human is last" },
    { href: "#built-in", label: "Built in" },
  ] as Link[],
  sections: [
    {
      id: "nobody",
      title: "It matters when nobody looks at every frame.",
      blocks: [
        { p: ["Three cases. In all three, nobody is scrubbing a timeline to catch a difference by eye, so the guarantee has to be structural."] },
        {
          ol: [
            [{ strong: "An agent approves a draft." }, " It expects the final render to show the same moments, not a re-render that might drift."],
            [{ strong: "A thousand personalized ad variants." }, " One template needs the shared background to be identical across all of them, or the “shared” part is a lie."],
            [{ strong: "A render split across parallel machines." }, " It only produces one correct video if frame 4000 rendered on machine B matches frame 4000 rendered on machine A."],
          ],
        },
      ],
    },
    {
      id: "regression",
      title: "It matters for catching a regression.",
      blocks: [
        {
          p: [
            "A render pipeline that changes over time (a new effect, a font update, a library bump) can diff two renders of the same input and treat any pixel difference as a bug report. That only works if “the same input” is actually guaranteed to produce the same bytes absent a real change: without it, every diff is noise, and the team stops trusting the check within a month. This is the same reason software tests are deterministic before they are useful; video is not exempt from it just because it looks like an art form.",
          ],
        },
      ],
    },
    {
      id: "human",
      title: "It matters less when a human is the last step.",
      blocks: [
        {
          p: [
            "A single creative edit that a person opens, watches, and approves by eye gets nothing from byte-identical replay: the human is already the check. Live compositing and broadcast have no “render it again” step to be identical to. And a generative pixel model producing variation on purpose is solving a different problem than reproduction: asking it to be deterministic would remove the reason to use it. None of this is a weakness in those tools, it is a different job.",
          ],
        },
      ],
    },
    {
      id: "built-in",
      title: "It has to be built into the renderer.",
      blocks: [
        {
          p: [
            "Determinism is not a side effect of using a headless browser; a real clock, an unseeded random call, or a mid-render network fetch breaks it immediately, which is why an engine that wants the guarantee documents the specific rules it enforces rather than asserting the outcome. HyperFrames publishes its own rule set for exactly this reason (integer-math frame time, no system timers, no unseeded randomness, no mid-render fetches), which is the same shape of commitment Vawe makes for its own engine, independently arrived at because the failure modes are the same failure modes for anyone rendering frames outside real time.",
          ],
        },
      ],
      cite: "hyperframes.heygen.com/concepts/determinism · read 2026-09-19",
    },
  ] as Section[],
  next: {
    title: "How Vawe enforces it.",
    lead: ["A virtual clock the page runs under, and a test that renders every fixture twice and compares the frames."],
    primary: { href: "/determinism", label: "Read the mechanism" },
    related: [
      { href: "/remotion-alternatives", label: "Remotion alternatives, categorized" },
      { href: "/hyperframes-alternatives", label: "Vawe vs HyperFrames, the closer comparison" },
      { href: "/ai-agents", label: "How an agent writes and checks a film" },
    ],
  } as NextBlock,
};
