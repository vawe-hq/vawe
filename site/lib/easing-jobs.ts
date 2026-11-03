import data from "./easing.json";
import { smart } from "./typo.mjs";
import { SITE_URL } from "./site";
import { JOBS, bezierText, easeBySlug, type Ease } from "./easing";
import { JOBS as MOVE_JOBS, moveByName } from "./moves";

// One page per job of core/motion/ease-jobs.js (JOBS) plus the product UI presets that have no job of their own
// (send, typing, stream). The numbers come from site/lib/easing.json, written by scripts/site/easing.mjs; the words
// that join them are here. A preset that describes the same motion as a job (panel, row, roll, exit) is merged into
// that job's page.

export type DemoKind = "rise" | "roll" | "stagger" | "pop" | "exit" | "push" | "scan" | "bubble" | "typing" | "stream";

type Raw = {
  uiRaw: {
    typing: { charMs: number; spaceMs: number; jitter: number };
    stream: { gapMs: [number, number]; fadeMs: number; tintMs: number };
    send: { k: number; d: number };
    panel: { fadeMs: number; rise: string };
    row: { fadeMs: number; rise: string; staggerMs: number };
    roll: { outMs: number; inMs: number; rise: string };
    exit: { ms: number; endGapMs: number; drift: string };
    snap: { overshoot: [number, number] };
  };
  demoMs: Record<string, number>;
  sendDemo: { ms: number; linear: string; settleS: number; overshoot: number };
  exitExample: { entranceS: number; exitMs: number };
};
const raw = data as unknown as Raw;
const UI = raw.uiRaw;

export const UI_SOURCE = "Measured on ChatGPT and Vercel Analytics clips at 30 fps, read off frames, plus or minus 33 ms.";

type Spec = {
  slug: string;
  jobId?: string;
  kind: DemoKind;
  noun: string;
  name: string;
  preset?: { label: string; value: string; measured: string }[];
  moveJobs: string[];
  rise?: string;
  ref?: boolean;
};

