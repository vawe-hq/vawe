import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { GROUPS, JOBS, LOOKS, MOVES, MOVES_DESCRIPTION, MOVES_INTRO, MOVES_TITLE, NUMBERED, clip, toCard } from "../../lib/moves";
import { jsonLdScript } from "../../lib/schema";
import { movesItemListSchema } from "../../lib/schema-content";
import { MovesGallery } from "./MovesGallery";
import Link from "next/link";
import { Next } from "../components/Xp";
import { GROUP_PAGES, groupFacts, groupPath } from "../../lib/content/move-groups";
import { Hero } from "./Hero";
import { MiscSvg } from "./icons";
import "./moves.css";

export const metadata = pageMetadata({
  title: MOVES_TITLE,
  description: MOVES_DESCRIPTION,
  path: "/video-components",
});

const withClip = NUMBERED.filter((m) => m.clipHash);
const HERO = [4, 28, 52, 76, 100].map((i) => ({ src: clip(withClip[Math.min(i, withClip.length - 1)]).poster }));

export default function Moves() {
  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(movesItemListSchema())} />
      <Header active="video-components" />
      <main className="wrap" id="content" tabIndex={-1}>
        <section className="ls ls-top mv">
          <h1>Video components.</h1>
          <p className="mv-intro">{MOVES_INTRO}</p>
          <p className="mv-links">
            <a href="/moves/index.json"><MiscSvg name="json" size={14} />index.json</a>
            <a href="/easing"><MiscSvg name="curve" size={14} />Easing</a>
          </p>
          <Hero posters={HERO} />
          <MovesGallery
            moves={NUMBERED.map(toCard)}
            groups={GROUPS}
            looks={LOOKS}
            jobs={JOBS.map(({ id, label }) => ({ id, label }))}
          />
          <div className="mv-sec" id="groups">
            <h2 className="mv-sec-h">Browse by group</h2>
            <ul className="mvd-more">
              {GROUP_PAGES.map((g) => {
                const f = groupFacts(g.id);
                return (
                  <li key={g.id}>
                    <Link href={groupPath(g.id)} prefetch={false}>{f.label}</Link> ({f.count})
                  </li>
                );
              })}
            </ul>
          </div>
          <Next
            title="Copy one into a page."
            lead="Chain video components with the recipes, or hand the list to an agent."
            primary={{ href: "/docs/recipes", label: "Chain components with recipes" }}
            secondary={{ href: "/ai-agents", label: "Let an agent use them" }}
            related={[
              { href: "/easing", label: "Easing functions as CSS" },
              { href: "/docs/motion", label: "The motion guide" },
              { href: "/launch-video", label: "A launch film, built from these video components" },
            ]}
          />
        </section>
      </main>
      <Footer active="/video-components" />
    </div>
  );
}
