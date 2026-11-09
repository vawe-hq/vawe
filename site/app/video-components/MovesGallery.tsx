"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Facet, MoveCard } from "../../lib/moves";
import { clip, type Theme } from "../../lib/clip";
import { moveAlt } from "../../lib/move-words";
import { GroupIcon, MiscSvg } from "./icons";
import { ThemeToggle, useClipTheme } from "./ThemeToggle";
import { ScrollSpy } from "../components/ScrollSpy";

// Enough to show the grid is alive; each playing clip holds a decoder, and phones drop frames past this.
const MAX_PLAYING = 6;
const PLAY_RATIO = 0.5;
// The first row's posters are the largest paint on load, so they skip lazy loading. Cards are numbered in page order.
const FIRST_ROW = 3;

type Facets = { group: string[]; look: string[]; job: string[] };
type Filters = Facets & { q: string };
type FacetKey = keyof Facets;
const EMPTY: Filters = { q: "", group: [], look: [], job: [] };
const FACETS: FacetKey[] = ["group", "look", "job"];

const list = (v: string | null, known: string[]) => [...new Set(v ? v.split(",") : [])].filter((x) => known.includes(x));

function readUrl(known: Facets): Filters {
  const p = new URLSearchParams(window.location.search);
  return { q: p.get("q") ?? "", group: list(p.get("group"), known.group), look: list(p.get("look"), known.look), job: list(p.get("job"), known.job) };
}

function writeUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  for (const k of FACETS) if (f[k].length) p.set(k, f[k].join(","));
  const theme = new URLSearchParams(window.location.search).get("theme");
  if (theme) p.set("theme", theme);
  const qs = p.toString().replace(/%2C/g, ",");
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

const valuesOf = (m: MoveCard, k: FacetKey) => (k === "group" ? [m.group ?? ""] : k === "look" ? [m.look] : m.jobs);

