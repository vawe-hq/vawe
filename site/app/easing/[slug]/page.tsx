import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { Clip } from "../../components/Clip";
import { pageMetadata } from "../../components/seo";
import { jsonLdScript, breadcrumbSchema } from "../../../lib/schema";
import { CopyCode } from "../../video-components/[name]/CopyCode";
import { EASES, STATS, classicIn, bezierText, camelOf, copyIsBezier, copyValue, easeBySlug, importLine, pageDescription, pageTitle, roleOf, speedText, summary, techArticleSchema, waapi, type Ease } from "../../../lib/easing";
import { MoveClips } from "../../components/MoveClips";
import { CopyBtn } from "../CopyBtn";
import { Code } from "../Code";
import { Lab, type Variant } from "../Lab";
import { Next, Toc } from "../../components/Xp";
import "../../video-components/moves.css";
import "../../components/intent.css";
import "../easing.css";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return EASES.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Params) {
  const e = easeBySlug((await params).slug);
  if (!e) return {};
  return pageMetadata({ title: pageTitle(e), description: pageDescription(e), path: `/easing/${e.slug}` });
}

const GROUP = { vawe: "vawe After Effects eases", css: "CSS keywords", classic: "Classic eases" } as const;
const pct = (u: number) => `${Math.round(u * 100)}%`;
const num = (n: number) => n.toLocaleString("en-US");

function turns(y: number[]) {
  let n = 0, last = 0;
  for (let i = 1; i < y.length; i++) {
    const d = Math.sign(y[i] - y[i - 1]);
    if (d && last && d !== last) n++;
    if (d) last = d;
  }
  return n;
}

const DIR_LABEL = { in: "In", out: "Out", inOut: "In-out" } as const;

function variantsOf(e: Ease): Variant[] {
  const set = e.kind === "classic" ? classicIn(e.family) : [e];
  const order = ["in", "out", "inOut"];
  return [...set]
    .sort((a, b) => order.indexOf(a.dir ?? "") - order.indexOf(b.dir ?? ""))
    .map((x) => ({ slug: x.slug, name: x.name, label: x.dir ? DIR_LABEL[x.dir] : x.name, y: x.y, vel: x.vel, t50: x.t50, t90: x.t90, peakSpeed: x.peakSpeed, linear: x.linear }));
}

const handleSpec = (h: { influence: number; speed: number; name: string | null }) => (h.name ? `'${h.name}'` : `{ influence: ${h.influence}, speed: ${h.speed} }`);

function BezierBlock({ e }: { e: Ease }) {
  if (e.kind === "vawe") {
    return (
      <>
        <Code label="cubic-bezier (exact)" text={`animation-timing-function: ${bezierText(e)};`} />
        <p className="ez-note">Exact: the two After Effects handles are the two control points. <code>EASE.{camelOf(e.slug)}</code> uses the <code>linear()</code> string above.</p>
      </>
    );
  }
  const worst = e.bezier.worst ?? 0;
  if (e.kind === "css") return <Code label="cubic-bezier (the keyword's definition)" text={e.slug === "linear" ? "animation-timing-function: linear;\n/* the same as cubic-bezier(0, 0, 1, 1) */" : `animation-timing-function: ${bezierText(e)};`} />;
  if (e.bezier.express === "no") {
    const t = turns(e.y);
    return (
      <>
        <Code label="cubic-bezier: no usable fit" text={`/* Best single fit, off by up to ${(worst * 100).toFixed(0)} points of travel: ${bezierText(e)} */`} />
        <p className="ez-note">
          A <code>cubic-bezier()</code> draws one smooth S. {e.name} changes direction {t} {t === 1 ? "time" : "times"}, so no four numbers draw it. Use the <code>linear()</code> string above.
        </p>
      </>
    );
  }
  return (
    <>
      <Code label={e.bezier.express === "exact" ? "cubic-bezier (matches within 0.5%)" : "cubic-bezier (nearest fit)"} text={`animation-timing-function: ${bezierText(e)};`} />
      <p className="ez-note">
        Least-squares fit; the worst gap is {(worst * 100).toFixed(1)} points of travel. {e.bezier.express === "close" ? "Use linear() when the end of the curve matters." : "The linear() string is exact."}
      </p>
    </>
  );
}

