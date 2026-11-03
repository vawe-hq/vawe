import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { pageMetadata } from "../../components/seo";
import { jsonLdScript, breadcrumbSchema } from "../../../lib/schema";
import { CopyCode } from "../../video-components/[name]/CopyCode";
import { SPRINGS, THRESHOLD_PERCENT, cssText, curveOf, libraryOf, pageDescription, pageTitle, springBySlug, summary, techArticleSchema, vaweCode, waapi, characterOf } from "../../../lib/springs";
import { CopyBtn } from "../../easing/CopyBtn";
import { SpringLab } from "../SpringLab";
import { Next, Toc } from "../../components/Xp";
import "../../video-components/moves.css";
import "../../components/intent.css";
import "../../easing/easing.css";
import "../springs.css";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SPRINGS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Params) {
  const s = springBySlug((await params).slug);
  if (!s) return {};
  return pageMetadata({ title: pageTitle(s), description: pageDescription(s), path: `/springs/${s.slug}` });
}

function Code({ label, text }: { label: string; text: string }) {
  return (
    <figure className="mv-code">
      <div className="mv-code-bar">
        <span>{label}</span>
        <button type="button" className="mv-copy" data-copy>Copy</button>
      </div>
      <pre><code>{text}</code></pre>
    </figure>
  );
}

export default async function SpringPage({ params }: Params) {
  const s = springBySlug((await params).slug);
  if (!s) notFound();
  const lib = libraryOf(s);
  const crumbs = [{ name: "Home", url: "/" }, { name: "Springs", url: "/springs" }, { name: s.name, url: `/springs/${s.slug}` }];
  const curve = curveOf(s);
  const stats: [string, string, string][] = [
    ["Stiffness", String(s.k), "k, with mass 1"],
    ["Damping", String(s.d), "d, with mass 1"],
    ["Damping ratio", String(s.zeta), characterOf(s)],
    ["Settle time", `${s.settle} s`, `within ${THRESHOLD_PERCENT}% of the end`],
    ["Overshoot", `${s.overshoot}%`, s.overshoot ? `peak at ${s.overshootAt} s` : "stays inside the end"],
    ["Crosses the end", String(s.crossings), s.crossings === 1 ? "time" : "times"],
    ["50% of travel", `${s.t50} s`, `${Math.round((s.t50 / s.settle) * 100)}% of the settle time`],
    ["90% of travel", `${s.t90} s`, `${Math.round((s.t90 / s.settle) * 100)}% of the settle time`],
    ["Natural frequency", `${s.omega} rad/s`, "sqrt(k)"],
    ["Ring period", s.period === null ? "none" : `${s.period} s`, s.period === null ? "it does not oscillate" : "one swing of the overshoot"],
    ["Peak speed", `${s.peakSpeed}x`, "times the average speed"],
    ["linear() points", String(s.points), `within ${(s.linearWorst * 100).toFixed(2)}% of travel`],
  ];

  return (
    <div className="shell">
      <Header active="resources" />
      <main className="wrap" id="content" tabIndex={-1}>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(techArticleSchema(s))} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema(crumbs))} />
        <article className="ez" id="ez-main">
          <header className="phead ez-head">
            <p className="kicker">
              <Link href="/springs">Springs</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/springs#${lib.id}`}>{lib.label}</Link>
            </p>
            <h1>{s.name}</h1>
            <p className="ez-sum">{s.note} {summary(s)}</p>
            <div className="ez-quick" role="group" aria-label="Copy a format">
              <CopyBtn value={s.linear} label="Copy linear()" />
              <CopyBtn value={cssText(s)} label="Copy CSS" />
              <CopyBtn value={waapi(s)} label="Copy Web Animations" />
            </div>
            <Toc
              label="On this page"
              items={[
                { href: "#demo", label: "Demo" },
                { href: "#code", label: "Code" },
                { href: "#numbers", label: "Numbers" },
                { href: "#source", label: "Source" },
                { href: "#related", label: "Related springs" },
              ]}
            />
          </header>

          <section className="ez-sec" aria-labelledby="demo">
            <h2 id="demo">Demo</h2>
            <SpringLab name={s.name} y={curve.y} vel={curve.vel} t50={curve.t50} t90={curve.t90} peakSpeed={curve.peakSpeed} settle={s.settle} linear={s.linear} />
          </section>

          <section className="ez-sec" aria-labelledby="code">
            <h2 id="code">Code</h2>
            <p>
              A spring has no fixed duration, so the CSS takes the settle time ({s.ms} ms) and a <code>linear()</code> string that follows the spring.
            </p>
            <div className="ez-codes">
              <Code label="css linear()" text={cssText(s)} />
              <Code label="web animations api" text={waapi(s)} />
              <Code label="vawe" text={vaweCode(s)} />
            </div>
          </section>

          <section className="ez-sec" aria-labelledby="numbers">
            <h2 id="numbers">Numbers</h2>
            <dl className="ez-stats">
              {stats.map(([k, v, note]) => (
                <div className="panel ez-stat" key={k}>
                  <dt>{k}</dt>
                  <dd>{v}<small>{note}</small></dd>
                </div>
              ))}
            </dl>
            <p className="ez-note">
              Computed with <code>spring()</code> and <code>springDuration()</code> from <code>core/motion/springs.js</code>. The settle time is the last moment the spring is more than {THRESHOLD_PERCENT}% away from the end value; a library stops its own spring by its own rest thresholds, so its clock can run shorter.
            </p>
          </section>

          <section className="ez-sec" aria-labelledby="source">
            <h2 id="source">Source of the numbers</h2>
            <div className="ez-scroll">
              <table className="ez-table ez-stack sp-src">
                <tbody>
                  <tr><td data-label="Library">{lib.label}</td><td data-label="Version" className="n">{s.source.version}</td></tr>
                  <tr><td data-label="Original">{s.original}</td><td data-label="Where" className="n">{s.source.file ?? ""}</td></tr>
                </tbody>
              </table>
            </div>
            {s.source.url ? (
              <p className="sp-src-link">
                Read it at <a href={s.source.url} rel="noopener">{s.source.url.replace(/^https:\/\//, "")}</a>.
              </p>
            ) : null}
            {s.conversion ? <p className="ez-note">Conversion: {s.conversion}</p> : <p className="ez-note">These numbers are used as they are.</p>}
          </section>

          <section className="ez-sec" aria-labelledby="related">
            <h2 id="related">Related springs</h2>
            <p>The four closest curves in this set, by the average gap between the two springs over their first seconds. A gap of 0.01 is invisible; 0.1 is a different feel.</p>
            <ul className="ez-rel">
              {s.related.map((r) => {
                const o = springBySlug(r.slug)!;
                return (
                  <li key={r.slug} className="panel">
                    <Link href={`/springs/${r.slug}`} prefetch={false}>{r.name}</Link>
                    <span className="meta">gap {r.gap} / {o.settle} s / {o.overshoot}% over</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <Next
            title="More springs"
            primary={{ href: "/springs", label: "All spring presets" }}
            secondary={{ href: "/easing", label: "Easing functions" }}
            related={[{ href: "/docs/motion", label: "Motion in the docs" }]}
          />
          <CopyCode rootId="ez-main" />
        </article>
      </main>
      <Footer active="/springs" />
    </div>
  );
}
