import { Header } from "../components/Header";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { Footer } from "../components/Footer";
import { MoveClips } from "../components/MoveClips";
import { pageMetadata } from "../components/seo";
import { PageTop, Toc } from "../components/Xp";
import { NextView, SectionView } from "../components/RichText";
import { LAUNCH_VIDEO as C } from "../../lib/content/launch-video";
import "../components/intent.css";

export const metadata = pageMetadata({ ...C.meta, path: C.path });

/* /launch-video · a use-case page built from guides/ROUTING.md's film-type table.
 * Someone searching "product launch video" names a JOB, not this engine's vocabulary, so the page
 * answers in that wording, and shows the moves a launch film is built from.
 */

export default function LaunchVideo() {
  return (
    <div className="shell">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema([{ name: "vawe", url: "/" }, { name: C.crumb.current, url: C.path }]))} />
      <div className="wrap">
        <main id="content" className="ipage xp" tabIndex={-1}>
          <section className="phead">
            <PageTop group={C.crumb.group} current={C.crumb.current} />
            <h1>{C.h1}</h1>
            <p>{C.lede}</p>
            <Toc items={C.toc} />
          </section>

          <SectionView s={C.route} />
          <SectionView s={C.beats} />

          <section className="ifilms" id="moves">
            <h2>{C.moves.title}</h2>
            <p>{C.moves.lead}</p>
            <MoveClips names={C.moves.clips} />
          </section>

          <SectionView s={C.invent} />
          <SectionView s={C.family} />

          <NextView n={C.next} />
        </main>
      </div>
      <Footer active={C.path} />
    </div>
  );
}
