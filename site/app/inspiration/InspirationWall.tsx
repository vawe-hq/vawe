"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Icon } from "../components/Icon";
import { track } from "../../lib/track";
import { MatTile } from "../components/MatTile";
import { INSPIRATION_PAGE, MAKERS, PROMPTS_PATH, recreatePrompt, titleOf, type InspirationCard, type InspirationType } from "../../lib/inspiration-shared";

// The --ease-out and --ease-in tokens: the Web Animations API cannot read a custom property.
const EASE_OUT = "cubic-bezier(.23,1,.32,1)";
const EASE_IN = "cubic-bezier(.55,.055,.675,.19)";
const COPIED_MS = 1600;
// The first row's posters are the largest paint on load, so they skip lazy loading.
const FIRST_ROW = 6;
// Eight rows of six: enough to browse, and the rest stay out of the DOM until asked for. The page lists the rest in a noscript block.
const PAGE = INSPIRATION_PAGE;

type Filters = { q: string; types: string[]; prompt: boolean; made: string };
type Prompts = Record<string, string> | null;
type OnCopied = (ok: boolean, what: string) => void;
const EMPTY: Filters = { q: "", types: [], prompt: false, made: "" };

type Sort = "new" | "saved";

function readUrl(types: InspirationType[]): { filters: Filters; sort: Sort } {
  const p = new URLSearchParams(window.location.search);
  const known = new Set(types.map((t) => t.id));
  return {
    filters: { q: p.get("q") ?? "", types: (p.get("type") ?? "").split(",").filter((t) => known.has(t)), prompt: p.get("prompt") === "1", made: MAKERS.find((m) => m === p.get("made")) ?? "" },
    sort: p.get("sort") === "saved" ? "saved" : "new",
  };
}

function writeUrl(f: Filters, sort: Sort) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.types.length) p.set("type", f.types.join(","));
  if (f.prompt) p.set("prompt", "1");
  if (f.made) p.set("made", f.made);
  if (sort !== "new") p.set("sort", sort);
  const qs = p.toString().replace(/%2C/g, ",");
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}
const SORTS: { id: Sort; label: string }[] = [
  { id: "new", label: "Newest" },
  { id: "saved", label: "Most saved" },
];

const langOf = (s: string) =>
  /[぀-ヿ]/.test(s) ? "ja" : /[가-힯]/.test(s) ? "ko" : /[一-鿿]/.test(s) ? "zh" : "en";
const factsOf = (p: InspirationCard) => [p.typeLabel, p.madeWith].filter(Boolean).join(" · ");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function matches(p: InspirationCard, f: Filters, prompts: Prompts) {
  if (f.prompt && !p.promptSource) return false;
  if (f.made && p.maker !== f.made) return false;
  if (f.types.length && !f.types.some((t) => p.types.includes(t))) return false;
  if (!f.q) return true;
  const hay = [p.title, p.creator.name, p.creator.handle, p.madeWith, p.maker, prompts?.[p.id] ?? "", p.typeLabel, ...p.tags].join(" ").toLowerCase();
  return f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

// The prompt texts are one static file, fetched the first time a search or the viewer needs one.
function usePrompts() {
  const [prompts, setPrompts] = useState<Prompts>(null);
  const asked = useRef(false);
  const load = useCallback(() => {
    if (asked.current) return;
    asked.current = true;
    fetch(PROMPTS_PATH)
      .then((r) => (r.ok ? r.json() : {}))
      .then(setPrompts)
      .catch(() => setPrompts({}));
  }, []);
  return { prompts, load };
}

async function copyText(text: string) {
  track("copy-prompt");
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.remove();
    return ok;
  }
}

function CopyButton({
  text,
  className,
  label,
  tabIndex,
  onCopied,
  children,
}: {
  text: string;
  className: string;
  label?: string;
  tabIndex?: number;
  onCopied: OnCopied;
  children?: ReactNode;
}) {
  const [done, setDone] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={className}
      data-state={done ? "done" : undefined}
      tabIndex={tabIndex}
      aria-label={children ? undefined : label}
      title={label ?? `Copy: ${text}`}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyText(text);
        setDone(ok);
        onCopied(ok, label ? label.replace(/^Copy /, "") : text);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setDone(false), COPIED_MS);
      }}
    >
      <span className="in-idle">
        <Icon name="copy" size={14} />
        {children}
      </span>
      <span className="in-done" aria-hidden="true">
        <Icon name="check" size={14} />
        {children ? "Copied" : null}
      </span>
    </button>
  );
}