const SPECS: Spec[] = [
  { slug: "title-entrance", jobId: "title", kind: "rise", noun: "a title or text entrance", name: "Title or text entrance", rise: "4vh", ref: true, moveJobs: ["land-a-title-or-wordmark-soft"] },
  {
    slug: "panel-entrance", jobId: "panel", kind: "rise", noun: "a UI panel or card", name: "UI panel or card in", rise: UI.panel.rise, ref: true,
    preset: [{ label: "Panel in", value: `fade ${UI.panel.fadeMs} ms, rise ${UI.panel.rise}`, measured: "A window fades in 0.10 to 0.23 s with at most 2 px of rise, no scale." }],
    moveJobs: ["show-a-real-ui-arriving"],
  },
  {
    slug: "number-change", jobId: "value", kind: "roll", noun: "a value change (number swap)", name: "Value change (number swap)", rise: UI.roll.rise,
    preset: [{ label: "Digit roll", value: `${UI.roll.outMs} ms out, ${UI.roll.inMs} ms in, rise ${UI.roll.rise}`, measured: "A digit or label rolls in its own clipped slot, never half of two readings." }],
    moveJobs: ["decide-a-name-or-number-on-screen"],
  },
  {
    slug: "list-stagger", jobId: "stagger", kind: "stagger", noun: "a list stagger", name: "List stagger", rise: UI.row.rise,
    preset: [{ label: "Row in, stagger", value: `fade ${UI.row.fadeMs} ms, rise ${UI.row.rise}, ${UI.row.staggerMs} ms apart`, measured: "A row or line arrives in 0.15 to 0.3 s. Rows come 70 to 100 ms apart (7 rows in 0.5 s)." }],
    moveJobs: ["make-many-things-read-as-one-gesture"],
  },
  { slug: "notification-pop", jobId: "pop", kind: "pop", noun: "a small pop or notification", name: "Small pop or notification", ref: true, moveJobs: ["make-some-arrivals-overshoot-21-to-41-percent-of-them"] },
  {
    slug: "exit", jobId: "exit", kind: "exit", noun: "an exit", name: "Exit", rise: UI.exit.drift, ref: true,
    preset: [{ label: "Exit", value: `fade ${UI.exit.ms} ms, drift ${UI.exit.drift}`, measured: "The whole window fades in 0.3 to 0.4 s to the empty ground. Frame 0 is the same ground." }],
    moveJobs: ["run-every-beat-in-and-out"],
  },
  { slug: "short-camera-move", jobId: "camera-short", kind: "push", noun: "a camera move under 2 s", name: "Camera move under 2 s", ref: true, moveJobs: ["lean-the-camera-toward-a-subject"] },
  { slug: "long-camera-move", jobId: "camera-long", kind: "push", noun: "a camera move of 2 s or more", name: "Camera move of 2 s or more", ref: true, moveJobs: ["move-the-camera-over-a-whole-world-push-pull-whip"] },
  { slug: "scan-wipe", jobId: "scan", kind: "scan", noun: "a scan or wipe travel", name: "Scan or wipe travel", ref: true, moveJobs: [] },
  { slug: "hold-drift", jobId: "hold", kind: "push", noun: "a hold drift", name: "Hold drift", ref: true, moveJobs: ["give-a-held-frame-a-living-ground"] },
  {
    slug: "send-bubble", kind: "bubble", noun: "a sent message or small arrival", name: "Send, small arrival", ref: true,
    preset: [
      { label: "Send", value: `spring k ${UI.send.k}, d ${UI.send.d}`, measured: "A sent bubble overshoots 11 to 14 percent (x1.11 in 0.1 s). The spring gives 12 percent." },
      { label: "Snap", value: `overshoot ${UI.snap.overshoot.map((n) => Math.round(n * 100)).join(" to ")}%`, measured: "Overshoot is a snap on small, fast arrivals (3 to 20 px). A large panel does not overshoot." },
    ],
    moveJobs: ["make-some-arrivals-overshoot-21-to-41-percent-of-them"],
  },
  {
    slug: "typing", kind: "typing", noun: "typing", name: "Typing",
    preset: [{ label: "Typing", value: `${UI.typing.charMs} ms a character, +${UI.typing.spaceMs} ms after a space, ${UI.typing.jitter * 100}% jitter`, measured: "20 to 27 characters a second with pauses at word gaps: 38 in 1.5 s, 35 in 1.3 s, 61 in 3 s." }],
    moveJobs: ["type-a-command-prompt-or-name"],
  },
  {
    slug: "text-streaming", kind: "stream", noun: "streamed text", name: "Stream",
    preset: [{ label: "Stream", value: `${UI.stream.gapMs[0]} to ${UI.stream.gapMs[1]} ms a chunk of 1 to 3 words, fade ${UI.stream.fadeMs} ms, tint ${UI.stream.tintMs} ms`, measured: "15 to 25 words a second. A word fades in 0.2 to 0.3 s, tinted, and settles to ink in about 0.5 s." }],
    moveJobs: ["show-an-ai-product-answering"],
  },
];

export const JOB_SLUGS = SPECS.map((s) => s.slug);

const rest = (avoid: string) => avoid[0].toLowerCase() + avoid.slice(1);
const firstSentence = (t: string) => t.split(/\.\s/)[0].replace(/\.$/, "");

export type Chunk = { text: string; delayMs: number };
export type Lane = { label: string; ez: string };

export type JobPage = {
  slug: string;
  kind: DemoKind;
  h1: string;
  title: string;
  description: string;
  answer: string;
  job: string;
  time: string;
  ease: Ease | null;
  also: Ease[];
  avoid: string | null;
  ms: number;
  rise: string | null;
  lanes: Lane[];
  chunks: Chunk[];
  preset: { label: string; value: string; measured: string }[];
  presetSource: string | null;
  moveNames: string[];
  moveHeading: string;
  css: string;
  waapi: string;
  path: string;
};

const SAMPLE_TYPING = "bin/vawe new hello";
const SAMPLE_STREAM = "The page seeks every frame, so the same input draws the same film.";

