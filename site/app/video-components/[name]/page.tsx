import { smartHtml } from "../../../lib/typo.mjs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { MovePlayer } from "../MovePlayer";
import { pageMetadata } from "../../components/seo";
import { MOVES, NUMBERED, clip, groupLabel, moveByName, type Ease, type Move } from "../../../lib/moves";
import { groupPath } from "../../../lib/content/move-groups";
import { moveAlt } from "../../../lib/move-words";
import { moreInGroup, moveSeoDescription, moveSeoTitle, relatedMoves } from "../../../lib/move-seo";
import { jsonLdScript } from "../../../lib/schema";
import { moveBreadcrumbSchema, techArticleSchema, videoObjectSchema } from "../../../lib/schema-content";
import { CopyCode, CopyMarkdown } from "./CopyCode";
import { GroupIcon, MiscSvg } from "../icons";
import { Next, Toc } from "../../components/Xp";
import { videoTypesUsing } from "../../../lib/content/video-types";
import "../moves.css";

type Params = { params: Promise<{ name: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return MOVES.map((m) => ({ name: m.name }));
}

export async function generateMetadata({ params }: Params) {
  const move = moveByName((await params).name);
  if (!move) return {};
  return pageMetadata({
    title: moveSeoTitle(move),
    description: moveSeoDescription(move),
    path: `/video-components/${move.name}`,
    type: "article",
  });
}

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const handle = (h: Ease["out"]) => `${h.influence}% influence, speed ${h.speed}`;

function easeTable(eases: Ease[]) {
  if (!eases.length) return "";
  const rows = eases
    .map((e) => `<tr><th scope="row"><a href="/easing/${kebab(e.name)}"><code>${e.name}</code></a></th><td>${handle(e.out)}</td><td>${handle(e.into)}</td></tr>`)
    .join("");
  return [
    `<p>Each ease is a pair of After Effects handles from <code>core/motion/presets.js</code>. <a href="/easing">Every curve as CSS</a>.</p>`,
    `<div class="mvd-table"><table><thead><tr><th scope="col">Ease</th><th scope="col">Leaving a key</th><th scope="col">Arriving at a key</th></tr></thead><tbody>${rows}</tbody></table></div>`,
  ].join("\n");
}

function docHtml(m: Move) {
  const parts = [
    `<h2 id="when-to-use">When to use</h2>`,
    m.useHtml,
    `<h2 id="the-code">The code</h2>`,
    m.codeHtml,
    m.eases.length ? `<h2 id="easing">Easing</h2>\n${easeTable(m.eases)}` : "",
    m.notesHtml ? `<h2 id="notes">Notes</h2>\n${m.notesHtml}` : "",
    m.soundHtml ? `<h2 id="sound">Sound</h2>\n${m.soundHtml}` : "",
  ];
  return smartHtml(parts.filter(Boolean).join("\n"));
}

const two = (n: number) => String(n).padStart(2, "0");

function PnLink({ m, n, dir }: { m: Move; n: number; dir: "prev" | "next" }) {
  return (
    <Link href={`/video-components/${m.name}`} prefetch={false} rel={dir} data-dir={dir}>
      {m.clipHash ? <img src={clip(m).poster} alt="" width={160} height={90} loading="lazy" decoding="async" /> : <span className="mvd-pn-ph" />}
      <span className="mvd-pn-t">
        <span className="meta">{dir === "prev" ? <MiscSvg name="prev" size={12} /> : null}{two(n)}{dir === "next" ? <MiscSvg name="next" size={12} /> : null}</span>
        {m.title}
      </span>
    </Link>
  );
}

export default async function MovePage({ params }: Params) {
  const move = moveByName((await params).name);
  if (!move) notFound();
  const files = clip(move);
  const related = relatedMoves(move);
  const more = moreInGroup(move);
  const at = NUMBERED.findIndex((m) => m.name === move.name);
  const prev = NUMBERED[at - 1];
  const next = NUMBERED[at + 1];

  return (
    <div className="shell">
      {move.clipHash ? <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(videoObjectSchema(move))} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(techArticleSchema(move))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(moveBreadcrumbSchema(move))} />
      <Header active="video-components" />
      <main className="wrap" id="content" tabIndex={-1}>
        <article className="mvd">
          <header className="phead mvd-head">
            <p className="kicker">
              <Link href="/video-components">Video components</Link>
              <span aria-hidden="true">/</span>
              <Link href={groupPath(move.group)}>{groupLabel(move.group)}</Link>
            </p>
            <h1>
              <span className="mvd-no" aria-hidden="true">{two(at + 1)}</span>
              {move.title}
            </h1>
            {move.use ? <p className="mvd-use">{/[.!?]$/.test(move.use) ? move.use : `${move.use}.`}</p> : null}
            <p className="mvd-meta">
              <span className="mv-pill"><GroupIcon id={move.group} size={14} />{groupLabel(move.group)}</span>
              <span className="mv-pill">{move.look}</span>
              {move.duration ? <span className="mv-pill mv-pill-mono"><MiscSvg name="clock" size={14} />{move.duration} s</span> : null}
            </p>
            <p className="mvd-actions">
              <CopyMarkdown href={files.md} />
              <a className="mvd-raw" href={files.md} type="text/markdown">
                <MiscSvg name="file" size={14} />
                {move.name}.md
              </a>
            </p>
          </header>

          <figure className="mvd-clip panel">
            {move.clipHash ? (
              <MovePlayer move={move} alt={moveAlt(move)} duration={move.duration} />
            ) : (
              <div className="mvd-stage">
                <p className="meta mv-soon">Clip coming</p>
              </div>
            )}
            {move.clipHash ? <figcaption className="mvd-tap meta">Tap the clip to play it.</figcaption> : null}
          </figure>

          <Toc
            label="On this page"
            items={[
              { href: "#when-to-use", label: "When to use" },
              { href: "#the-code", label: "The code" },
              ...(move.eases.length ? [{ href: "#easing", label: "Easing" }] : []),
              ...(move.notesHtml ? [{ href: "#notes", label: "Notes" }] : []),
              ...(move.soundHtml ? [{ href: "#sound", label: "Sound" }] : []),
            ]}
          />

          <div className="mvd-doc" id="move-doc" dangerouslySetInnerHTML={{ __html: docHtml(move) }} />
          <CopyCode rootId="move-doc" />

          <nav className="mvd-pn" aria-label="Previous and next component">
            {prev ? <PnLink m={prev} n={at} dir="prev" /> : <span />}
            {next ? <PnLink m={next} n={at + 2} dir="next" /> : null}
          </nav>

          <section className="mvd-related" aria-labelledby="related">
            <h2 id="related">Related components</h2>
            <ul className="mvd-rel">
              {related.map((m) => (
                <li key={m.name} className="panel">
                  {m.clipHash ? (
                    <img src={clip(m).poster} alt={moveAlt(m)} width={640} height={360} loading="lazy" decoding="async" />
                  ) : (
                    <p className="meta mv-soon-rel">Clip coming</p>
                  )}
                  <Link href={`/video-components/${m.name}`} prefetch={false}>{m.title}</Link>
                </li>
              ))}
            </ul>
            {more.length ? (
              <>
                <h3 className="mvd-more-h">More in <Link href={groupPath(move.group)}>{groupLabel(move.group)}</Link></h3>
                <ul className="mvd-more">
                  {more.slice(0, 8).map((m) => (
                    <li key={m.name}><Link href={`/video-components/${m.name}`} prefetch={false}>{m.title}</Link></li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <Next
            title="Chain it into a film."
            lead="Copy chains of video components from the recipes."
            primary={{ href: "/docs/recipes", label: "Open the recipes" }}
            secondary={{ href: "/video-components", label: `All ${MOVES.length} video components` }}
            related={[
              { href: "/docs", label: "How a page becomes a film, in the docs" },
              { href: "/docs/motion", label: "The motion guide" },
              { href: "/blog/render-html-to-mp4", label: "Render a page like this to MP4" },
              ...(move.group === "change-between-shots" ? [{ href: "/blog/transitions", label: "The 12 types of transition" }] : []),
              ...videoTypesUsing(move.name),
            ]}
          />
        </article>
      </main>
      <Footer />
    </div>
  );
}
