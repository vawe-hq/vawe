import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../../components/Header";
import { Footer } from "../../../components/Footer";
import { pageMetadata } from "../../../components/seo";
import { Next, PageTop } from "../../../components/Xp";
import { GROUPS, MOVES, moveByName } from "../../../../lib/moves";
import { GROUP_PAGES, groupFacts, groupMetaDescription, groupMetaTitle, groupPage, groupPath } from "../../../../lib/content/move-groups";
import { jsonLdScript, breadcrumbSchema } from "../../../../lib/schema";
import { GroupCard } from "../../GroupCard";
import { GroupIcon } from "../../icons";
import "../../moves.css";

type Params = { params: Promise<{ group: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return GROUPS.map((g) => ({ group: g.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = groupPage((await params).group);
  if (!p) return {};
  return pageMetadata({ title: groupMetaTitle(p), description: groupMetaDescription(p), path: groupPath(p.id) });
}

const range = (a: number, b: number) => (a === b ? `${a} s` : `${a} to ${b} s`);

export default async function GroupHub({ params }: Params) {
  const p = groupPage((await params).group);
  if (!p) notFound();
  const facts = groupFacts(p.id);
  const moves = MOVES.filter((m) => m.group === p.id);
  const others = GROUP_PAGES.filter((o) => o.id !== p.id);
  const sibling = (id: string) => GROUPS.find((g) => g.id === id)?.label ?? id;

  return (
    <div className="shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "Video components", url: "/video-components" },
            { name: facts.label, url: groupPath(p.id) },
          ]),
        )}
      />
      <Header active="video-components" />
      <main className="wrap" id="content" tabIndex={-1}>
        <section className="ls ls-top mv">
          <PageTop parent={{ href: "/video-components", label: "Video components" }} current={facts.label} />
          <h1>{p.h1}</h1>
          {p.intro.map((t) => (
            <p key={t} className="mv-intro">{t}</p>
          ))}
          <p className="mvd-meta">
            <span className="mv-pill"><GroupIcon id={p.id} size={14} />{facts.count} components</span>
            <span className="mv-pill">{facts.clips} with a clip</span>
            <span className="mv-pill mv-pill-mono">{range(facts.shortest, facts.longest)}</span>
          </p>

          <div className="mv-sec" id="pick">
            <h2 className="mv-sec-h">{p.pickLead}</h2>
            <div className="mvd-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Component</th>
                    <th scope="col">Use it when</th>
                  </tr>
                </thead>
                <tbody>
                  {p.picks.map((pick) => (
                    <tr key={pick.name}>
                      <th scope="row"><Link href={`/video-components/${pick.name}`} prefetch={false}>{moveByName(pick.name)?.title}</Link></th>
                      <td>{pick.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mv-sec" id="all">
            <h2 className="mv-sec-h">All {facts.count} components in {facts.label.toLowerCase()}</h2>
            <ul className="mv-grid">
              {moves.map((m, i) => (
                <GroupCard key={m.name} move={m} num={i + 1} first={i < 3} />
              ))}
            </ul>
          </div>

          <div className="mv-sec" id="rules">
            <h2 className="mv-sec-h">Rules that come with this group</h2>
            {p.rules.map((t) => (
              <p key={t} className="mv-intro">{t}</p>
            ))}
          </div>

          <div className="mv-sec" id="groups">
            <h2 className="mv-sec-h">More video components</h2>
            <ul className="mvd-more">
              {others.map((o) => (
                <li key={o.id}><Link href={groupPath(o.id)} prefetch={false}>{sibling(o.id)}</Link></li>
              ))}
            </ul>
          </div>

          <Next
            title="Chain it into a film."
            lead="Copy chains of video components from the recipes, or hand the list to an agent."
            primary={{ href: "/docs/recipes", label: "Open the recipes" }}
            secondary={{ href: "/video-components", label: `All ${MOVES.length} video components` }}
            related={p.more}
          />
        </section>
      </main>
      <Footer active="/video-components" />
    </div>
  );
}