function typingChunks(): Chunk[] {
  let at = 0;
  return [...SAMPLE_TYPING].map((c) => {
    const chunk = { text: c, delayMs: at };
    at += UI.typing.charMs + (c === " " ? UI.typing.spaceMs : 0);
    return chunk;
  });
}

function streamChunks(): Chunk[] {
  const words = SAMPLE_STREAM.split(" ");
  const [lo, hi] = UI.stream.gapMs;
  const out: Chunk[] = [];
  let at = 0, i = 0, n = 0;
  while (i < words.length) {
    const size = Math.min((n * 5) % 3 + 1, words.length - i);
    out.push({ text: `${words.slice(i, i + size).join(" ")}${i + size < words.length ? " " : ""}`, delayMs: at });
    at += lo + ((n * 37) % (hi - lo + 1));
    i += size;
    n++;
  }
  return out;
}

const bez = (e: Ease) => (e.bezier.express === "exact" || e.kind === "vawe" ? bezierText(e) : e.linear);

type Props = Record<string, string>;
const decl = (p: Props) => Object.entries(p).map(([k, v]) => `${k}: ${v};`).join(" ");
const obj = (p: Props) => `{ ${Object.entries(p).map(([k, v]) => `${k}: '${v}'`).join(", ")} }`;

function cssOf(s: Spec, ease: string, ms: number, rise: string | null): { css: string; waapi: string } {
  const play = (from: Props, to: Props, name: string, fill = "both", delay = false) => ({
    css: `@keyframes ${name} {\n  from { ${decl(from)} }\n  to { ${decl(to)} }\n}\n\n.target {\n  animation: ${name} ${ms}ms ${ease} ${fill};${delay ? `\n  animation-delay: calc(var(--i) * ${UI.row.staggerMs}ms); /* each row sets --i: 0, 1, 2 ... */` : ""}\n}`,
    waapi: delay
      ? `rows.forEach((row, i) =>\n  row.animate([${obj(from)}, ${obj(to)}], { duration: ${ms}, delay: i * ${UI.row.staggerMs}, easing: '${ease}', fill: '${fill}' }),\n);`
      : `el.animate(\n  [${obj(from)}, ${obj(to)}],\n  { duration: ${ms}, easing: '${ease}', fill: '${fill}' },\n);`,
  });
  const shown = { opacity: "0", translate: `0 ${rise}` };
  const home = { opacity: "1", translate: "0 0" };
  switch (s.kind) {
    case "rise": return play(shown, home, "rise");
    case "roll": return play(shown, home, "roll-in");
    case "stagger": return play(shown, home, "row-in", "both", true);
    case "pop": return play({ opacity: "0", translate: "48px 0" }, home, "pop-in");
    case "exit": return play(home, shown, "leave", "forwards");
    case "push": return play({ scale: "1" }, { scale: "1.2" }, "push");
    case "scan": return play({ translate: "-100% 0" }, { translate: "0 0" }, "scan");
    case "bubble": return play({ scale: "0" }, { scale: "1" }, "arrive");
    default: return { css: "", waapi: "" };
  }
}