function Handles({ e }: { e: Ease }) {
  const h = e.handles;
  if (!h) return null;
  const s = h.shares;
  const row = (side: string, x: typeof h.out, share: number) => (
    <tr>
      <td data-label="Handle">{side}</td>
      <td data-label="Name">{x.name ?? "custom"}</td>
      <td data-label="Influence" className="n">{x.influence}%</td>
      <td data-label="Speed" className="n">{x.speed}x</td>
      <td data-label="Real handles near it" className="n">{share}%</td>
    </tr>
  );
  return (
    <section className="ez-sec" aria-labelledby="ae">
      <h2 id="ae">After Effects handles</h2>
      <p>
        Set these in After Effects under Keyframe Velocity: the outgoing handle on the first key, the incoming handle on the second. <strong>Influence</strong> is how far along the segment the handle reaches, in per cent of its duration. <strong>Speed</strong> is the pace at the key as a multiple of the segment’s average (0 stops dead, 1 is straight).
      </p>
      <div className="ez-scroll">
        <table className="ez-table ez-stack">
          <thead>
            <tr><th>Handle</th><th>Name</th><th>Influence</th><th>Speed</th><th>Real handles near it</th></tr>
          </thead>
          <tbody>
            {row("out (first key)", h.out, s.outShare)}
            {row("in (second key)", h.in, s.inShare)}
          </tbody>
        </table>
      </div>
      <p className="ez-note">
        Measured on {num(STATS.lottieSegments)} Lottie segments ({num(STATS.lottieHandles)} handles) and {STATS.hfSegments} HyperFrames segments. Near means influence within 10 points and speed within 0.3.{" "}
        {s.pairCount > 0
          ? `Both handles together: ${s.pairCount} segments (${s.pairShare}%), ${s.entranceShare}% of the ${STATS.entranceSegments} entrances and ${s.exitShare}% of the ${STATS.exitSegments} exits.`
          : "No Lottie segment has both handles near this pair."}{" "}
        {s.hfCount > 0 ? `${s.hfCount} of the ${STATS.hfSegments} HyperFrames segments use it.` : ""}
      </p>
      <div className="ez-codes">
        <Code
          label="vawe: key table"
          text={`import { keys } from '../../core/motion/presets.js';\n\n// out handle on the first key, in handle on the second\nkeys(el, 'translate', [\n  [0, '0 6vh', { out: ${handleSpec(h.out)} }],\n  [0.6, '0 0', { in: ${handleSpec(h.in)} }],\n]);`}
        />
      </div>
    </section>
  );
}

