import type { Metadata } from "next";
import { Header, REPO_URL } from "../components/Header";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { Next, PageTop } from "../components/Xp";
import { breadcrumbSchema, jsonLdScript } from "../../lib/schema";
import { inspirationSchema } from "../../lib/schema-content";
import { INSPIRATION, INSPIRATION_DESCRIPTION, INSPIRATION_PAGE, INSPIRATION_PATH, INSPIRATION_TITLE, INSPIRATION_TYPES, titleOf } from "../../lib/inspiration";
import { INSPIRATION_TYPE_PAGES, typePath } from "../../lib/content/inspiration-types";
import { InspirationWall } from "./InspirationWall";
import "./inspiration.css";

const SUGGEST = `${REPO_URL}/issues/new?title=${encodeURIComponent("Inspiration post: ")}`;

// The videos play from X's CDN, which answers 403 to a request that carries a foreign Referer.
export const metadata: Metadata = {
  ...pageMetadata({ title: INSPIRATION_TITLE, description: INSPIRATION_DESCRIPTION, path: INSPIRATION_PATH }),
  referrer: "no-referrer",
};

export default function Inspiration() {
  return (
    <div className="shell in-shell">
      <Header active="inspiration" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema([{ name: "vawe", url: "/" }, { name: "Inspiration", url: INSPIRATION_PATH }]))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(inspirationSchema({ name: "Motion video inspiration", description: INSPIRATION_DESCRIPTION, count: INSPIRATION_PAGE }))}
      />
      <div className="wrap">
        <main id="content" className="in" tabIndex={-1}>
          <InspirationWall posts={INSPIRATION} types={INSPIRATION_TYPES} suggestHref={SUGGEST}>
            <PageTop group="Learn" current="Inspiration" />
            <h1>Motion video inspiration</h1>
            <p className="in-lede">Made with Claude and other AI, from posts on X.</p>
            <nav className="in-types" aria-label="Video types">
              {INSPIRATION_TYPE_PAGES.map((t) => (
                <a key={t.id} href={typePath(t.id)}>{t.noun} examples</a>
              ))}
            </nav>
          </InspirationWall>
          <noscript>
            <h2>More posts</h2>
            <ul>
              {INSPIRATION.slice(INSPIRATION_PAGE).map((p) => (
                <li key={p.id}>
                  <a href={p.url} rel="noopener">{titleOf(p)}</a>, by {p.creator.name ? `${p.creator.name} (@${p.creator.handle})` : `@${p.creator.handle}`}
                </li>
              ))}
            </ul>
          </noscript>
          <Next
            title="Make one of your own."
            lead="Copy a recreation prompt and give it to your agent, or write the page it inspired."
            primary={{ href: "/docs/quickstart", label: "Start with the quickstart" }}
            secondary={{ href: "/video-components", label: "See the video components" }}
          />
        </main>
      </div>
      <Footer active={INSPIRATION_PATH} />
    </div>
  );
}
