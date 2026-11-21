import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { Clip } from "../../components/Clip";
import { Next } from "../../components/Xp";
import { pageMetadata } from "../../components/seo";
import { TEMPLATES, categoryLabel, checkoutUrl, newCommand, slotCommand, templateById, templateFiles, templateSource } from "../../../lib/templates";
import { jsonLdScript } from "../../../lib/schema";
import { templateBreadcrumbSchema, templateSchema } from "../../../lib/schema-content";
import { MiscSvg } from "../../video-components/icons";
import { CopyCommand } from "../CopyCommand";
import "../../video-components/moves.css";
import "../templates.css";

type Params = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: Params) {
  const t = templateById((await params).id);
  if (!t) return {};
  return pageMetadata({
    title: `${t.title}: a ${t.tier === "pro" ? "Pro " : "free "}video template | vawe`,
    description: t.summary,
    path: `/templates/${t.id}`,
    type: "article",
  });
}

export default async function TemplatePage({ params }: Params) {
  const t = templateById((await params).id);
  if (!t) notFound();
  const files = templateFiles(t);
  const pro = t.tier === "pro";

  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(templateSchema(t))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(templateBreadcrumbSchema(t))} />
      <Header active="templates" />
      <main className="wrap" id="content" tabIndex={-1}>
        <article className="mvd">
          <header className="phead mvd-head">
            <p className="kicker">
              <Link href="/templates">Templates</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/templates?category=${t.category}`}>{categoryLabel(t.category)}</Link>
            </p>
            <h1>{t.title}</h1>
            <p className="mvd-use">{t.summary}</p>
            <p className="mvd-meta">
              <span className="mv-pill">{pro ? "Pro" : "Free"}</span>
              <span className="mv-pill">{categoryLabel(t.category)}</span>
              <span className="mv-pill mv-pill-mono"><MiscSvg name="clock" size={14} />{t.length} s</span>
              <span className="mv-pill mv-pill-mono">{t.aspect}</span>
            </p>
          </header>

          <figure className="mvd-clip panel">
            <div className="mvd-stage">
              <img src={files.poster} alt={`${t.title}: a frame from the template`} width={1280} height={720} fetchPriority="high" decoding="async" />
              <Clip src={files.mp4} poster={files.poster} label={`${t.title} preview`} />
            </div>
          </figure>

          <h2 className="tpl-h">What happens</h2>
          <p className="tpl-p">{t.structure}</p>

          {t.inputs.length ? (
            <>
              <h2 className="tpl-h">What you change</h2>
              <div className="tpl-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Text</th>
                      <th scope="col">Default</th>
                      <th scope="col">Where</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.inputs.map((i) => (
                      <tr key={i.key}>
                        <th scope="row">{i.label}</th>
                        <td><code>{i.default}</code></td>
                        <td><code>{i.where}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {t.slots.length ? (
            <>
              <h2 className="tpl-h">Media slots</h2>
              <p className="tpl-p">Swap your own pictures and clips in with <code>--slot</code>. vawe resizes each one to the slot size and crops from the centre.</p>
              <div className="tpl-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Slot</th>
                      <th scope="col">Type</th>
                      <th scope="col">Size</th>
                      <th scope="col">Where</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.slots.map((s) => (
                      <tr key={s.key}>
                        <th scope="row">{s.label} <code>{s.key}</code></th>
                        <td>{s.kind === "video" ? `Video${s.span ? `, ${s.span} s` : ""}` : "Image"}</td>
                        <td><code>{s.size}</code></td>
                        <td>{s.where}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CopyCommand command={`${slotCommand(t.id, t.slots)}${pro ? " --key <your-key>" : ""}`} />
            </>
          ) : null}

          <h2 className="tpl-h">{pro ? "Get it" : "Use it"}</h2>
          {pro ? (
            <>
              <p className="tpl-p">Buy the template to get a license key. Then run the command with your key.</p>
              <div className="tpl-buy">
                <a className="btn btn-primary" href={checkoutUrl()}>Get vawe Pro <span className="arw">→</span></a>
              </div>
              <CopyCommand command={`${newCommand(t.id)} --key <your-key>`} />
            </>
          ) : (
            <>
              <p className="tpl-p">Run one command. It copies the page and its assets into <code>films/my-film</code>.</p>
              <CopyCommand command={newCommand(t.id)} />
              <details className="tpl-src">
                <summary>page.html</summary>
                <pre><code>{templateSource(t.id)}</code></pre>
              </details>
            </>
          )}

          <Next
            title="Make it yours."
            lead="Change the words, then render it."
            primary={{ href: "/docs", label: "Read the docs" }}
            secondary={{ href: "/templates", label: `All ${TEMPLATES.length} templates` }}
            related={[
              { href: "/video-components", label: "The video components inside a template" },
              { href: "/marketplace", label: "Templates by other motion designers" },
              { href: "/ai-agents", label: "Let an agent remix a template" },
            ]}
          />
        </article>
      </main>
      <Footer />
    </div>
  );
}
