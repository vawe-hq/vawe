import { Header } from "../components/Header";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { Footer } from "../components/Footer";
import { MoveClips } from "../components/MoveClips";
import { pageMetadata } from "../components/seo";
import { PageTop, Toc } from "../components/Xp";
import { NextView, SectionView } from "../components/RichText";
import { SCREEN_RECORDING as C } from "../../lib/content/screen-recording";
import "../components/intent.css";

export const metadata = pageMetadata({ ...C.meta, path: C.path });

export default function ScreenRecordingToDemoVideo() {
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

          <SectionView s={C.steps} />
          <SectionView s={C.waits} />
          <SectionView s={C.extras} />
          <SectionView s={C.differs} />

          <section className="ifilms" id="moves">
            <h2>{C.moves.title}</h2>
            <p>{C.moves.lead}</p>
            <MoveClips names={C.moves.clips} />
          </section>

          <SectionView s={C.more} />

          <NextView n={C.next} />
        </main>
      </div>
      <Footer active={C.path} />
    </div>
  );
}
