import type { Para } from "./types";

export type QA = { q: string; a: Para };

// Every number here is measured in the linked blog post; change both together.
export const ALT_EVIDENCE = {
  title: "What vawe measured about itself.",
  lead: "These numbers come from our own engineering posts, each with the commits behind it. They describe vawe only; none of them compares speed or quality with another tool.",
  items: [
    {
      fact: "One blind A/B run on the same brief: a fresh agent finished the film in 5.9 minutes with one HTML page and in 10.75 minutes with our old custom JSON format.",
      href: "/blog/html-over-json",
      label: "HTML vs a custom JSON video format",
    },
    {
      fact: "Two renders of one SVG-filter page differed in 70 of 216 frames in a shared browser, and in 0 of 648 after a Chrome per lane and software compositing.",
      href: "/blog/determinism",
      label: "Deterministic rendering in headless Chrome",
    },
    {
      fact: "One headless Chrome per render lane cut frame capture for a 20 s film from 140 s to 47 s.",
      href: "/blog/fast-drafts",
      label: "Faster headless Chrome rendering",
    },
    {
      fact: "The whole film format: one page.html, a duration meta and one data-world element per beat.",
      href: "/blog/render-html-to-mp4#the-page-format-vawe-reads",
      label: "Render HTML to video: the page contract",
    },
  ],
  faqTitle: "Questions people ask before they switch.",
};
