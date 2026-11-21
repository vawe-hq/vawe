import Link from "next/link";

// The small cut of the mark (films/logo-lab/final/vawe-mark-small.svg) cropped to its ink box. For sizes below 64 px.
export function VaweMark({ className = "glyph" }: { className?: string }) {
  return (
    <svg className={className} viewBox="8 4 48 52" fill="currentColor" aria-hidden="true">
      <path d="M8 20h24v8h-24zM44 20h12v8h-12zM20 32h12v8h-12zM44 32h12v8h-12zM8 44h24v8h-24zM44 44h12v8h-12zM28 4H48V12H44V16H40V56H36V16H32V12H28z" />
    </svg>
  );
}

// Ordered by what a visitor came for: the moves first, then films others made. Features sits in the footer.
const NAV = [
  { href: "/video-components", label: "Video components", key: "video-components" },
  { href: "/templates", label: "Templates", key: "templates" },
  { href: "/marketplace", label: "Marketplace", key: "marketplace" },
  { href: "/jobs", label: "Jobs", key: "jobs" },
  { href: "/inspiration", label: "Inspiration", key: "inspiration" },
  { href: "/resources", label: "Resources", key: "resources" },
  { href: "/blog", label: "Blog", key: "blog" },
];

// The docs are a separate fumadocs app (vawe-hq/vawe-docs) served at /docs via a rewrite in
// next.config.mjs, so this is just a path, no origin to configure, and nothing to get wrong in
// production. It used to fall back to a localhost URL, which shipped a dead link to every visitor.
// Exported so Footer.tsx points at the same two URLs instead of re-typing them.
export const DOCS_URL = "/docs";

import { REPO_URL } from "../../lib/site";

export { REPO_URL };

export function Header({ active, overlay = false }: { active?: string; overlay?: boolean }) {
  return (
    <div className={overlay ? "wrap bar-overlay" : "wrap"}>
      <header className="bar">
        <Link className="mark" href="/">
          <VaweMark />
          vawe
        </Link>
        {/* The current page is a <span aria-current="page">, never a link to itself (Footer.tsx
            uses the same rule). */}
        <nav className="nav" aria-label="Main">
          {NAV.map((n) =>
            active === n.key ? (
              <span key={n.key} aria-current="page">
                {n.label}
              </span>
            ) : (
              <Link key={n.key} href={n.href}>
                {n.label}
              </Link>
            ),
          )}
          <a href={DOCS_URL}>Docs</a>
        </nav>
        {/* The one filled action: the repo is public, so the source is the thing to go and get. */}
        <a className="ghbtn" href={REPO_URL}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
          <span className="gh-star" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" /></svg>
            <span className="gh-spark" /><span className="gh-spark" /><span className="gh-spark" /><span className="gh-spark" />
          </span>
        </a>
      </header>
    </div>
  );
}
