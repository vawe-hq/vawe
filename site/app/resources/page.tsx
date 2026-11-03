import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { GithubMark, Icon } from "../components/Icon";
import { pageMetadata } from "../components/seo";
import { PageTop, Toc } from "../components/Xp";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { RESOURCES, resourceGroups, type Item } from "../../lib/content/resources";
import { llmsFull, llmsText } from "../../lib/llms";
import { renderMarkdown } from "../../lib/md/registry";
import "../components/study.css";
import "../components/intent.css";
import "./resources.css";

export const revalidate = 3600;

export const metadata = pageMetadata({ ...RESOURCES.meta, path: RESOURCES.path });

function RowIcon({ name }: { name: Item["icon"] }) {
  return <span className="rs-ico">{name === "github" ? <GithubMark size={16} /> : <Icon name={name} size={16} />}</span>;
}

function Row({ i }: { i: Item }) {
  return (
    <a className="rs-row" href={i.href}>
      <RowIcon name={i.icon} />
      <span className="rs-body">
        <span className={i.code ? "rs-title is-code" : "rs-title"}>{i.title}</span>
        <span className="rs-line">{i.line}</span>
      </span>
      {i.meta ? <span className="rs-meta">{i.meta}</span> : null}
      <span className="arw" aria-hidden="true">
        <Icon name={i.external ? "external" : "arrow"} size={16} />
      </span>
    </a>
  );
}

function TileArt({ id }: { id: string }) {
  return <img src={`/resources/tiles/${id}.webp`} alt="" width={960} height={600} loading="lazy" decoding="async" />;
}

function ToolCard({ i }: { i: Item }) {
  return (
    <a className="rs-card" href={i.href}>
      <span className="rs-art">
        <TileArt id={i.tile!} />
      </span>
      <span className="rs-card-body">
        <RowIcon name={i.icon} />
        <span className="rs-body">
          <span className="rs-title">{i.title}</span>
          <span className="rs-line">{i.line}</span>
        </span>
        <span className="rs-meta">{i.meta}</span>
        <span className="arw" aria-hidden="true">
          <Icon name="arrow" size={16} />
        </span>
      </span>
    </a>
  );
}

const bytes = (text: string) => Buffer.byteLength(text);

export default async function Resources() {
  const GROUPS = resourceGroups({
    llms: bytes(await llmsText()),
    llmsFull: bytes(await llmsFull()),
    agents: bytes(renderMarkdown("/ai-agents")?.text ?? ""),
  });
  const COUNT = GROUPS.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="shell">
      <Header active="resources" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema([{ name: "vawe", url: "/" }, { name: RESOURCES.crumb.current, url: RESOURCES.path }]))}
      />
      <div className="wrap">
        <main id="content" className="ipage xp" tabIndex={-1}>
          <section className="phead">
            <PageTop current={RESOURCES.crumb.current} />
            <h1>{RESOURCES.h1}</h1>
            <p>{RESOURCES.lede(COUNT)}</p>
            <Toc items={GROUPS.map((g) => ({ href: `#${g.id}`, label: g.title }))} label={RESOURCES.tocLabel} />
          </section>

          {GROUPS.map((g) => (
            <section className={g.tile ? "rs-group has-tile" : "rs-group"} id={g.id} key={g.id}>
              {g.tile ? (
                <div className="rs-aside">
                  <TileArt id={g.tile} />
                </div>
              ) : null}
              <div className="rs-main">
                <h2>{g.title}</h2>
                {g.lead ? <p>{g.lead}</p> : null}
                {g.items[0].tile ? (
                  <ul className="rs-cards">
                    {g.items.map((i) => (
                      <li key={i.href}>
                        <ToolCard i={i} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="rs-list">
                    {g.items.map((i) => (
                      <li key={i.href}>
                        <Row i={i} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </main>
      </div>
      <Footer active={RESOURCES.path} />
    </div>
  );
}
