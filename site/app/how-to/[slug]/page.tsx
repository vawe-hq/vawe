import { PromptCard } from "../../components/PromptCard";
import { PAGE_PROMPTS } from "../../../lib/prompts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { MoveClips } from "../../components/MoveClips";
import { pageMetadata } from "../../components/seo";
import { PageTop } from "../../components/Xp";
import { NextView, SectionView } from "../../components/RichText";
import { RichText } from "../../components/RichText";
import { jsonLdScript, breadcrumbSchema } from "../../../lib/schema";
import { HOW_TOS, HOW_TO_BY_SLUG, HOW_TO_HUB, howToPath } from "../../../lib/content/how-to";
import "../../components/intent.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return HOW_TOS.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const h = HOW_TO_BY_SLUG[slug];
  if (!h) return {};
  return pageMetadata({ ...h.meta, path: howToPath(h.slug) });
}

export default async function HowTo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const h = HOW_TO_BY_SLUG[slug];
  if (!h) notFound();
  const path = howToPath(h.slug);
  const parent = { href: HOW_TO_HUB.path, label: HOW_TO_HUB.crumb.current };

  return (
    <div className="shell">
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbSchema([
            { name: "vawe", url: "/" },
            { name: parent.label, url: parent.href },
            { name: h.h1.replace(/\.$/, ""), url: path },
          ]),
        )}
      />
      <div className="wrap">
        <main id="content" className="ipage xp" tabIndex={-1}>
          <section className="phead">
            <PageTop parent={parent} current={h.h1.replace(/\.$/, "")} />
            <h1>{h.h1}</h1>
            <p><RichText p={h.lede} /></p>
          </section>

          <PromptCard prompt={PAGE_PROMPTS[`/how-to/${h.slug}`]} />

          <SectionView s={h.steps} />
          <SectionView s={h.wrong} />

          {h.moves ? (
            <section className="ifilms" id="moves">
              <h2>{h.moves.title}</h2>
              <p>{h.moves.lead}</p>
              <MoveClips names={h.moves.clips} />
            </section>
          ) : null}

          <SectionView s={h.more} />
          <NextView n={h.next} />
        </main>
      </div>
      <Footer active={path} />
    </div>
  );
}