// The creator's X picture in a circle; the initial stands in when it is missing or fails, before or after hydration.
function Avatar({ post, className, decorative = false }: { post: InspirationCard; className: string; decorative?: boolean }) {
  const name = post.creator.name || post.creator.handle;
  const label = decorative ? "" : name;
  const [failed, setFailed] = useState(!post.avatar);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  return (
    <span className={className}>
      {failed ? (
        <span className="in-ava-initial" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
          {[...name][0]?.toUpperCase()}
        </span>
      ) : (
        <img ref={img} src={post.avatar} alt={label} width={28} height={28} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      )}
    </span>
  );
}

function Fail({ url, onRetry }: { url: string; onRetry?: () => void }) {
  return (
    <div className="in-fail">
      {onRetry ? <p>Video did not load</p> : null}
      <div className="in-fail-row">
        {onRetry ? (
          <button className="btn btn-ghost in-sm" type="button" onClick={onRetry}>
            Retry
          </button>
        ) : null}
        <a className="btn btn-ghost in-sm" href={url} rel="noopener">
          Open on X
        </a>
      </div>
    </div>
  );
}

function Tile({
  post,
  first,
  active,
  onActive,
  allowPlay,
  revealed,
  onOpen,
  onCopied,
}: {
  post: InspirationCard;
  first: boolean;
  active: boolean;
  onActive: (id: string) => void;
  allowPlay: boolean;
  revealed: boolean;
  onOpen: (id: string, e: MouseEvent<HTMLButtonElement>) => void;
  onCopied: OnCopied;
}) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [skel, setSkel] = useState(false);
  const [armed, setArmed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [noPoster, setNoPoster] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const want = Boolean(post.playback) && allowPlay && !failed && !skel && (hover || focus || revealed);
  const wantRef = useRef(want);
  wantRef.current = want;

  // A poster can fail before hydration, when onError is not yet attached: read the result on mount.
  useEffect(() => {
    const el = img.current;
    if (!el) return;
    if (!el.complete) setSkel(true);
    else if (el.naturalWidth === 0) setNoPoster(true);
  }, []);

  useEffect(() => {
    if (want && !armed) setArmed(true);
  }, [want, armed]);

  useEffect(() => {
    const v = video.current;
    if (!v || !armed) return;
    if (want) {
      setBuffering(true);
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      setPlaying(false);
      setBuffering(false);
      v.pause();
      try {
        v.currentTime = 0;
      } catch {}
    }
  }, [want, armed, attempt]);

  const title = titleOf(post);
  const facts = factsOf(post);
  const cls = ["in-tile", skel && "is-skel", revealed && "is-revealed", playing && "is-playing", buffering && "is-buffering", failed && "is-failed", noPoster && "is-noposter"]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      className={cls}
      data-id={post.id}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
      onFocus={() => {
        setFocus(true);
        onActive(post.id);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
    >
      {noPoster ? <MatTile word="Video" tone="graphite" detail="films" /> : null}
      <img
        ref={img}
        hidden={noPoster}
        src={post.poster}
        alt=""
        width={640}
        height={360}
        loading={first ? "eager" : "lazy"}
        fetchPriority={first ? "high" : "auto"}
        decoding="async"
        onLoad={() => setSkel(false)}
        onError={() => {
          setSkel(false);
          setNoPoster(true);
        }}
      />
      {post.playback ? (
        <video
          key={attempt}
          ref={video}
          src={armed ? post.playback : undefined}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => {
            setBuffering(false);
            if (wantRef.current) setPlaying(true);
          }}
          onWaiting={() => wantRef.current && setBuffering(true)}
          onError={() => {
            if (!armed) return;
            setPlaying(false);
            setBuffering(false);
            setFailed(true);
          }}
        />
      ) : null}
      <span className="in-buf" aria-hidden="true" />
      <Avatar post={post} className="in-ava" />
      <div className="in-layer" aria-hidden="true">
        <span className="in-txt">
          <b className={post.title ? undefined : "is-none"} lang={langOf(title)}>
            {title}
          </b>
          <span>@{post.creator.handle}</span>
          {facts ? <span>{facts}</span> : null}
        </span>
      </div>
      <button
        className="in-open"
        type="button"
        tabIndex={active ? 0 : -1}
        aria-label={`Open ${title}, by @${post.creator.handle}${facts ? `, ${facts}` : ""}`}
        onClick={(e) => onOpen(post.id, e)}
      />
      {post.promptSource ? <span className="in-badge">Prompt</span> : null}
      {post.playback ? <CopyButton className="in-ref" text={recreatePrompt(post)} label="Copy the recreation prompt" tabIndex={active ? 0 : -1} onCopied={onCopied} /> : null}
      {failed ? (
        <Fail
          url={post.url}
          onRetry={() => {
            setFailed(false);
            setArmed(false);
            setAttempt((n) => n + 1);
          }}
        />
      ) : null}
    </li>
  );
}

