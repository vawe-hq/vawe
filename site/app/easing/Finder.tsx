"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SpacingChart, spacingDomain } from "./Spacing";
import { track } from "../../lib/track";

type Pick = { slug: string; name: string; ez: string; sp: number[] };

const MAX_PICKS = 3;
const MAX_ECHO = 40;

// The cards are server-rendered so every ease stays a plain link. This wrapper filters them by
// toggling `hidden`, copies a card's value, and runs the comparison tray.
export function Finder({ children, total, jobs }: { children: ReactNode; total: number; jobs: { id: string; job: string }[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [job, setJob] = useState<string>("all");
  const [picks, setPicks] = useState<Pick[]>([]);
  const [shown, setShown] = useState(total);
  const [replay, setReplay] = useState(0);

  const cards = useCallback(() => Array.from(root.current?.querySelectorAll<HTMLElement>("[data-ez-card]") ?? []), []);

  const toPick = (card: HTMLElement): Pick => ({ slug: card.dataset.slug ?? "", name: card.dataset.name ?? "", ez: card.style.getPropertyValue("--ez"), sp: (card.dataset.sp ?? "").split(",").map(Number) });

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("compare")?.split(",") ?? [];
    const known = cards().filter((c, i, all) => wanted.includes(c.dataset.slug ?? "") && all.findIndex((d) => d.dataset.slug === c.dataset.slug) === i);
    if (!known.length) return;
    setPicks(known.slice(0, MAX_PICKS).map(toPick));
  }, [cards]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    let n = 0;
    for (const card of cards()) {
      const hit = (job === "all" || (card.dataset.jobs ?? "").split(" ").includes(job)) && (!q || (card.dataset.search ?? "").includes(q));
      card.hidden = !hit;
      if (hit) n++;
    }
    root.current?.querySelectorAll<HTMLElement>("[data-ez-group]").forEach((g) => {
      g.hidden = !g.querySelector("[data-ez-card]:not([hidden])");
    });
    setShown(n);
  }, [query, job, cards]);

  useEffect(() => {
    const slugs = new Set(picks.map((p) => p.slug));
    root.current?.querySelectorAll<HTMLButtonElement>(".ez-pick").forEach((b) => {
      const on = slugs.has(b.closest<HTMLElement>("[data-ez-card]")?.dataset.slug ?? "");
      b.setAttribute("aria-pressed", String(on));
      b.textContent = on ? "Remove" : "Compare";
    });
  }, [picks, shown]);

  const onClick = (ev: React.MouseEvent) => {
    const target = ev.target as Element;
    const card = target.closest<HTMLElement>("[data-ez-card]");
    if (!card) return;
    if (target.closest(".ez-copy")) {
      const button = target.closest<HTMLButtonElement>(".ez-copy")!;
      const label = button.dataset.label ?? "Copy";
      track("copy-code");
      void navigator.clipboard.writeText(card.style.getPropertyValue("--ez")).then(
        () => flash(button, "Copied", label),
        () => flash(button, "Select and copy", label),
      );
    } else if (target.closest(".ez-pick")) {
      const p = toPick(card);
      setPicks((cur) => (cur.some((c) => c.slug === p.slug) ? cur.filter((c) => c.slug !== p.slug) : [...cur, p].slice(-MAX_PICKS)));
    }
  };

  const even = Array.from({ length: 13 }, (_, k) => k / 12);
  const domain = spacingDomain([even, ...picks.map((p) => p.sp)]);
  const share = `/easing?compare=${picks.map((p) => p.slug).join(",")}#compare`;

  return (
    <div ref={root} onClick={onClick}>
      <div className="ez-bar" role="search">
        <label className="ez-search">
          <span className="ez-sr">Search easing functions</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search: out, bounce, land" autoComplete="off" spellCheck={false} />
        </label>
        <div className="ez-chips" role="group" aria-label="Filter by job">
          {[{ id: "all", job: "All" }, ...jobs].map((j) => (
            <button key={j.id} type="button" className="ez-chip" aria-pressed={job === j.id} onClick={() => setJob(j.id)}>{j.job}</button>
          ))}
        </div>
        <p className="ez-count meta" aria-live="polite">{shown === total ? `${total} eases` : `${shown} of ${total}`}</p>
      </div>
      {shown === 0 ? (
        <p className="ez-empty">
          {query.trim() ? <>No ease matches &ldquo;{query.trim().slice(0, MAX_ECHO)}{query.trim().length > MAX_ECHO ? "\u2026" : ""}&rdquo;.</> : "No ease matches these filters."} <button type="button" className="ez-link" onClick={() => { setQuery(""); setJob("all"); }}>Clear the filters</button>
        </p>
      ) : null}
      {children}
      {picks.length ? (
        <section className="panel ez-tray" id="compare" aria-label="Compare eases">
          <div className="ez-tray-head">
            <h2>Compare</h2>
            <div className="ez-tray-act">
              <button type="button" className="ez-chip" onClick={() => setReplay((n) => n + 1)}>Replay</button>
              <a className="ez-chip" href={share}>Link</a>
              <button type="button" className="ez-chip" onClick={() => setPicks([])}>Clear</button>
            </div>
          </div>
          <span className="meta">Spacing: equal steps of time</span>
          <div className="ez-sp-rows">
            {picks.map((p) => (
              <div className="ez-row" key={`sp-${p.slug}`}>
                <span className="ez-lab-name" title={p.name}>{p.name}</span>
                <SpacingChart values={p.sp} domain={domain} w={420} h={30} ghost={7} label={`${p.name} at 13 equal time steps`} />
              </div>
            ))}
            <div className="ez-row">
              <span className="ez-lab-name">linear</span>
              <SpacingChart values={even} domain={domain} w={420} h={30} ghost={7} />
            </div>
          </div>
          <span className="meta ez-race-h">Race</span>
          {picks.map((p) => (
            <div className="ez-row" key={`${p.slug}-${replay}`}>
              <span className="ez-lab-name" title={p.name}>{p.name}</span>
              <div className="ez-track"><span className="ez-box ez-race" style={{ ["--ez" as string]: p.ez }} /></div>
            </div>
          ))}
          <div className="ez-row" key={`linear-${replay}`}>
            <span className="ez-lab-name">linear</span>
            <div className="ez-track"><span className="ez-box ez-box-ref ez-race" /></div>
          </div>
          {picks.length < MAX_PICKS ? <p className="ez-cap">Pick up to {MAX_PICKS}. Each card has a Compare button.</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function flash(button: HTMLButtonElement, text: string, label: string) {
  button.textContent = text;
  window.setTimeout(() => { button.textContent = label; }, 1400);
}