// OR inside one facet, AND across facets. `skip` leaves one facet out, so its options can show the
// count they would add.
function matches(m: MoveCard, f: Filters, skip?: FacetKey) {
  for (const k of FACETS) {
    if (k === skip || !f[k].length) continue;
    if (!valuesOf(m, k).some((v) => f[k].includes(v))) return false;
  }
  if (!f.q) return true;
  const hay = `${m.name} ${m.title} ${m.use}`.toLowerCase();
  return f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

const Card = memo(function Card({
  move,
  num,
  first,
  live,
  reduced,
  theme,
  onToggle,
}: {
  move: MoveCard;
  num: number;
  first: boolean;
  live: boolean;
  reduced: boolean;
  theme: Theme | null;
  onToggle: (name: string) => void;
}) {
  const files = clip(move, theme);
  return (
    <li className="mv-card panel" data-name={move.name}>
      <div className="mv-media">
        {move.clipHash ? (
          <img
            src={files.poster}
            alt={moveAlt(move)}
            width={640}
            height={360}
            loading={first ? "eager" : "lazy"}
            fetchPriority={first ? "high" : "auto"}
            decoding="async"
          />
        ) : (
          <p className="meta mv-soon">Clip coming</p>
        )}
        {live && move.clipHash ? (
          <video
            key={files.mp4}
            muted
            loop
            playsInline
            autoPlay
            aria-hidden="true"
            onPlaying={(e) => e.currentTarget.setAttribute("data-on", "")}
          >
            <source src={files.webm} type="video/webm" />
            <source src={files.mp4} type="video/mp4" />
          </video>
        ) : null}
        <span className="mv-chip mv-chip-num" aria-hidden="true">{String(num).padStart(2, "0")}</span>
        {move.duration ? (
          <span className="mv-chip mv-chip-dur" aria-hidden="true">
            <MiscSvg name="play" size={9} />
            {move.duration} s
          </span>
        ) : null}
        <p className="mv-use">{move.use}</p>
        {move.clipHash ? (
          <span className="mv-bar-t" aria-hidden="true" style={{ "--len": `${move.duration ?? 2}s` } as React.CSSProperties} />
        ) : null}
        {reduced && move.clipHash ? (
          <button type="button" className="mv-play" aria-pressed={live} onClick={() => onToggle(move.name)}>
            {live ? "Stop" : "Play"}
            <span className="sr-only"> {move.title}</span>
          </button>
        ) : null}
      </div>
      <div className="mv-cap">
        <GroupIcon id={move.group} size={14} />
        <h3 className="mv-title">
          <Link href={`/video-components/${move.name}`} prefetch={false}>{move.title}</Link>
        </h3>
        <p className="mv-use-touch">{move.use}</p>
      </div>
    </li>
  );
});

export function MovesGallery({
  moves,
  groups,
  looks,
  jobs,
}: {
  moves: MoveCard[];
  groups: Facet[];
  looks: string[];
  jobs: Facet[];
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [panelOpen, setPanelOpen] = useState(false);
  const [live, setLive] = useState<string[]>([]);
  const [reduced, setReduced] = useState(false);
  const [theme, setTheme] = useClipTheme();
  const defaultTheme: Theme = moves.filter((m) => m.theme === "light").length * 2 > moves.length ? "light" : "dark";
  const grid = useRef<HTMLDivElement>(null);

  const numbers = useMemo(() => new Map(moves.map((m, i) => [m.name, i + 1])), [moves]);
  const sections = useMemo(
    () => groups.map((g) => ({ ...g, moves: moves.filter((m) => m.group === g.id && matches(m, filters)) })).filter((g) => g.moves.length),
    [moves, groups, filters],
  );
  const total = sections.reduce((n, g) => n + g.moves.length, 0);
  const counts = useMemo(() => {
    const out = {} as Record<FacetKey, Map<string, number>>;
    for (const k of FACETS) {
      const c = new Map<string, number>();
      for (const m of moves) if (matches(m, filters, k)) for (const v of valuesOf(m, k)) c.set(v, (c.get(v) ?? 0) + 1);
      out[k] = c;
    }
    return out;
  }, [moves, filters]);

  useEffect(
    () => setFilters(readUrl({ group: groups.map((g) => g.id), look: looks, job: jobs.map((j) => j.id) })),
    [groups, looks, jobs],
  );

  const update = (next: Filters) => {
    setFilters(next);
    writeUrl(next);
  };
  const toggleValue = (k: FacetKey, v: string) =>
    update({ ...filters, [k]: filters[k].includes(v) ? filters[k].filter((x) => x !== v) : [...filters[k], v] });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduced(mq.matches);
      setLive([]);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // One observer for the whole grid. The clips that play are the first MAX_PLAYING cards, in page
  // order, that are at least half on screen.
  useEffect(() => {
    const root = grid.current;
    if (!root || reduced) return;
    const cards = [...root.querySelectorAll<HTMLElement>("[data-name]")];
    const ratios = new Map<Element, number>();
    const pick = () => {
      const names = cards
        .filter((el) => (ratios.get(el) ?? 0) >= PLAY_RATIO)
        .slice(0, MAX_PLAYING)
        .map((el) => el.dataset.name as string);
      setLive((prev) => (prev.length === names.length && prev.every((n, i) => n === names[i]) ? prev : names));
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target, e.intersectionRatio);
        pick();
      },
      { threshold: [0, PLAY_RATIO, 1] },
    );
    for (const el of cards) io.observe(el);
    return () => io.disconnect();
  }, [reduced, sections]);

  const toggle = useCallback(
    (name: string) =>
      setLive((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name].slice(-MAX_PLAYING))),
    [],
  );

  const liveSet = new Set(live);
  const picked = FACETS.reduce((n, k) => n + filters[k].length, 0);
  const active = picked > 0 || filters.q !== "";

  const options: { key: FacetKey; legend: string; items: Facet[] }[] = [
    { key: "group", legend: "Category", items: groups },
    { key: "look", legend: "Look", items: looks.map((l) => ({ id: l, label: l })) },
    { key: "job", legend: "Pick by job", items: jobs },
  ];

  return (
    <>
      <div className="mv-bar" role="search">
        <label className="mv-find">
          <span className="sr-only">Search components by name or when line</span>
          <MiscSvg name="search" size={15} />
          <input
            type="search"
            placeholder="Search"
            value={filters.q}
            onChange={(e) => update({ ...filters, q: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="mv-fold"
          aria-expanded={panelOpen}
          aria-controls="mv-filters"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <MiscSvg name="sliders" size={15} />
          Filters{picked ? ` (${picked})` : ""}
        </button>
        <p className="meta mv-count" role="status">
          {total}
          <span className="sr-only"> {total === 1 ? "component" : "components"}</span>
        </p>
        <ThemeToggle shown={theme ?? defaultTheme} onChange={setTheme} />
        <nav className="mv-jump" aria-label="Categories">
          {sections.map((g) => (
            <a key={g.id} href={`#g-${g.id}`}>
              <GroupIcon id={g.id} size={15} />
              {g.label}
              <span className="mv-n">{g.moves.length}</span>
            </a>
          ))}
          <ScrollSpy nav=".mv-jump" />
        </nav>
      </div>

      <form className="mv-filters" id="mv-filters" data-open={panelOpen || undefined} onSubmit={(e) => e.preventDefault()}>
        {options.map(({ key, legend, items }) => (
          <fieldset key={key}>
            <legend>{legend}</legend>
            <ul>
              {items.map((it) => {
                const n = counts[key].get(it.id) ?? 0;
                const on = filters[key].includes(it.id);
                return (
                  <li key={it.id}>
                    <label className={on || n ? "" : "is-zero"}>
                      <input type="checkbox" checked={on} onChange={() => toggleValue(key, it.id)} />
                      <span>{it.label}</span>
                      <span className="mv-n">{n}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
        <button type="button" className="mv-clear" disabled={!active} onClick={() => update(EMPTY)}>
          Clear filters
        </button>
      </form>

      {total ? (
        <div ref={grid}>
          {sections.map((g) => (
            <section key={g.id} className="mv-sec" id={`g-${g.id}`} aria-labelledby={`h-${g.id}`}>
              <h2 id={`h-${g.id}`} className="mv-sec-h">
                <span className="mv-sec-ico"><GroupIcon id={g.id} size={18} /></span>
                {g.label}
                <span className="meta">{g.moves.length}</span>
                <span className="mv-rule" aria-hidden="true" />
                <span className="meta mv-range" aria-hidden="true">
                  {String(numbers.get(g.moves[0].name)).padStart(2, "0")}&ndash;{String(numbers.get(g.moves[g.moves.length - 1].name)).padStart(2, "0")}
                </span>
              </h2>
              <ul className="mv-grid">
                {g.moves.map((m) => (
                  <Card
                    key={m.name}
                    move={m}
                    num={numbers.get(m.name) ?? 0}
                    first={(numbers.get(m.name) ?? 0) <= FIRST_ROW}
                    live={liveSet.has(m.name)}
                    reduced={reduced}
                    theme={theme}
                    onToggle={toggle}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="mv-empty">
          <p>No component matches these filters.</p>
          <button type="button" className="btn btn-ghost" onClick={() => update(EMPTY)}>
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
