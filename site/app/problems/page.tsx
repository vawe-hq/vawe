import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { jsonLdScript, techArticleSchema } from "../../lib/schema";
import { Clip } from "../components/Clip";
import { EaseCurve } from "../components/EaseCurve";
import { Icon } from "../components/Icon";
import { PageTop, Toc } from "../components/Xp";
import { NextView, RichText } from "../components/RichText";
import { ROADMAP } from "../../lib/content/roadmap";
import { MOVES, clip } from "../../lib/moves";
import { OPEN, PROBLEMS_PAGE as C, SOLVED, STATUS_LABEL, VISUALS, type Problem } from "../../lib/content/problems";
import "../components/intent.css";
import "../components/study.css";

export const metadata = pageMetadata({ ...C.meta, path: C.path });

function Visual({ id }: { id: number }) {
  const v = VISUALS[id];
  if (!v) return null;
  if (v.kind === "code") return <pre className="prob-code" aria-label="A film is one HTML page">{v.text}</pre>;
  if (v.kind === "curve") return <div className="prob-media prob-curve"><EaseCurve name={v.ease} label={v.alt} /></div>;
  const f = clip(MOVES.find((m) => m.name === v.move) ?? { name: v.move, clipHash: null });
  if (v.kind === "clip")
    return (
      <div className="prob-media" role="img" aria-label={v.alt}>
        <Clip src={f.mp4} webm={f.webm} poster={f.poster} />
      </div>
    );
  return (
    <div className="prob-media">
      <img src={f.poster} alt={v.alt} width={640} height={360} loading="lazy" decoding="async" />
    </div>
  );
}

function ProblemCard({ p }: { p: Problem }) {
  return (
    <li className="prob" id={`p${p.id}`}>
      <div>
        <div className="prob-head">
          <span className="prob-n">{String(p.id).padStart(2, "0")}</span>
          <span className={`chip chip-${p.status}`}><Icon name={p.status} size={13} />{STATUS_LABEL[p.status]}</span>
        </div>
        <h3>{p.title}</h3>
        <dl>
          <div>
            <dt>{C.labels.why}</dt>
            <dd>{p.why}</dd>
          </div>
          <div>
            <dt>{C.labels.stands}</dt>
            <dd>{p.does}</dd>
          </div>
        </dl>
      </div>
      <div className="prob-side">
        <Visual id={p.id} />
        <div className="prob-fig">
          <strong>{p.figure}</strong>
          <span>{p.figureLabel}</span>
        </div>
      </div>
    </li>
  );
}

export default function Problems() {
  return (
    <div className="shell">
      <Header />
      <div className="wrap">
        <main id="content" className="ipage xp" tabIndex={-1}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={jsonLdScript(
              techArticleSchema({
                headline: C.title,
                description: C.meta.description,
                path: C.path,
                datePublished: C.datePublished,
              }),
            )}
          />
          <section className="phead">
            <PageTop group={C.crumb.group} current={C.crumb.current} />
            <h1>{C.h1}</h1>
            <p>{C.lede}</p>
            <p className="bnote"><RichText p={C.note} /></p>
            <Toc label={C.tocLabel} items={C.toc} />
          </section>

          <section className="sgroup" aria-labelledby="solved">
            <h2 id="solved">{C.solved.title}</h2>
            <p>{C.solved.lead}</p>
            <ol className="slist">
              {SOLVED.map((p) => (
                <ProblemCard key={p.id} p={p} />
              ))}
            </ol>
          </section>

          <section className="sgroup" aria-labelledby="open">
            <h2 id="open">{C.open.title}</h2>
            <p>{C.open.lead}</p>
            <ol className="slist" start={SOLVED.length + 1}>
              {OPEN.map((p) => (
                <ProblemCard key={p.id} p={p} />
              ))}
            </ol>
          </section>

          <section className="sgroup" aria-labelledby="roadmap">
            <h2 id="roadmap">{ROADMAP.h1}</h2>
            <p>{ROADMAP.lede}</p>
            <div className="cols">
              {ROADMAP.columns.map((c, n) => (
                <section className="col" key={c.title} data-now={n === 0 || undefined} aria-labelledby={`r-${c.title}`}>
                  <h3 id={`r-${c.title}`}>{c.title}</h3>
                  <p>{c.lead}</p>
                  <ul>
                    {c.items.map((i) => (
                      <li key={i.name}>
                        <strong>{i.name}</strong>
                        <span>{i.note}</span>
                        <a href={`#p${i.problem}`}>Problem {i.problem}</a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>

          <NextView n={C.next} />
        </main>
      </div>
      <Footer active={C.path} />
    </div>
  );
}
