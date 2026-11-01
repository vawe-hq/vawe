import type { Para } from "./types";

export type Fact = { id: string; lead: string; q: string; a: Para; faqOpen?: string };

// The one source of the product facts. The about page lists them under "Quick facts" and the home FAQ
// answers them (and its FAQPage JSON-LD), so the two cannot differ.
export const FACTS: Fact[] = [
  {
    id: "free",
    lead: "Free.",
    faqOpen: "Yes. ",
    q: "Is vawe free?",
    a: ["vawe is free and open source under Apache-2.0, for any purpose including commercial use. There is no paid tier."],
  },
  {
    id: "install",
    lead: "Install.",
    q: "How do I install vawe?",
    a: [
      "From source: ",
      { code: "git clone https://github.com/vawe-hq/vawe.git && cd vawe && npm install && bin/vawe doctor" },
      ". There is no npm package. The doctor command checks each tool and prints the install line for any that is missing. See ",
      { text: "the quickstart", href: "/docs/quickstart" },
      ".",
    ],
  },
  {
    id: "account",
    lead: "No account.",
    q: "Does vawe need an account or a hosted API?",
    a: ["vawe needs no account and no hosted API, and has no per-render fee. It runs on your machine."],
  },
  {
    id: "needs",
    lead: "Needs.",
    q: "What does vawe need on my machine?",
    a: ["Node 22 or newer, git, and ffmpeg with libx264 and drawtext. The renderer drives Chrome, and a command that needs it prints the install line if Chrome is missing. tesseract is optional, for OCR."],
  },
  {
    id: "output",
    lead: "Output.",
    q: "What does vawe output?",
    a: ["An H.264 mp4, in 16:9, 9:16, 1:1, 4:5 and 4:3 from the same page, with audio mixed offline. A final render is 60\u00a0fps. A draft is half size at 30\u00a0fps, with the same audio mix."],
  },
  {
    id: "limits",
    lead: "Limits.",
    q: "What are the limits of vawe?",
    a: [
      "vawe renders on one machine, with no distributed rendering. Output can differ between hosts that rasterise on a different GPU or Chrome version. The project is under active development, and the open problems are listed on the ",
      { text: "problems page", href: "/problems" },
      ".",
    ],
  },
];
