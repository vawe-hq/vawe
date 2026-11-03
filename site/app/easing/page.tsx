import type { CSSProperties } from "react";
import Link from "next/link";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { CSS, EASES, EASING_DESCRIPTION, EASING_TITLE, FAMILIES, JOBS, PRODUCT_UI, STATS, VAWE, classicIn, copyIsBezier, copyValue, itemListSchema, jobIdsOf, roleOf, speedText, type Ease } from "../../lib/easing";
import { jobPages } from "../../lib/easing-jobs";
import { Thumb } from "./Charts";
import { Finder } from "./Finder";
import { SpacingChart, ghostValues } from "./Spacing";
import { Next } from "../components/Xp";
import "./easing.css";

export const metadata = pageMetadata({
  title: EASING_TITLE,
  description: EASING_DESCRIPTION,
  path: "/easing",
});

const FAMILY_NOTE: Record<string, string> = {
  sine: "gentlest",
  quad: "mild",
  cubic: "common default",
  quart: "strong",
  quint: "very strong",
  expo: "extreme",
  circ: "wall-like stop",
  back: "passes or pulls past its ends",
  elastic: "rings around the end value",
  bounce: "rebounds off the end value",
};

const num = (n: number) => n.toLocaleString("en-US");
const pct = (u: number) => `${Math.round(u * 100)}%`;

const CARD_GHOSTS = 13;

function Card({ e }: { e: Ease }) {
  const ghosts = ghostValues(e.y, CARD_GHOSTS);
  const bezier = copyIsBezier(e);
  const close = e.kind === "classic" && e.bezier.express === "close";
  return (
    <li
      className="panel ez-card"
      data-ez-card
      data-slug={e.slug}
      data-name={e.name}
      data-jobs={jobIdsOf(e.slug).join(" ")}
      data-sp={ghosts.map((g) => g.toFixed(3)).join(",")}
      data-search={`${e.name} ${e.slug} ${e.family} ${roleOf(e)} ${(e.jobs ?? []).map((j) => j.job).join(" ")}`.toLowerCase()}
      style={{ "--ez": copyValue(e) } as CSSProperties}
    >
      <div className="ez-thumbwrap">
        <Thumb e={e} />
      </div>
      <SpacingChart values={ghosts} label={`${e.name} at ${CARD_GHOSTS} equal time steps`} />
      <Link href={`/easing/${e.slug}`} prefetch={false}>{e.name}</Link>
      <p className="ez-blurb">{e.blurb}</p>
      <span className="meta">50% at {pct(e.t50)} / peak {speedText(e).replace(" (it ends vertically)", "").replace("over ", ">")}</span>
      <div className="ez-card-act">
        <button type="button" className="ez-copy" data-label={bezier ? "Copy bezier" : "Copy linear()"} title={close ? `Nearest cubic-bezier fit, worst gap ${((e.bezier.worst ?? 0) * 100).toFixed(1)} points` : undefined}>{bezier ? "Copy bezier" : "Copy linear()"}</button>
        <button type="button" className="ez-pick" aria-pressed="false">Compare</button>
      </div>
    </li>
  );
}

const inBand = (share: number) => share >= PRODUCT_UI.realFirstFrame[0] && share <= PRODUCT_UI.realFirstFrame[1];

