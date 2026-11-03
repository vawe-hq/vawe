import Link from "next/link";
import { DOCS_URL, REPO_URL } from "./Header";
import sitePages from "../../lib/site-pages.json";
import { guidePosts } from "../../lib/blog";

type Route = { path: string; group?: string; label?: string };

// One owner for the grouping: lib/site-pages.json assigns `group` and `label` to every route, and
// this is the only place that reads it into a nav. Adding a route means adding it there, never here.
const ROUTES = (sitePages.routes as Route[]).filter((r): r is Required<Route> => Boolean(r.group && r.label));

const NAV_GROUPS: { title: string; group: string }[] = [
  { title: "Product", group: "product" },
  { title: "Learn", group: "topic" },
  { title: "Compare", group: "comparison" },
  { title: "Project", group: "project" },
];

/* Same active-hint mechanism Header.tsx uses (a prop naming the current item, so the current page
 * never links to itself), here keyed by the real path rather than Header's short NAV key, because
 * the footer's link set is the full route table, not one fixed array a key can index into. */
function FooterNav({ active }: { active?: string }) {
  const cols = NAV_GROUPS.map(({ title, group }) => ({
    title,
    items: ROUTES.filter((r) => r.group === group),
  })).filter((c) => c.items.length);

  return (
    <nav className="foot-nav" aria-label="Site">
      {cols.map((col) => (
        <div className="foot-col" key={col.title}>
          <span className="foot-h">{col.title}</span>
          {col.items.map((r) =>
            active === r.path ? (
              <span key={r.path} aria-current="page">
                {r.label}
              </span>
            ) : (
              <Link key={r.path} href={r.path}>
                {r.label}
              </Link>
            ),
          )}
        </div>
      ))}
      <div className="foot-col">
        <span className="foot-h">Guides</span>
        {guidePosts().map((g) =>
          active === g.href ? (
            <span key={g.href} aria-current="page">{g.label}</span>
          ) : (
            <Link key={g.href} href={g.href}>{g.label}</Link>
          ),
        )}
      </div>
      <div className="foot-col">
        <span className="foot-h">Docs</span>
        <a href={DOCS_URL}>Documentation</a>
        <a href={REPO_URL}>GitHub</a>
      </div>
    </nav>
  );
}

/* ONE FOOTER ON EVERY PAGE: a studio panel holding the generated route groups, and a meta line.
 * `bookend` adds the closing call to action above it, on the pages that end a journey. */
export function Footer({ note, bookend = false, active }: { note?: string; bookend?: boolean; active?: string }) {
  return (
    <footer className="wrap foot">
      {bookend && (
        <div className="panel foot-cta-panel">
          <p className="foot-cta">Write the page.</p>
          <div className="foot-act">
            <a className="btn btn-primary" href={REPO_URL}>Get started on GitHub</a>
            <a className="btn btn-ghost" href="/video-components">See the video components</a>
          </div>
        </div>
      )}
      <div className="panel foot-panel">
        <FooterNav active={active} />
        <div className="foot-meta">
          <span>© 2026 vawe · open source, <a href={`${REPO_URL}/blob/main/LICENSE`}>Apache 2.0</a></span>
          {note ? <span className="mono">{note}</span> : null}
        </div>
      </div>
    </footer>
  );
}