export function jobPageBySlug(slug: string): JobPage | null {
  const s = SPECS.find((x) => x.slug === slug);
  if (!s) return null;
  const job = s.jobId ? JOBS.find((j) => j.id === s.jobId) ?? null : null;
  if (s.jobId && !job) throw new Error(`easing-jobs: no job "${s.jobId}"`);
  const ease = job ? easeBySlug(job.ease) : null;
  const also = job ? job.also.map((a) => easeBySlug(a.slug)).filter((e): e is Ease => e !== null) : [];
  const path = `/easing/for/${s.slug}`;
  const ms = s.kind === "typing" ? typingChunks().at(-1)!.delayMs + UI.typing.charMs : s.kind === "stream" ? streamChunks().at(-1)!.delayMs + UI.stream.fadeMs : raw.demoMs[s.jobId ?? "send"];
  const ez = s.kind === "bubble" ? raw.sendDemo.linear : ease ? ease.linear : "linear";
  const ezCode = s.kind === "bubble" ? raw.sendDemo.linear : ease ? bez(ease) : "";
  const { css, waapi } = cssOf(s, ezCode, ms, s.rise ?? null);

  const avoid = job ? job.avoid : s.kind === "bubble" ? "A large panel or any text block: overshoot is for small, fast arrivals of 3 to 20 px. A counter never springs." : null;
  const time = job
    ? job.time
    : s.kind === "bubble" ? `${raw.sendDemo.settleS} s to settle, overshoot ${raw.sendDemo.overshoot}%`
    : s.preset![0].value;

  const h1 =
    s.kind === "typing" ? "Typing animation speed: milliseconds per character"
    : s.kind === "stream" ? "Streaming text animation: chunk timing and fade"
    : s.kind === "bubble" ? "Send animation: the spring for a small arrival"
    : `Easing for ${s.noun}: curve, duration and what to avoid`;
  const title = `${h1.length > 58 ? h1.slice(0, h1.lastIndexOf(" ", 58)) : h1} | vawe`;

  const lead =
    ease ? `Use ${ease.name} for ${s.noun}, over ${time}.`
    : s.kind === "bubble" ? `Use a spring with stiffness ${UI.send.k} and damping ${UI.send.d} for ${s.noun}. It settles in ${raw.sendDemo.settleS} s.`
    : s.kind === "typing" ? `Type ${UI.typing.charMs} ms a character, with ${UI.typing.spaceMs} ms more after a space and ${UI.typing.jitter * 100}% jitter.`
    : `Stream a chunk of 1 to 3 words every ${UI.stream.gapMs[0]} to ${UI.stream.gapMs[1]} ms, and fade each word in over ${UI.stream.fadeMs} ms.`;
  const second =
    ease ? `${ease.name} reaches 50% of its travel at ${Math.round(ease.t50 * 100)}% of the time and 90% at ${Math.round(ease.t90 * 100)}%.`
    : s.kind === "bubble" ? `A sent bubble in a real product overshoots 11 to 14 percent; the spring gives ${raw.sendDemo.overshoot} percent.`
    : s.preset![0].measured;
  const third = avoid ? `Avoid ${rest(firstSentence(avoid))}.` : s.kind === "typing" ? "A terminal steps: it prints a character on a frame with no slide or fade." : "The text never moves and its layout is reserved.";
  const answer = smart(`${lead} ${second} ${third}`);

  const moveNames = [...new Set(s.moveJobs.flatMap((id) => MOVE_JOBS.find((j) => j.id === id)?.moves ?? []))].filter((n) => moveByName(n));
  const byEase = moveNames.length === 0 && ease ? (ease.moves ?? []).map((m) => m.name) : [];
  const lanes: Lane[] = ease || s.kind === "bubble" ? [{ label: ease?.name ?? "spring", ez }, ...(s.ref ? [{ label: "linear", ez: "linear" }] : [])] : [{ label: s.name, ez: "linear" }];

  return {
    slug: s.slug,
    kind: s.kind,
    h1,
    title,
    description: smart(`${lead} ${third}`).slice(0, 158),
    answer,
    job: s.name,
    time: smart(time),
    ease,
    also,
    avoid,
    ms,
    rise: s.rise ?? null,
    lanes,
    chunks: s.kind === "typing" ? typingChunks() : s.kind === "stream" ? streamChunks() : [],
    preset: s.preset ?? [],
    presetSource: s.preset ? UI_SOURCE : null,
    moveNames: moveNames.length ? moveNames : byEase.slice(0, 12),
    moveHeading: moveNames.length ? "Video components for this job" : ease ? `Video components that use ${ease.name}` : "Video components",
    css,
    waapi,
    path,
  };
}

export const jobPages = (): JobPage[] => JOB_SLUGS.map((s) => jobPageBySlug(s)!);

export const JOB_INDEX_TITLE = "Pick by job";

export function jobArticleSchema(p: JobPage) {
  const org = { "@type": "Organization", name: "vawe", url: SITE_URL };
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: p.h1,
    description: p.description,
    url: `${SITE_URL}${p.path}`,
    inLanguage: "en",
    datePublished: "2026-11-03",
    dateModified: "2026-11-03",
    author: org,
    publisher: org,
    about: "CSS easing and duration for a UI job",
  };
}
