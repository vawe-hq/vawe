import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header, REPO_URL } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { pageMetadata } from "../../components/seo";
import { Next, PageTop } from "../../components/Xp";
import { breadcrumbSchema, jsonLdScript } from "../../../lib/schema";
import { INSPIRATION_PAGE, INSPIRATION_PATH, titleOf } from "../../../lib/inspiration";
import { INSPIRATION_TYPE_PAGES, lessonUrl, postsOfType, typeFacts, typePage, typePath } from "../../../lib/content/inspiration-types";
import { InspirationWall } from "../InspirationWall";
import "../inspiration.css";

type Params = { params: Promise<{ type: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return INSPIRATION_TYPE_PAGES.map((t) => ({ type: t.id }));
}

const SUGGEST = `${REPO_URL}/issues/new?title=${encodeURIComponent("Inspiration post: ")}`;

// The videos play from X's CDN, which answers 403 to a request that carries a foreign Referer.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = typePage((await params).type);
  if (!t) return {};
  return { ...pageMetadata({ title: t.title, description: t.description, path: typePath(t.id) }), referrer: "no-referrer" };
}

export default async function InspirationType({ params }: Params) {
  const t = typePage((await params).type);
  if (!t) notFound();
  const posts = postsOfType(t.id);
  const facts = typeFacts(t.id);

  return (
    <div className="shell in-shell">
      <Header active="inspiration" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbSchema([
            { name: "vawe", url: "/" },
            { name: "Inspiration", url: INSPIRATION_PATH },
            { name: t.noun, url: typePath(t.id) },
          ]),
        )}
      />
      <div className="wrap">
        <main id="content" className="in" tabIndex={-1}>
          <InspirationWall posts={posts} types={[]} suggestHref={SUGGEST}>
            <PageTop group="Learn" parent={{ href: INSPIRATION_PATH, label: "Inspiration" }} current={t.noun} />
            <h1>{t.noun} video examples made with AI</h1>
            <p className="in-lede">
              {facts.count} posts from X. The median length is {facts.median} seconds. {facts.withPrompt} share the prompt.
            </p>
          </InspirationWall>
          <noscript>
            <h2>More posts</h2>
            <ul>
              {posts.slice(INSPIRATION_PAGE).map((p) => (
                <li key={p.id}>
                  <a href={p.url} rel="noopener">{titleOf(p)}</a>, by {p.creator.name ? `${p.creator.name} (@${p.creator.handle})` : `@${p.creator.handle}`}
                </li>
              ))}
            </ul>
          </noscript>
          <section className="in-about">
            <h2>What {t.noun.toLowerCase()} videos are for</h2>
            {t.intro.map((s) => (
              <p key={s}>{s}</p>
            ))}
            <h2>What to take from them</h2>
            <ol>
              {t.lessons.map((l) => (
                <li key={l.text}>
                  {l.text} <a href={lessonUrl(l.file)} rel="noopener"><code>{l.file}</code></a>
                </li>
              ))}
            </ol>
            <p>
              <a href={t.vawe.href}>{t.vawe.label}</a>
              {t.also.map((a) => (
                <span key={a.href}>
                  {" · "}
                  <a href={a.href}>{a.label}</a>
                </span>
              ))}
              {" · "}
              <a href={INSPIRATION_PATH}>All inspiration</a>
            </p>
          </section>
          <Next
            title="Make one of your own."
            lead="Copy a recreation prompt and give it to your agent, or write the page it inspired."
            primary={{ href: t.vawe.href, label: t.vawe.label }}
            secondary={{ href: "/docs/quickstart", label: "Start with the quickstart" }}
          />
        </main>
      </div>
      <Footer active={typePath(t.id)} />
    </div>
  );
}
