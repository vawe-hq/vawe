import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../../components/Header";
import { Footer } from "../../../components/Footer";
import { pageMetadata } from "../../../components/seo";
import { jsonLdScript, breadcrumbSchema } from "../../../../lib/schema";
import { JOB_SLUGS, jobArticleSchema, jobPageBySlug, jobPages, UI_SOURCE } from "../../../../lib/easing-jobs";
import { CopyCode } from "../../../video-components/[name]/CopyCode";
import { MoveClips } from "../../../components/MoveClips";
import { Next, Toc } from "../../../components/Xp";
import { moveByName } from "../../../../lib/moves";
import { CurveChart } from "../../Charts";
import { Code } from "../../Code";
import { CopyBtn } from "../../CopyBtn";
import { JobDemo } from "../JobDemo";
import "../../../video-components/moves.css";
import "../../../components/intent.css";
import "../../easing.css";
import "../jobs.css";

type Params = { params: Promise<{ job: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return JOB_SLUGS.map((job) => ({ job }));
}

export async function generateMetadata({ params }: Params) {
  const p = jobPageBySlug((await params).job);
  if (!p) return {};
  return pageMetadata({ title: p.title, description: p.description, path: p.path });
}

const ROWS = 4;

export default async function JobPage({ params }: Params) {
  const slug = (await params).job;
  const p = jobPageBySlug(slug);
  if (!p) notFound();
  const crumbs = [{ name: "Home", url: "/" }, { name: "Easing", url: "/easing" }, { name: "By job", url: "/easing#jobs" }, { name: p.job, url: p.path }];
  const gap = p.kind === "stagger" ? Number(/(\d+) ms apart/.exec(p.preset[0].value)?.[1]) : 0;
  const vars: Record<string, string> = {
    ...(p.rise ? { "--rise": p.rise } : {}),
    ...(p.kind === "roll" ? { "--out-ms": `${/(\d+) ms out/.exec(p.preset[0].value)![1]}ms` } : {}),
    ...(p.kind === "stream" ? { "--fade": "200ms", "--tint": "500ms" } : {}),
  };
  const cycle = p.kind === "stagger" ? p.ms + gap * (ROWS - 1) : p.ms;
  const moves = p.moveNames.filter((n) => moveByName(n));
  const others = jobPages();
  const copyText = p.ease ? (p.ease.bezier.express === "exact" || p.ease.kind === "vawe" ? `cubic-bezier(${p.ease.bezier.params.join(", ")})` : p.ease.linear) : "";
  const camel = p.ease ? p.ease.slug.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) : "";

  return (
    <div className="shell">
      <Header active="resources" />
      <main className="wrap" id="content" tabIndex={-1}>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jobArticleSchema(p))} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema(crumbs))} />
        <article className="ez" id="ez-main">
          <header className="phead ez-head">
            <p className="kicker">
              <Link href="/easing">Easing</Link>
              <span aria-hidden="true">/</span>
              <Link href="/easing#jobs">By job</Link>
            </p>
            <h1>{p.h1}</h1>
            <p className="ez-sum">{p.answer}</p>
            {copyText ? (
              <div className="ez-quick" role="group" aria-label="Copy a format">
                <CopyBtn value={copyText} label={copyText.startsWith("cubic") ? "Copy cubic-bezier" : "Copy linear()"} />
                {p.ease ? <CopyBtn value={p.ease.linear} label="Copy linear()" /> : null}
              </div>
            ) : null}
            <Toc
              label="On this page"
              items={[
                { href: "#demo", label: "Demo" },
                { href: "#ease", label: p.ease ? "Ease and duration" : "Duration" },
                ...(p.avoid ? [{ href: "#avoid", label: "Avoid" }] : []),
                { href: "#code", label: "Code" },
                ...(p.preset.length ? [{ href: "#measured", label: "Measured" }] : []),
                ...(moves.length ? [{ href: "#moves", label: "Video components" }] : []),
              ]}
            />
          </header>

          <section className="ez-sec" aria-labelledby="demo">
            <h2 id="demo">Demo</h2>
            <JobDemo kind={p.kind} lanes={p.lanes} ms={p.ms} cycleMs={cycle} chunks={p.chunks} stagger={gap} vars={vars} />
            <p className="ez-note">
              {p.ease ? `The same move with ${p.ease.name} and with linear.` : p.kind === "bubble" ? "The spring, then linear for comparison." : "Built from the measured numbers below."} If your system asks for reduced motion, nothing plays and the final state shows.
            </p>
          </section>

          <section className="ez-sec" aria-labelledby="ease">
            <h2 id="ease">{p.ease ? "Ease and duration" : "Duration"}</h2>
            <dl className="ej-facts">
              {p.ease ? (
                <div className="panel">
                  <dt>Ease</dt>
                  <dd>
                    <Link href={`/easing/${p.ease.slug}`}>{p.ease.name}</Link>
                    {p.also.map((a) => <span key={a.slug}>, <Link href={`/easing/${a.slug}`}>{a.name}</Link></span>)}
                    <small>peak speed {p.ease.peakSpeed > 20 ? "over 20" : p.ease.peakSpeed}x the average</small>
                  </dd>
                </div>
              ) : null}
              <div className="panel">
                <dt>Duration</dt>
                <dd>{p.time}</dd>
              </div>
              {p.ease ? (
                <div className="panel">
                  <dt>Halfway at</dt>
                  <dd>{Math.round(p.ease.t50 * 100)}% of the time<small>90% of the travel at {Math.round(p.ease.t90 * 100)}%</small></dd>
                </div>
              ) : null}
            </dl>
            {p.ease ? (
              <figure className="panel ez-chart ej-curve">
                <CurveChart e={p.ease} w={400} h={190} />
                <figcaption className="ez-cap">{p.ease.name}: progress against time. Dashed is linear.</figcaption>
              </figure>
            ) : null}
            {p.kind === "bubble" ? <p className="ez-note">A spring has no cubic-bezier form, so the linear() string follows it. For an item that moves more than 20 px, see <Link href="/easing/for/notification-pop">the pop page</Link>.</p> : null}
          </section>

          {p.avoid ? (
            <section className="ez-sec" aria-labelledby="avoid">
              <h2 id="avoid">What to avoid</h2>
              <p>{p.avoid}</p>
            </section>
          ) : null}

          <section className="ez-sec" aria-labelledby="code">
            <h2 id="code">Code</h2>
            <div className="ez-codes">
              {p.css ? <Code label="css" text={p.css} /> : null}
              {p.waapi ? <Code label="web animations api" text={p.waapi} /> : null}
              {p.ease ? <Code label="css linear() (exact)" text={`animation-timing-function: ${p.ease.linear};`} /> : null}
              {p.ease ? <Code label="vawe" text={`import { EASE } from '../../core/motion/presets.js';\n\nel.animate(keyframes, { duration: ${p.ms}, easing: EASE.${camel}, fill: 'both' });`} /> : null}
              {p.kind === "bubble" ? <Code label="vawe" text={"import { UI } from '../../core/motion/presets.js';\n\n// UI.send: { k: 500, d: 25 }"} /> : null}
              {p.kind === "typing" ? <Code label="vawe" text={"import { UI } from '../../core/motion/presets.js';\n\n// UI.typing: charMs 30, spaceMs 70, jitter 0.25 (seed it with rng)"} /> : null}
              {p.kind === "stream" ? <Code label="vawe" text={"import { UI } from '../../core/motion/presets.js';\n\n// UI.stream: gapMs [55, 110], fadeMs 200, tintMs 500"} /> : null}
            </div>
          </section>

          {p.preset.length ? (
            <section className="ez-sec" aria-labelledby="measured">
              <h2 id="measured">Measured source</h2>
              <p>{UI_SOURCE} The numbers live in <code>UI</code>, imported from <code>core/motion/presets.js</code>.</p>
              <div className="ez-scroll">
                <table className="ez-table ez-stack">
                  <thead><tr><th>Preset</th><th>Value</th><th>Measured</th></tr></thead>
                  <tbody>
                    {p.preset.map((r) => (
                      <tr key={r.label}>
                        <td data-label="Preset">{r.label}</td>
                        <td data-label="Value" className="n">{r.value}</td>
                        <td data-label="Measured">{r.measured}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {moves.length ? (
            <section className="ez-sec" aria-labelledby="moves">
              <h2 id="moves">{p.moveHeading}</h2>
              <MoveClips names={moves.slice(0, 4)} />
              {moves.length > 4 ? (
                <ul className="ez-moves">
                  {moves.slice(4).map((n) => <li key={n}><Link href={`/video-components/${n}`} prefetch={false}>{moveByName(n)!.title}</Link></li>)}
                </ul>
              ) : null}
            </section>
          ) : null}

          <section className="ez-sec" aria-labelledby="others">
            <h2 id="others">Other jobs</h2>
            <ul className="ej-list">
              {others.map((o) => (
                <li key={o.slug}><Link href={o.path} prefetch={false} aria-current={o.slug === p.slug ? "page" : undefined}>{o.job}</Link></li>
              ))}
            </ul>
          </section>

          <Next
            title="More easing"
            primary={{ href: "/easing", label: "All easing functions" }}
            secondary={{ href: "/video-components", label: "See the video components" }}
            related={[{ href: "/docs/motion", label: "Motion in the docs" }]}
          />
          <CopyCode rootId="ez-main" />
        </article>
      </main>
      <Footer active="/easing" />
    </div>
  );
}