function ViewerMedia({ post, reduced }: { post: InspirationCard; reduced: boolean }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    if (!v || reduced) return;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
  }, [reduced, attempt]);

  if (!post.playback) {
    return (
      <div className="in-lb-media is-failed">
        <img src={post.poster} alt="" />
        <Fail url={post.url} />
      </div>
    );
  }
  return (
    <div className={failed ? "in-lb-media is-failed" : "in-lb-media"}>
      <video key={attempt} ref={video} src={post.playback} poster={post.poster} controls playsInline preload="metadata" onError={() => setFailed(true)} />
      {failed ? (
        <Fail
          url={post.url}
          onRetry={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}

// The whole text, never cut: a long one scrolls inside its well, with a fade while more text lies below.
function TextWell({ title, source, text, copy, onCopied }: { title: string; source?: string; text: string | null; copy: string; onCopied: OnCopied }) {
  const well = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const sync = useCallback(() => {
    const w = well.current;
    if (w) setMore(w.scrollTop + w.clientHeight < w.scrollHeight - 2);
  }, []);
  useEffect(() => {
    sync();
    const ro = new ResizeObserver(sync);
    if (well.current) ro.observe(well.current);
    return () => ro.disconnect();
  }, [sync, text]);
  return (
    <div className="in-blk">
      <div className="in-blk-head">
        <h3>
          {title}
          {source ? (
            <>
              {" "}
              <a className="in-src" href={source} rel="noopener">
                source
              </a>
            </>
          ) : null}
        </h3>
        {text ? (
          <CopyButton className="in-copy" text={text} label={`Copy the ${title.toLowerCase()}`} onCopied={onCopied}>
            {copy}
          </CopyButton>
        ) : null}
      </div>
      <div className={more ? "in-well in-prompt has-more" : "in-well in-prompt"}>
        <div className="in-prompt-scroll" ref={well} onScroll={sync} tabIndex={0} role="region" aria-label={title}>
          {text === null ? <p className="in-loading">Loading the prompt…</p> : <pre lang={langOf(text)}>{text}</pre>}
        </div>
      </div>
    </div>
  );
}

function Viewer({
  post,
  prompt,
  position,
  reduced,
  onStep,
  onClosed,
  onCopied,
  toast,
}: {
  post: InspirationCard | null;
  prompt: { source: string; text: string | null } | null;
  position: string;
  reduced: boolean;
  onStep: (dir: number) => void;
  onClosed: () => void;
  onCopied: OnCopied;
  toast: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const info = useRef<HTMLDivElement>(null);
  const isOpen = Boolean(post);

  useEffect(() => {
    const d = dialog.current;
    if (!d || !isOpen || d.open) return;
    d.showModal();
    d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE_OUT, pseudoElement: "::backdrop" });
    d.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "scale(.97) translateY(8px)" }, { opacity: 1, transform: "none" }], {
      duration: 240,
      easing: EASE_OUT,
    });
  }, [isOpen, reduced]);

  const close = useCallback(() => {
    const d = dialog.current;
    if (!d?.open) return;
    d.querySelector("video")?.pause();
    d.animate([{ opacity: 1 }, { opacity: 0, transform: reduced ? "none" : "scale(.98)" }], { duration: 140, easing: EASE_IN, fill: "forwards" }).finished.then(() => {
      d.close();
      d.getAnimations().forEach((a) => a.cancel());
      onClosed();
    });
  }, [reduced, onClosed]);

  const step = (dir: number) => {
    onStep(dir);
    if (!reduced) info.current?.animate([{ opacity: 0, transform: `translateX(${12 * dir}px)` }, { opacity: 1, transform: "none" }], { duration: 180, easing: EASE_OUT });
  };

  const title = post ? titleOf(post) : "";
  const facts = post ? [post.typeLabel, post.madeWith, fmtDate(post.posted)].filter(Boolean).join(" · ") : "";

  return (
    <dialog
      ref={dialog}
      className="in-lb"
      aria-labelledby="in-lb-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("video")) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          step(1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          step(-1);
        }
      }}
    >
      {post ? (
        <>
          <div className="in-lb-top">
            <span className="meta">{position}</span>
            <button className="in-icon" type="button" aria-label="Previous" onClick={() => step(-1)}>
              <Icon name="back" />
            </button>
            <button className="in-icon" type="button" aria-label="Next" onClick={() => step(1)}>
              <Icon name="arrow" />
            </button>
            <button className="in-icon" type="button" aria-label="Close" onClick={close}>
              <Icon name="x" />
            </button>
          </div>
          <div className="in-lb-body">
            <ViewerMedia key={post.id} post={post} reduced={reduced} />
            <div className="in-lb-info" ref={info}>
              <div>
                <h2 id="in-lb-title" className={post.title ? undefined : "is-none"} lang={langOf(title)}>
                  {title}
                </h2>
                <p className="in-who">
                  <a href={`https://x.com/${post.creator.handle}`} rel="noopener">
                    <Avatar post={post} className="in-ava in-ava-inline" decorative />
                    {post.creator.name ? `${post.creator.name} ` : null}
                    <span className="in-handle">@{post.creator.handle}</span>
                  </a>
                </p>
                <p className="meta in-facts">{facts}</p>
              </div>
              {post.playback ? (
                <TextWell
                  key={`r${post.id}`}
                  title="Recreation prompt"
                  text={prompt?.text === null ? null : recreatePrompt(post, prompt?.text)}
                  copy="Copy"
                  onCopied={onCopied}
                />
              ) : null}
              {prompt ? <TextWell key={post.id} title="Prompt" source={prompt.source} text={prompt.text} copy="Copy prompt" onCopied={onCopied} /> : null}
              <div className="in-lb-acts">
                <a className="btn btn-ghost" href={post.url} rel="noopener">
                  Open on X <Icon name="external" size={14} />
                </a>
              </div>
            </div>
          </div>
          {toast}
        </>
      ) : null}
    </dialog>
  );
}