export default async function EasePage({ params }: Params) {
  const e = easeBySlug((await params).slug);
  if (!e) notFound();
  const crumbs = [{ name: "Home", url: "/" }, { name: "Easing", url: "/easing" }, { name: e.name, url: `/easing/${e.slug}` }];
  const stats: [string, string, string][] = [
    ["50% of travel", pct(e.t50), "of the time"],
    ["90% of travel", pct(e.t90), "of the time"],
    ["After 10% of time", `${e.at10}%`, "of the travel is done"],
    ["Peak speed", speedText(e).replace(" (it ends vertically)", ""), e.peakSpeed > 20 ? "it ends vertically" : "times the average"],
    ["Overshoot", `${e.overshoot}%`, e.overshoot ? "past the end value" : "stays inside the end"],
    ["Undershoot", `${e.undershoot}%`, e.undershoot ? "below the start value" : "never below the start"],
    ["linear() points", String(e.points), "at a 0.002 tolerance"],
    ["cubic-bezier", e.kind === "vawe" || e.bezier.express === "exact" ? "exact" : e.bezier.express === "close" ? "close" : "none", e.kind === "vawe" ? "built from two handles" : e.bezier.express === "no" ? "cannot express it" : `worst gap ${((e.bezier.worst ?? 0) * 100).toFixed(1)} points`],
  ];

  return (
    <div className="shell">
      <Header active="resources" />
      <main className="wrap" id="content" tabIndex={-1}>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(techArticleSchema(e))} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema(crumbs))} />
        <article className="ez" id="ez-main">
          <header className="phead ez-head">
            <p className="kicker">
              <Link href="/easing">Easing</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/easing#${e.kind}`}>{GROUP[e.kind]}</Link>
            </p>
            <h1>{e.kind === "css" ? `CSS ${e.name}` : e.name}</h1>
            <p className="ez-sum">{e.blurb} {summary(e)}</p>
            <p className="meta ez-meta">
              <span>{roleOf(e)}</span>
              {e.kind === "classic" ? <span>family: {e.family}</span> : null}
            </p>
            <div className="ez-quick" role="group" aria-label="Copy a format">
              <CopyBtn value={copyValue(e)} label={copyIsBezier(e) ? "Copy cubic-bezier" : "Copy linear()"} />
              {copyIsBezier(e) ? <CopyBtn value={e.linear} label="Copy linear()" /> : null}
              <CopyBtn value={waapi(e)} label="Copy Web Animations" />
            </div>
            <Toc
              label="On this page"
              items={[
                { href: "#demo", label: "Demo" },
                { href: "#code", label: "Code" },
                { href: "#numbers", label: "Numbers" },
                ...(e.handles ? [{ href: "#ae", label: "Handles" }] : []),
                { href: "#when", label: "Use and avoid" },
              ]}
            />
          </header>

          <section className="ez-sec" aria-labelledby="demo">
            <h2 id="demo">Demo</h2>
            <Lab current={e.slug} variants={variantsOf(e)} />
            {e.kind === "vawe" ? (
              <figure className="panel ez-clip">
                <div className="ez-stage">
                  <img src={`/easing/${e.slug}.webp`} alt="" width={640} height={360} loading="lazy" decoding="async" />
                  <Clip src={`/easing/${e.slug}.mp4`} />
                </div>
                <figcaption className="ez-cap">2&nbsp;s film from the vawe renderer: {e.name} against linear.</figcaption>
              </figure>
            ) : null}
          </section>

          <section className="ez-sec" aria-labelledby="code">
            <h2 id="code">Code</h2>
            <div className="ez-codes">
              <Code label="css linear() (exact)" text={`animation-timing-function: ${e.linear};`} />
              <BezierBlock e={e} />
              <Code label="web animations api" text={waapi(e)} />
              <Code label={e.kind === "css" ? "css" : "vawe"} text={importLine(e)} />
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
          </section>

          <Handles e={e} />

          <section className="ez-sec" aria-labelledby="when">
            <h2 id="when">Use and avoid</h2>
            <div className="ez-two">
              <div className="panel">
                <h3>Use for</h3>
                <ul>{e.use.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
              <div className="panel">
                <h3>Avoid for</h3>
                <ul>{e.avoid.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            </div>
            {e.jobs?.length ? (
              <div className="ez-scroll">
                <table className="ez-table ez-stack">
                  <caption>Jobs for {e.name}, from <Link href="/easing#jobs">the job table</Link></caption>
                  <thead>
                    <tr><th>Job</th><th>Duration</th></tr>
                  </thead>
                  <tbody>
                    {e.jobs.map((j) => (
                      <tr key={j.id}>
                        <td data-label="Job">{j.job}</td>
                        <td data-label="Duration" className="n">{j.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          {e.nearestVawe ? (
            <section className="ez-sec" aria-labelledby="vawe-near">
              <h2 id="vawe-near">Nearest vawe ease</h2>
              <p>
                <Link href={`/easing/${e.nearestVawe.slug}`}>{e.nearestVawe.name}</Link>, curve gap {e.nearestVawe.gap}.
              </p>
            </section>
          ) : null}

          <section className="ez-sec" aria-labelledby="related">
            <h2 id="related">Related eases</h2>
            <ul className="ez-rel">
              {e.related.map((r) => (
                <li key={r.slug} className="panel">
                  <Link href={`/easing/${r.slug}`} prefetch={false}>{r.name}</Link>
                  <span className="meta">curve gap {r.gap}</span>
                  <a className="ez-cmp" href={`/easing?compare=${e.slug},${r.slug}#compare`}>Compare with {e.name}</a>
                </li>
              ))}
            </ul>
          </section>

          {e.moves?.length ? (
            <section className="ez-sec" aria-labelledby="moves">
              <h2 id="moves">Video components that use {e.name}</h2>
              <p>{e.moves.length} video components set <code>EASE.{camelOf(e.slug)}</code>. The first four play here.</p>
              <MoveClips names={e.moves.slice(0, 4).map((m) => m.name)} />
              <ul className="ez-moves">
                {e.moves.slice(0, 12).map((m) => (
                  <li key={m.name}><Link href={`/video-components/${m.name}`} prefetch={false}>{m.title}</Link></li>
                ))}
              </ul>
              {e.moves.length > 12 ? (
                <details className="ez-more">
                  <summary>Show the other {e.moves.length - 12}</summary>
                  <ul className="ez-moves">
                    {e.moves.slice(12).map((m) => (
                      <li key={m.name}><Link href={`/video-components/${m.name}`} prefetch={false}>{m.title}</Link></li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>
          ) : null}
          <Next
            title="More easing"
            primary={{ href: "/easing", label: "All easing functions" }}
            secondary={{ href: "/video-components", label: "See the video components" }}
            related={[{ href: "/springs", label: "Spring presets" }, { href: "/blog/easing", label: "The rules of easing for motion video" }, { href: "/docs/motion", label: "Motion in the docs" }]}
          />
          <CopyCode rootId="ez-main" />
        </article>
      </main>
      <Footer active="/easing" />
    </div>
  );
}
