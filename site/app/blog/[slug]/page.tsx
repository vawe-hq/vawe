import Link from "next/link";
import { notFound } from "next/navigation";
import { Header, DOCS_URL, REPO_URL, VaweMark } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { pageMetadata } from "../../components/seo";
import { blogPostingSchema, breadcrumbSchema, jsonLdScript } from "../../../lib/schema";
import { allPosts, postBySlug, relatedPosts, smart, updatedLabel } from "../../../lib/blog";
import { Cover } from "../Cover";
import { Card } from "../Card";
import { ScrollSpy } from "../../components/ScrollSpy";
import "../blog.css";

type Params = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params) {
  const post = postBySlug((await params).slug);
  if (!post) return {};
  const base = pageMetadata({ title: `${post.title} | vawe blog`, description: post.description, path: `/blog/${post.slug}`, type: "article" });
  return {
    ...base,
    keywords: post.keywords,
    alternates: { ...base.alternates, types: { ...base.alternates?.types, "application/rss+xml": "/blog/rss.xml" } },
    openGraph: {
      ...base.openGraph,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updated,
      section: post.sectionLabel,
      tags: post.tags,
      authors: ["vawe"],
    },
  };
}

export default async function PostPage({ params }: Params) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  const path = `/blog/${post.slug}`;
  const related = relatedPosts(post);
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Blog", url: "/blog" },
    { name: post.title, url: path },
  ];
  const images = [...(post.cover ? [post.cover.src] : [`${path}/opengraph-image`]), ...(post.hero && !post.hero.src.endsWith(".svg") ? [post.hero.src] : [])];
  const schema = blogPostingSchema({
    headline: post.title,
    description: post.description,
    path,
    datePublished: post.date,
    dateModified: post.updated,
    images,
    section: post.sectionLabel,
    keywords: post.keywords,
  });

  return (
    <div className="shell">
      <Header />
      <main className="wrap" id="content" tabIndex={-1}>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(schema)} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema(crumbs))} />
        <article className="bp" data-s={post.section}>
          <header className="bp-head">
            <div className="bp-head-text">
              <p className="kicker">
                <Link href="/blog">Blog</Link>
                <span aria-hidden="true">/</span>
                <Link className="bl-sec" href={`/blog#${post.section}`}><span className="sw" />{post.sectionLabel}</Link>
              </p>
              <h1>{smart(post.title)}</h1>
              <p className="bp-dek">{smart(post.description)}</p>
              <p className="meta bp-meta">
                {post.no ? <span>No. {String(post.no).padStart(2, "0")}</span> : null}
                <span>{post.minutes} min read</span>
                {updatedLabel(post) ? <span>Updated {updatedLabel(post)}</span> : null}
              </p>
            </div>
          </header>

          {post.cover ? (
            <figure className="bp-hero">
              <Cover post={post} eager />
            </figure>
          ) : post.hero ? (
            <figure className="bp-hero bp-hero-fig">
              <img src={post.hero.src} alt={post.hero.alt} width={post.hero.width} height={post.hero.height} fetchPriority="high" decoding="async" />
            </figure>
          ) : null}

          <div className="bp-grid">
            {post.toc.length > 1 ? (
              <nav className="bp-toc" aria-label="On this page">
                <span className="meta">On this page</span>
                <ol>
                  {post.toc.map((h, i) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`}><span className="bp-toc-n">{String(i + 1).padStart(2, "0")}</span>{h.text}</a>
                    </li>
                  ))}
                </ol>
                <ScrollSpy nav=".bp-toc" />
              </nav>
            ) : null}
            <div className="bp-body">
              {post.cover && post.hero && !post.heroInBody ? (
                <figure>
                  <img src={post.hero.src} alt={post.hero.alt} width={post.hero.width} height={post.hero.height} loading="lazy" decoding="async" />
                </figure>
              ) : null}
              <div className="bp-prose" dangerouslySetInnerHTML={{ __html: post.html }} />
            </div>
          </div>

          {post.docs.length ? (
            <p className="bp-docs">
              <span className="meta">Docs</span>
              {post.docs.map((d) => (
                <a key={d.slug} href={`/docs/${d.slug}`}>{d.title}</a>
              ))}
            </p>
          ) : null}

          {related.length ? (
            <section className="bp-related" aria-labelledby="bp-related">
              <h2 id="bp-related">Read next</h2>
              <ul className="bl-grid">
                {related.map((p) => (
                  <Card key={p.slug} post={p} />
                ))}
              </ul>
            </section>
          ) : null}
          <aside className="panel bp-made" aria-labelledby="bp-made">
            <VaweMark className="bp-made-glyph" />
            <div className="bp-made-text">
              <h2 id="bp-made">Made with vawe</h2>
              <p>
                vawe is the open source framework behind these notes: an agent writes one HTML page and the renderer turns
                it into a film. Apache 2.0.
              </p>
            </div>
            <div className="bp-made-act">
              <a className="btn btn-primary" href={REPO_URL} rel="noopener">Read the code</a>
              <a className="btn btn-ghost" href={DOCS_URL}>Start with the docs</a>
            </div>
          </aside>
        </article>
      </main>
      <Footer active="/blog" />
    </div>
  );
}