// Arrow keys move focus to the nearest tile in that direction, by position on screen.
function nearestTile(tiles: HTMLElement[], from: HTMLElement, d: number[]) {
  const r0 = from.getBoundingClientRect();
  const c0 = [r0.left + r0.width / 2, r0.top + r0.height / 2];
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const t of tiles) {
    const h = t.querySelector<HTMLElement>(".in-open");
    if (!h || h === from || !h.offsetParent) continue;
    const r = h.getBoundingClientRect();
    const c = [r.left + r.width / 2, r.top + r.height / 2];
    const along = (c[0] - c0[0]) * d[0] + (c[1] - c0[1]) * d[1];
    if (along <= 1) continue;
    const score = along + 2 * (Math.abs((c[0] - c0[0]) * d[1]) + Math.abs((c[1] - c0[1]) * d[0]));
    if (score < bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best;
}

const ARROWS: Record<string, number[]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export function InspirationWall({
  posts,
  types,
  suggestHref,
  children,
}: {
  posts: InspirationCard[];
  types: InspirationType[];
  suggestHref: string;
  children: ReactNode;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<Sort>("new");
  const [limit, setLimit] = useState(PAGE);
  const [previewsOff, setPreviewsOff] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [live, setLive] = useState<{ text: string; on: boolean }>({ text: "", on: false });
  const reduced = useReducedMotion();
  const { prompts, load: loadPrompts } = usePrompts();
  const wall = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const liveTimer = useRef<number>(undefined);
  const firstFilter = useRef(true);
  const focusFrom = useRef<number | null>(null);

  const ordered = useMemo(() => (sort === "saved" ? [...posts].sort((a, b) => (b.saves ?? 0) - (a.saves ?? 0)) : posts), [posts, sort]);
  const matched = useMemo(() => ordered.filter((p) => matches(p, filters, prompts)), [ordered, filters, prompts]);
  const shownIds = useMemo(() => matched.map((p) => p.id), [matched]);
  const rendered = matched.slice(0, limit);
  const counts = useMemo(() => new Map(types.map((t) => [t.id, posts.filter((p) => p.types.includes(t.id)).length])), [posts, types]);
  const makerCounts = useMemo(() => new Map(MAKERS.map((m) => [m, posts.filter((p) => p.maker === m).length])), [posts]);
  const byId = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  const tiles = () => [...(wall.current?.children ?? [])] as HTMLElement[];
  const active = rendered.some((p) => p.id === activeId) ? activeId : rendered[0]?.id;

  // The URL carries the search, the type filters and the sort, so a filtered view can be shared.
  useEffect(() => {
    const read = readUrl(types);
    setFilters(read.filters);
    setSort(read.sort);
  }, [types]);
  const urlReady = useRef(false);
  useEffect(() => {
    if (!urlReady.current) {
      urlReady.current = true;
      return;
    }
    writeUrl(filters, sort);
  }, [filters, sort]);

  // First paint: the tiles arrive in a diagonal wave, one step per row and column.
  useEffect(() => {
    const list = tiles();
    const rects = list.map((t) => t.getBoundingClientRect());
    const xs = [...new Set(rects.map((r) => Math.round(r.left)))].sort((a, b) => a - b);
    const ys = [...new Set(rects.map((r) => Math.round(r.top)))].sort((a, b) => a - b);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.forEach((t, i) =>
      t.animate(still ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "none" }], {
        duration: 360,
        delay: still ? 0 : Math.min(xs.indexOf(Math.round(rects[i].left)) + ys.indexOf(Math.round(rects[i].top)), 12) * 40,
        easing: EASE_OUT,
        fill: "backwards",
      }),
    );
  }, []);

  useEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false;
      return;
    }
    tiles()
      .slice(0, PAGE)
      .forEach((t, i) => {
        t.getAnimations().forEach((a) => a.cancel());
        t.animate(reduced ? [{ opacity: 0.4 }, { opacity: 1 }] : [{ opacity: 0, transform: "scale(.98)" }, { opacity: 1, transform: "none" }], {
          duration: 180,
          delay: reduced ? 0 : Math.min(i, 12) * 14,
          easing: EASE_OUT,
          fill: "backwards",
        });
      });
  }, [filters, sort, reduced]);

  // After "Show more", focus moves to the first new tile so a keyboard reader goes on from there.
  useEffect(() => {
    if (focusFrom.current === null) return;
    wall.current?.children[focusFrom.current]?.querySelector<HTMLElement>(".in-open")?.focus();
    focusFrom.current = null;
  }, [limit]);

  // Touch has no hover: the first tap reveals a tile and plays it, a tap anywhere else hides it.
  useEffect(() => {
    const hide = (e: Event) => {
      if (!(e.target as HTMLElement).closest?.(".in-tile")) setRevealed(null);
    };
    document.addEventListener("click", hide);
    return () => document.removeEventListener("click", hide);
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || (e.target as HTMLElement).closest("input, textarea") || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      search.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => window.clearTimeout(liveTimer.current), []);

  const onCopied = useCallback((ok: boolean, what: string) => {
    setLive({ text: ok ? `Copied: ${what}` : "Copy failed. Select the text and copy it.", on: true });
    window.clearTimeout(liveTimer.current);
    liveTimer.current = window.setTimeout(() => setLive((l) => ({ ...l, on: false })), COPIED_MS);
  }, []);

  const view = (id: string) => {
    if (byId.get(id)?.promptSource) loadPrompts();
    setOpenId(id);
  };

  const onOpen = (id: string, e: MouseEvent<HTMLButtonElement>) => {
    const touch = !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (touch && e.detail !== 0 && revealed !== id) {
      setRevealed(id);
      return;
    }
    view(id);
  };

  const openRef = useRef(openId);
  openRef.current = openId;
  const onClosed = useCallback(() => {
    const id = openRef.current;
    setOpenId(null);
    setRevealed(null);
    if (id) wall.current?.querySelector<HTMLButtonElement>(`[data-id="${id}"] .in-open`)?.focus({ preventScroll: true });
  }, []);

  const pool = () => (shownIds.length ? shownIds : posts.map((p) => p.id));
  const step = (dir: number) => {
    const list = pool();
    if (list.length < 2 || !openId) return;
    const i = list.indexOf(openId);
    view(list[(i + dir + list.length) % list.length]);
  };
  const surprise = () => {
    const list = pool();
    view(list[Math.floor(Math.random() * list.length)]);
  };

  const onWallKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const d = ARROWS[e.key];
    const from = (e.target as HTMLElement).closest<HTMLElement>(".in-open");
    if (!d || !from) return;
    e.preventDefault();
    const best = nearestTile(tiles(), from, d);
    if (best) {
      best.focus();
      best.scrollIntoView({ block: "nearest" });
    }
  };

  const filter = (next: (f: Filters) => Filters) => {
    setFilters(next);
    setLimit(PAGE);
  };
  const toggleType = (id: string) => filter((f) => ({ ...f, types: f.types.includes(id) ? f.types.filter((t) => t !== id) : [...f.types, id] }));

  const open = openId ? byId.get(openId) ?? null : null;
  const position = open ? `${Math.max(shownIds.indexOf(open.id), 0) + 1} / ${shownIds.length || posts.length}` : "";
  const left = matched.length - rendered.length;
  const toast = (
    <div className={live.on ? "in-live is-on" : "in-live"} role="status" aria-live="polite">
      {live.text}
    </div>
  );

  return (
    <>
      <div className="in-head">
        <div>{children}</div>
        <div className="in-acts">
          <button className="btn btn-ghost" type="button" onClick={surprise}>
            <Icon name="shuffle" size={16} />
            Surprise me
          </button>
          <a className="btn btn-primary" href={suggestHref} rel="noopener">
            Suggest a post
          </a>
        </div>
      </div>

      <div className="in-rail" role="search">
        <label className="in-search">
          <span className="sr-only">Search by title, creator, tool or prompt</span>
          <Icon name="search" size={16} />
          <input
            ref={search}
            type="search"
            placeholder="Search"
            autoComplete="off"
            value={filters.q}
            onFocus={loadPrompts}
            onChange={(e) => filter((f) => ({ ...f, q: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Escape" && filters.q) {
                e.stopPropagation();
                filter((f) => ({ ...f, q: "" }));
              }
            }}
          />
          <kbd aria-hidden="true">/</kbd>
        </label>
        <div className="in-chips">
          <fieldset>
            <legend className="sr-only">Type</legend>
            {types.filter((t) => counts.get(t.id)).map((t) => (
              <label className="in-chip" key={t.id}>
                <input type="checkbox" checked={filters.types.includes(t.id)} onChange={() => toggleType(t.id)} />
                <span>
                  {t.chip} <i>{counts.get(t.id)}</i>
                </span>
              </label>
            ))}
          </fieldset>
          <span className="in-sep" aria-hidden="true" />
          <label className="in-chip">
            <input type="checkbox" checked={filters.prompt} onChange={(e) => filter((f) => ({ ...f, prompt: e.target.checked }))} />
            <span>Prompt</span>
          </label>
        </div>
        <label className="in-made">
          <span className="sr-only">Made with</span>
          <select value={filters.made} onChange={(e) => filter((f) => ({ ...f, made: e.target.value }))}>
            <option value="">Made with: any</option>
            {MAKERS.filter((m) => makerCounts.get(m)).map((m) => (
              <option key={m} value={m}>
                {m} ({makerCounts.get(m)})
              </option>
            ))}
          </select>
        </label>
        <div className="in-sort" role="group" aria-label="Sort">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sort === s.id}
              onClick={() => {
                setSort(s.id);
                setLimit(PAGE);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="meta in-status" role="status" aria-live="polite">
          {shownIds.length}
          <span className="sr-only"> posts</span>
        </span>
        <button
          className="in-icon"
          type="button"
          aria-pressed={previewsOff}
          aria-label="Pause previews"
          title="Pause previews"
          onClick={() => setPreviewsOff((v) => !v)}
        >
          <Icon name="pause" size={16} />
        </button>
      </div>

      <ul className="in-wall" ref={wall} aria-label="Posts" onKeyDown={onWallKey}>
        {rendered.map((p, i) => (
          <Tile
            key={p.id}
            post={p}
            first={i < FIRST_ROW}
            active={p.id === active}
            onActive={setActiveId}
            allowPlay={!previewsOff && !reduced && !openId}
            revealed={revealed === p.id}
            onOpen={onOpen}
            onCopied={onCopied}
          />
        ))}
      </ul>
      {left > 0 ? (
        <div className="in-more">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              focusFrom.current = rendered.length;
              setLimit((n) => n + PAGE);
            }}
          >
            Show more
            <span className="meta">{left} left</span>
          </button>
        </div>
      ) : null}
      {shownIds.length ? null : (
        <div className="in-empty">
          <p>No match.</p>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              filter(() => EMPTY);
              search.current?.focus();
            }}
          >
            Clear search
          </button>
        </div>
      )}

      <Viewer
        post={open}
        prompt={open?.promptSource ? { source: open.promptSource, text: prompts?.[open.id] ?? null } : null}
        position={position}
        reduced={reduced}
        onStep={step}
        onClosed={onClosed}
        onCopied={onCopied}
        toast={toast}
      />
      {open ? null : toast}
    </>
  );
}
