import type { ReactNode } from "react";
import Link from "next/link";
import { Header } from "../components/Header";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { Clip } from "../components/Clip";
import { MoveClips } from "../components/MoveClips";
import { Next, PageTop, Toc } from "../components/Xp";
import { RichText } from "../components/RichText";
import { FEATURES, FEATURES_BARS, FEATURES_SESSION, type FeatureSection, type Proof } from "../../lib/content/features";
import { EASES } from "../../lib/easing";
import { Thumb } from "../easing/Charts";
import { BlurDemo } from "./Demos";
import "../components/intent.css";
import "../easing/easing.css";
import "./features.css";

export const metadata = pageMetadata({ ...FEATURES.meta, path: FEATURES.path });

/* /features · THREE PILLARS: agent experience, taste, speed. Every claim reads off the repo: AGENTS.md,
 * harness/media/render-page.mjs, core/surfaces/lens.js, and `bin/vawe <verb> --help`. The session under "AX" is
 * real output of bin/vawe new, dev and critique on a 6 s page (lines trimmed with an ellipsis). The speed bars are
 * wall times measured with bin/vawe dev on 2026-10-14 (out/<film>.runs.jsonl, wallS). The moves and easing counts
 * read lib/moves.json and lib/easing.json.
 */

const showcase = { mp4: "/examples/showcase.mp4", poster: "/examples/showcase.webp" };

function Code({ label, children }: { label: string; children: string }) {
  return (
    <div className="codeblock">
      <div className="lbl">{label}</div>
      <pre className="code" tabIndex={0}>{children}</pre>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <p className="ft-stat"><b>{n}</b><span>{label}</span></p>
  );
}

function ProofView({ proof }: { proof: Proof }) {
  if (proof.kind === "code") return <Code label={proof.code.label}>{proof.code.text}</Code>;
  if (proof.kind === "stat") return <Stat n={proof.n} label={proof.label} />;
  if (proof.kind === "blur") return <BlurDemo />;
  const ease = EASES.find((e) => e.slug === proof.ease);
  return ease ? <Link href={`/easing/${ease.slug}`} className="panel ft-curve"><Thumb e={ease} /><span className="meta">{ease.name}: cubic-bezier({ease.bezier.params.join(", ")}), {ease.points} linear() points</span></Link> : null;
}

function Feature({ f }: { f: FeatureSection["features"][number] }) {
  return (
    <li className="ft-row">
      <div className="ft-text">
        <h3>{f.title}</h3>
        <p><RichText p={f.body} /></p>
      </div>
      <div className="ft-proof"><ProofView proof={f.proof} /></div>
    </li>
  );
}

function Section({ id, title, lead, visual, children }: { id: string; title: string; lead: string; visual: ReactNode; children: ReactNode }) {
  return (
    <section className="isec ft-sec" id={id} aria-labelledby={`${id}-h`}>
      <div className="ft-head">
        <h2 id={`${id}-h`}>{title}</h2>
        <p>{lead}</p>
      </div>
      <div className="ft-visual">{visual}</div>
      <ul className="ft-list">{children}</ul>
    </section>
  );
}

function Session() {
  return (
    <figure className="ftt panel">
      <div className="lbl">{FEATURES.sessionLabel}</div>
      <pre className="code" tabIndex={0}>
        {FEATURES_SESSION.map((s) => (
          <span className="ftt-step" key={s.cmd}>
            <span className="ftt-cmd">{s.cmd}</span>
            {s.out.map((l) => (
              <span className="ftt-out" key={l}>{l}</span>
            ))}
          </span>
        ))}
      </pre>
    </figure>
  );
}

function SpeedBars() {
  const max = Math.max(...FEATURES_BARS.map((b) => b.s));
  return (
    <figure className="fts panel">
      {FEATURES_BARS.map((b, i) => (
        <div className="fts-row" key={b.label}>
          <span className="fts-l">{b.label}</span>
          <div className="fts-bar" aria-hidden="true"><i data-last={i === FEATURES_BARS.length - 1} style={{ width: `${(b.s / max) * 100}%` }} /></div>
          <b className="mono">{b.s.toFixed(1)}&nbsp;s</b>
        </div>
      ))}
      <figcaption className="meta">
        <RichText p={FEATURES.barsCaption} />
      </figcaption>
    </figure>
  );
}

const VISUALS = {
  session: () => <Session />,
  "taste-clips": () => <MoveClips names={FEATURES.tasteClips} />,
  "speed-bars": () => <SpeedBars />,
};

export default function Features() {
  const { crumb, next } = FEATURES;
  return (
    <div className="shell">
      <Header active="resources" />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema([{ name: "vawe", url: "/" }, { name: crumb.current, url: FEATURES.path }]))} />
      <div className="wrap">
        <main id="content" className="ipage xp" tabIndex={-1}>
          <section className="phead">
            <PageTop group={crumb.group} current={crumb.current} />
            <h1>{FEATURES.h1}</h1>
            <p>{FEATURES.lede}</p>
            <Toc items={FEATURES.toc} />
            <div className="ft-film ft-hero">
              <Clip src={showcase.mp4} poster={showcase.poster} decorative />
            </div>
          </section>

          {FEATURES.sections.map((sec) => (
            <Section key={sec.id} id={sec.id} title={sec.title} lead={sec.lead} visual={VISUALS[sec.visual]()}>
              {sec.features.map((f) => (
                <Feature key={f.title} f={f} />
              ))}
            </Section>
          ))}

          <section className="ft-end" aria-label="A film made with vawe">
            <div className="ft-film">
              <Clip src="/examples/cindre.mp4" poster="/examples/cindre.webp" decorative />
            </div>
            <span className="meta">{FEATURES.end.caption}</span>
          </section>

          <Next title={next.title} lead={next.lead ? <RichText p={next.lead} /> : undefined} primary={next.primary} />
        </main>
      </div>
      <Footer active={FEATURES.path} />
    </div>
  );
}