function ProductUi() {
  const [lo, hi] = PRODUCT_UI.realFirstFrame;
  const { firstFrame, approach, window: win } = PRODUCT_UI;
  const soft = firstFrame.rows.find((r) => r.slug === "land-soft")!;
  const matches = firstFrame.rows.flatMap((r) => r.shares.flatMap((share, i) => (inBand(share) ? [`${r.name} at ${firstFrame.at[i]}\u00a0s (${share}%)`] : [])));
  return (
    <section className="ez-sec" id="product-ui" aria-labelledby="h-ui">
      <h2 id="h-ui">Product UI</h2>
      <p>
        The numbers of a real product screen, measured on ChatGPT and Vercel Analytics clips at 30&nbsp;fps. They live in <code>UI</code>, imported from <code>core/motion/presets.js</code>.
      </p>
      <div className="ez-scroll">
        <table className="ez-table ez-stack">
          <thead>
            <tr><th>Part</th><th>Value</th><th>Rule</th></tr>
          </thead>
          <tbody>
            {PRODUCT_UI.rows.map((r) => (
              <tr key={r.name}>
                <td data-label="Part">{r.name}</td>
                <td data-label="Value" className="n">{r.value}</td>
                <td data-label="Rule">{r.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="ez-h3 ez-sub">The curve of a real move</h3>
      <p>
        A real surface closes {approach[0].k * 100} to {approach[1].k * 100}% of the remaining distance on every 30&nbsp;fps frame. That is a time constant of {approach[0].tau} to {approach[1].tau}&nbsp;s, 99% settled in {approach[1].settle99} to {approach[0].settle99}&nbsp;s. Over {win}&nbsp;s the nearest ease is{" "}
        <Link href={`/easing/${approach[1].nearest.slug}`} prefetch={false}>{approach[1].nearest.name}</Link> for the fast end and{" "}
        <Link href={`/easing/${approach[0].nearest.slug}`} prefetch={false}>{approach[0].nearest.name}</Link> for the slow end.
      </p>
      <div className="ez-scroll">
        <table className="ez-table ez-first">
          <caption>Share of the travel done in the first frame at 30&nbsp;fps. A real surface covers {lo} to {hi}%.</caption>
          <thead>
            <tr><th>Ease</th>{firstFrame.at.map((d) => <th key={d}>{d}&nbsp;s</th>)}</tr>
          </thead>
          <tbody>
            {firstFrame.rows.map((r) => (
              <tr key={r.slug}>
                <td><Link href={`/easing/${r.slug}`} prefetch={false}>{r.name}</Link></td>
                {r.shares.map((share, i) => <td key={firstFrame.at[i]} className={inBand(share) ? "n ez-hit" : "n"}>{share}%</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ez-note">
        To copy a real surface, pick the ease whose first frame is in that band: {matches.join(", ")}. At {firstFrame.at[0]}&nbsp;s even land-soft starts harder ({soft.shares[0]}%). Keep it there: a hard first frame on every row of a stagger reads as flicker.
      </p>
      <h3 className="ez-h3 ez-sub">Copying a real surface</h3>
      <ul className="ez-rules">
        {PRODUCT_UI.realSurface.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </section>
  );
}

const peakOf = (slug: string) => speedText(VAWE.find((e) => e.slug === slug)!);

export default function EasingIndex() {
  return (
    <div className="shell">
      <Header active="resources" />
      <main className="wrap" id="content" tabIndex={-1}>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(itemListSchema())} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema([{ name: "Home", url: "/" }, { name: "Easing", url: "/easing" }]))} />
        <div className="ez">
          <header className="phead ez-head">
            <h1>Easing functions as CSS</h1>
            <p className="ez-sum">
              {EASES.length} curves. Each card shows the shape at equal time steps: bunched is slow, spread is fast. Copy its <code>cubic-bezier()</code> or <code>linear()</code>, or compare up to three side by side. Open one for the exact <code>linear()</code>, the Web Animations line and the numbers.
            </p>
          </header>

          <nav className="ez-jump" aria-label="On this page">
            <a href="#jobs">Pick by job</a>
            <a href="#all">All curves</a>
            <a href="#product-ui">Product UI</a>
          </nav>

          <section className="ez-sec" id="jobs" aria-labelledby="h-jobs">
            <h2 id="h-jobs">Pick by job</h2>
            <p>Find the job, take the ease and the duration. Durations come from the speed bands, the stagger and exit limits and the product UI numbers in <code>core/motion</code>.</p>
            <p className="ez-note">
              The house exit is <Link href="/easing/launch" prefetch={false}>launch</Link>: it speeds up as it leaves (peak {peakOf("launch")}). <Link href="/easing/leave" prefetch={false}>leave</Link> slows into its end (peak {peakOf("leave")}), for a settle or a hand-off the page names. <Link href="/easing/carry" prefetch={false}>carry</Link> is not an exit: it ends still moving fast (peak {peakOf("carry")}), so the next move takes over its speed.
            </p>
            <div className="ez-scroll">
              <table className="ez-table ez-stack">
                <thead>
                  <tr><th>Job</th><th>Ease</th><th>Duration</th><th>Avoid</th></tr>
                </thead>
                <tbody>
                  {JOBS.map((j) => (
                    <tr key={j.id}>
                      <td data-label="Job">{j.job}</td>
                      <td data-label="Ease">
                        <span>
                          <Link href={`/easing/${j.ease}`} prefetch={false}>{j.easeName}</Link>
                          {j.also.map((a) => <span key={a.slug}>, <Link href={`/easing/${a.slug}`} prefetch={false}>{a.name}</Link></span>)}
                        </span>
                      </td>
                      <td data-label="Duration" className="n">{j.time}</td>
                      <td data-label="Avoid">{j.avoid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="meta ez-h3" id="job-pages">One page per job</h3>
            <p>Each page has the ease, the duration, a live demo, what to avoid, and the CSS and Web Animations to copy.</p>
            <ul className="ez-moves">
              {jobPages().map((p) => <li key={p.slug}><Link href={p.path} prefetch={false}>{p.job}</Link></li>)}
            </ul>
          </section>

          <h2 id="all" className="ez-all">All curves</h2>
          <Finder total={EASES.length} jobs={JOBS.map(({ id, job }) => ({ id, job }))}>
            <section className="ez-group" id="vawe" aria-labelledby="g-vawe" data-ez-group>
              <h2 id="g-vawe">vawe After Effects eases</h2>
              <p>{VAWE.length} eases named by their After Effects handles. In a page: <code>EASE.land</code>.</p>
              <ul className="ez-grid-cards">{VAWE.map((e) => <Card key={e.slug} e={e} />)}</ul>
            </section>

            <section className="ez-group" id="css" aria-labelledby="g-css" data-ez-group>
              <h2 id="g-css">CSS keywords</h2>
              <ul className="ez-grid-cards">{CSS.map((e) => <Card key={e.slug} e={e} />)}</ul>
            </section>

            <section className="ez-group" id="classic" aria-labelledby="g-classic" data-ez-group>
              <h2 id="g-classic">Classic eases by family</h2>
              <p>The 30 Penner easings from easings.net. Elastic and bounce have no <code>cubic-bezier()</code> form, so they copy as <code>linear()</code>.</p>
              <p className="ez-fam">{FAMILIES.map((f) => <a key={f} href={`#f-${f}`}>{f}</a>)}</p>
              {FAMILIES.map((f) => (
                <div key={f} id={`f-${f}`} className="ez-group ez-group-tight" data-ez-group>
                  <h3 className="meta ez-h3">{f}: {FAMILY_NOTE[f]}</h3>
                  <ul className="ez-grid-cards">{classicIn(f).map((e) => <Card key={e.slug} e={e} />)}</ul>
                </div>
              ))}
            </section>
          </Finder>

          <ProductUi />

          <details className="panel ez-why">
            <summary>How the vawe eases were chosen</summary>
            <p>
              A <code>cubic-bezier()</code> is four numbers. An After Effects keyframe has two handles. <strong>Influence</strong> is how far along the segment the handle reaches, in per cent of its duration. <strong>Speed</strong> is the pace at the key, as a multiple of the segment’s average.
            </p>
            <p>
              Each of the {VAWE.length} vawe eases is two handles. Most match handle pairs found in {num(STATS.lottieSegments)} Lottie segments and {STATS.hfSegments} HyperFrames segments. Each is exact as a cubic bezier and ships as a <code>linear()</code> string that runs in any browser.
            </p>
            <ul className="ez-facts">
              <li><b>{Math.round(STATS.defaultShare)}%</b><span>of segments keep both handles at an After Effects default, linear or Easy Ease. {num(STATS.tunedSegments)} are tuned.</span></li>
              <li><b>{Math.round(STATS.entranceStopShare)}%</b><span>of the {STATS.entranceSegments} entrances end on a long dead stop (influence 55 or more, speed 0).</span></li>
              <li><b>{STATS.exitsFasterThan15}</b><span>of the {STATS.exitSegments} Lottie exits end faster than 1.5x the average. That data is an outside reference: vawe exits are shorter than the entrance and speed up (<code>launch</code>).</span></li>
              <li><b>{num(STATS.lottieHandles)}</b><span>handles measured, from Apache-2.0 and MIT Lottie sources.</span></li>
            </ul>
          </details>

          <Next
            title="Use an ease in a film"
            primary={{ href: "/video-components", label: "See the video components" }}
            secondary={{ href: "/docs/motion", label: "Motion in the docs" }}
          />
        </div>
      </main>
      <Footer active="/easing" />
    </div>
  );
}
