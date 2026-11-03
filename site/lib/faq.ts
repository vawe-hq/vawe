// The home FAQ. The page renders these items and lib/schema-content.ts builds the FAQPage from them, so the
// visible answers and the structured data cannot differ.
import { REPO_URL } from "./schema";
import { FACTS } from "./content/facts";
import { plain, type Para } from "./content/types";

export type Segment = string | { text: string; href: string };
export type FaqItem = { q: string; a: Para };

const factItem = (id: string): FaqItem => {
  const f = FACTS.find((x) => x.id === id);
  if (!f) throw new Error(`unknown fact ${id}`);
  return { q: f.q, a: f.faqOpen ? [f.faqOpen, ...f.a] : f.a };
};

export const FAQ: FaqItem[] = [
  { q: "What is vawe?", a: ["vawe is an open source framework that turns one HTML page into a video file. You, or a coding agent, write the film in HTML, CSS, Web Animations, SVG, canvas or three.js; the renderer seeks the page frame by frame in headless Chrome and encodes it with ffmpeg. Typical films are ", { text: "product launch videos", href: "/launch-video" }, ", ", { text: "product showcase videos", href: "/product-showcase-video" }, " and ", { text: "explainer videos", href: "/explainer-video" }, ". See ", { text: "what the engine does", href: "/features" }, ". The ", { text: "blog", href: "/blog" }, " covers how it is built and measured."] },
  { q: "Is it open source?", a: ["Yes, under Apache 2.0. The engine, the studio and this site are ", { text: "on GitHub", href: REPO_URL }, "."] },
  { q: "Where does it run?", a: ["On your machine. The renderer drives Chrome and encodes with ffmpeg, and the studio previews a page live."] },
  { q: "Does it work with my agent?", a: ["Yes. A film is plain HTML, so any coding agent can write one, and vawe ships skills that teach it the loop: write, draft, critique, ship. See ", { text: "vawe for AI agents", href: "/ai-agents" }, "."] },
  { q: "Can it match my brand?", a: ["Yes. A page uses your fonts and colours as CSS, the same way your site does."] },
  { q: "How is it different from Remotion?", a: ["Remotion builds video from React components under a source-available licence. vawe renders one HTML page under Apache 2.0, with no React and no build step. Both render in headless Chrome. Read ", { text: "vawe vs Remotion", href: "/vs/remotion" }, " or the wider list of ", { text: "Remotion alternatives", href: "/remotion-alternatives" }, "."] },
  factItem("free"),
  factItem("install"),
  factItem("account"),
  factItem("needs"),
  factItem("output"),
  factItem("limits"),
];

export const faqText = (item: FaqItem) => plain(item.a);
