import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Clip } from "./components/Clip";
import { LandingMotion } from "./components/LandingMotion";
import { organizationSchema, websiteSchema, softwareApplicationSchema, softwareSourceCodeSchema, jsonLdScript } from "../lib/schema";
import { faqSchema } from "../lib/schema-content";
import { FAQ } from "../lib/faq";
import { RichText } from "./components/RichText";
import { clip, moveByName } from "../lib/moves";
import { CopyBtn } from "./easing/CopyBtn";
import { HOME } from "../lib/content/home";
import "./landing.css";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/* THE LANDING PAGE (site/IDENTITY.md, DESIGN.md "Landing"). A full-bleed film, three pinned chapters with
 * one large film each (problem, page, render, result), the page contract, the moves, questions, and the
 * way in. The films carry the story; the copy stays short.
 */

type Film = { mp4: string; poster: string };

const example = (id: string): Film => ({ mp4: `/examples/${id}.mp4`, poster: `/examples/${id}.webp` });
const { hero, chapters, how, moves, end } = HOME;
const HERO = example(hero.film);

export default function Home() {
  return (
    <div className="shell home">
      {/* Organization, WebSite, SoftwareApplication and FAQPage, built in site/lib/schema.ts from real repo data. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(organizationSchema())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(websiteSchema())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(softwareApplicationSchema())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(softwareSourceCodeSchema())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqSchema())} />
      <Header overlay />
      <main className="lp" id="content" tabIndex={-1}>
        <nav className="lp-rail" aria-label="Chapters">
          {chapters.map((c) => (
            <a key={c.id} href={`#${c.id}`} aria-label={`Chapter ${c.tag.replace(" / ", ": ")}`} />
          ))}
        </nav>

        <section className="lp-hero" id="intro" aria-label="vawe">
          <div className="lp-frame lp-hero-frame">
            <Clip className="lp-film" src={HERO.mp4} poster={HERO.poster} decorative />
            <div className="lp-hero-copy">
              <h1 className="lp-display">
                <span className="mono lp-hero-brand">{hero.brand}</span>
                {hero.h1[0]}<br />{hero.h1[1]}
              </h1>
              <p className="lp-lede">{hero.lede}</p>
              <div className="lp-row">
                <a className="btn btn-primary" href={hero.primary.href}>{hero.primary.label}</a>
                <Link className="btn lp-btn-line" href={hero.secondary.href}>{hero.secondary.label}</Link>
              </div>
              <div className="lp-install">
                <div className="lp-install-row">
                  <code className="lp-install-cmd">{hero.install.cmd}</code>
                  <CopyBtn className="lp-install-copy" value={hero.install.cmd} label="Copy" />
                </div>
                <span className="lp-install-next">{hero.install.next}</span>
              </div>
            </div>
          </div>
        </section>

        {chapters.map((c) => (
          <section className="lp-ch" id={c.id} key={c.id} aria-labelledby={`${c.id}-h`}>
            <div className="lp-stage">
              <div className="lp-pane lp-frame">
                <Clip className="lp-film" src={example(c.film).mp4} poster={example(c.film).poster} decorative />
                <p className="lp-tag mono">{c.tag}</p>
                <div className="lp-cap">
                  <h2 id={`${c.id}-h`}>{c.title}</h2>
                  <p>{c.text}</p>
                </div>
              </div>
            </div>
          </section>
        ))}

        <section className="lp-how lp-gridlines" id="how" aria-labelledby="how-h">
          <div className="lp-rv">
            <h2 id="how-h">{how.title}</h2>
            <pre className="lp-code" tabIndex={0} aria-label={how.codeLabel}>
              {how.code.map((c, i) =>
                c.kind === "dim" ? <i key={i}>{c.text}</i> : c.kind === "tag" ? <b key={i}>{c.text}</b> : c.text,
              )}
            </pre>
            <p className="mono lp-code-note">{how.codeFile}</p>
          </div>
          <div className="lp-side lp-rv">
            <p>{how.side}</p>
            <div>
              {how.commands.map((c) => (
                <div className="lp-cmd" key={c.cmd}><span>$</span>{c.cmd}<em>{c.note}</em></div>
              ))}
            </div>
            <a className="btn lp-btn-line" href={how.contract.href}>{how.contract.label}</a>
          </div>
        </section>

        <div className="lp-moves-head" id="moves">
          <h2>{moves.title}</h2>
          <Link className="btn lp-btn-line" href={moves.all.href}>{moves.all.label}</Link>
        </div>
        <section className="lp-grid" aria-label="Video component clips">
          {moves.shown.map((name) => {
            const m = moveByName(name);
            if (!m) return null;
            const f = clip(m);
            return (
              <Link className="lp-cell" href={`/video-components/${m.name}`} key={m.name} prefetch={false}>
                <div className="lp-frame"><Clip className="lp-film" src={f.mp4} poster={f.poster} decorative /></div>
                <span className="mono">{m.title}</span>
              </Link>
            );
          })}
        </section>

        <section className="lp-faq" id="faq" aria-labelledby="faq-h">
          <h2 id="faq-h" className="lp-rv">{HOME.faqTitle}</h2>
          <div className="lp-faq-list lp-rv">
            {FAQ.map((item, i) => (
              <details key={item.q} open={i === 0}>
                <summary>{item.q}</summary>
                <p>
                  <RichText p={item.a} />
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-end lp-gridlines" aria-labelledby="end-h">
          <h2 id="end-h" className="lp-rv">{end.title}</h2>
          <div className="lp-row lp-rv">
            <a className="btn btn-primary" href={end.primary.href}>{end.primary.label}</a>
            <a className="btn lp-btn-line" href={end.docs.href}>{end.docs.label}</a>
          </div>
          <div className="lp-install lp-rv">
            {end.install.map((c) => (
              <div className="lp-cmd" key={c.cmd}><span>$</span>{c.cmd}<em>{c.note}</em></div>
            ))}
          </div>
        </section>
      </main>
      <LandingMotion />
      <Footer />
    </div>
  );
}
