import lastmod from "../lastmod.json";
import { ABOUT } from "../content/about";
import { ALT_EVIDENCE } from "../content/alt-evidence";
import { DETERMINISM } from "../content/determinism";
import { FEATURES, FEATURES_BARS, FEATURES_SESSION } from "../content/features";
import { HOME } from "../content/home";
import { HYPERFRAMES_ALTERNATIVES } from "../content/hyperframes-alternatives";
import { LAUNCH_VIDEO } from "../content/launch-video";
import { AGENTIC_EDITING, EDIT_WITH_CLAUDE_CODE } from "../content/agentic-editing";
import { EXPLAINER, PRODUCT_SHOWCASE, type VideoTypePage } from "../content/video-types";
import { OPEN, PROBLEMS_PAGE, SOLVED, STATUS_LABEL, type Problem } from "../content/problems";
import { REMOTION_ALTERNATIVES } from "../content/remotion-alternatives";
import { RESOURCES, resourceGroups } from "../content/resources";
import { ROADMAP } from "../content/roadmap";
import { COMPARE_REMOTION_HYPERFRAMES as COMPARE } from "../content/compare";
import { GROUP_PAGES, groupFacts, groupMetaDescription, groupMetaTitle, groupPage, groupPath } from "../content/move-groups";
import { MOVES, moveByName } from "../moves";
import { RIVALS, RIVAL_BY_SLUG, VAWE_SOURCES, vsPage, type Rival } from "../content/vs";
import { WHEN_DETERMINISM } from "../content/when-determinism-matters";
import type { Block, NextBlock, Para, Section, Table } from "../content/types";
import { FAQ } from "../faq";
import { bareTitle, codeBlock, heading, item, link, table } from "./format";
import type { Doc, Entry, Renderer } from "./registry";

// Markdown for the pages whose words live in lib/content/*.ts. Each renderer reads the same data the
// HTML page renders, so a copy edit changes both.

const dates = lastmod as Record<string, string>;

function inline(p: Para): string {
  return p
    .map((s) => {
      if (typeof s === "string") return s;
      if ("text" in s) return link(s.text, s.href);
      if ("code" in s) return `\`${s.code}\``;
      return `**${s.strong}**`;
    })
    .join("");
}

const block = (b: Block) => ("p" in b ? inline(b.p) : b.ol.map((x, i) => `${i + 1}. ${inline(x)}`).join("\n"));
const cite = (c?: string) => (c ? `Source: ${c}` : "");
const join = (parts: (string | undefined | false)[]) => parts.filter(Boolean).join("\n\n");

function section(s: { title: string; blocks: Block[]; cite?: string; code?: { label: string; text: string } }, level: 2 | 3 = 2) {
  return join([heading(level, s.title), ...s.blocks.map(block), s.code && `${s.code.label}:\n\n${codeBlock(s.code.text)}`, cite(s.cite)]);
}

function tableOf(t: Table) {
  return table(t.head, t.rows.map((r) => r.cells.map(inline)));
}

function nextOf(n: NextBlock) {
  const links = [n.primary, ...(n.secondary ? [n.secondary] : []), ...(n.related ?? [])];
  return {
    body: join([heading(2, n.title), n.lead && inline(n.lead)]),
    related: links.map((l) => ({ text: l.label, path: l.href })),
  };
}

const qa = (items: { q: string; a: Para | string }[]) => items.map((x) => `${heading(3, x.q)}\n\n${typeof x.a === "string" ? x.a : inline(x.a)}`).join("\n\n");

function doc(path: string, title: string, meta: { description: string }, body: (string | undefined | false)[], next?: NextBlock): Doc {
  const n = next && nextOf(next);
  return { title, description: meta.description, updated: dates[path], body: join([...body, n?.body]), related: n?.related };
}

const entry = (path: string, meta: { title: string; description: string }, kind: Entry["kind"] = "page"): Entry => ({ path, title: bareTitle(meta.title), description: meta.description, kind, full: true });
const single = (path: string, meta: { title: string; description: string }, render: () => Doc): Renderer => ({ entries: () => [entry(path, meta)], render });

const home = single("/", { title: "vawe", description: HOME.hero.lede }, () => ({
  title: `vawe: ${HOME.hero.h1.join(" ")}`,
  description: HOME.hero.lede,
  updated: dates["/"],
  body: join([
    HOME.hero.brand,
    ...HOME.chapters.map((c) => join([heading(2, c.title), c.text])),
    join([heading(2, HOME.how.title), HOME.how.side, `${HOME.how.codeLabel} (${HOME.how.codeFile}):\n\n${codeBlock(HOME.how.code.map((c) => c.text).join(""), "html")}`, codeBlock(HOME.how.commands.map((c) => `${c.cmd}   # ${c.note}`).join("\n"), "sh")]),
    join([heading(2, HOME.moves.title), HOME.moves.shown.map((name) => item(name, `/video-components/${name}`)).join("\n"), item(HOME.moves.all.label, HOME.moves.all.href)]),
    join([heading(2, HOME.faqTitle.replace(/\.$/, "")), qa(FAQ)]),
    join([heading(2, HOME.end.title), codeBlock(HOME.end.install.map((c) => `${c.cmd}   # ${c.note}`).join("\n"), "sh")]),
  ]),
  related: [
    { text: HOME.hero.primary.label, path: HOME.hero.primary.href },
    { text: HOME.end.docs.label, path: HOME.end.docs.href },
  ],
}));

const features = single(FEATURES.path, FEATURES.meta, () =>
  doc(FEATURES.path, FEATURES.h1, FEATURES.meta, [
    FEATURES.lede,
    ...FEATURES.sections.map((s) =>
      join([
        heading(2, s.title),
        s.lead,
        s.id === "ax" && `A real agent session:\n\n${codeBlock(FEATURES_SESSION.map((x) => [`$ ${x.cmd}`, ...x.out].join("\n")).join("\n\n"), "sh")}`,
        s.id === "speed" && table(["Render", "Seconds"], FEATURES_BARS.map((b) => [b.label, b.s])),
        s.id === "speed" && inline(FEATURES.barsCaption),
        ...s.features.map((f) =>
          join([
            heading(3, f.title),
            inline(f.body),
            f.proof.kind === "code" && `${f.proof.code.label}:\n\n${codeBlock(f.proof.code.text)}`,
            f.proof.kind === "stat" && `${f.proof.n}: ${f.proof.label}`,
          ]),
        ),
      ]),
    ),
  ], FEATURES.next),
);

const resources = single(RESOURCES.path, RESOURCES.meta, () => {
  const groups = resourceGroups();
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  return {
    title: RESOURCES.h1,
    description: RESOURCES.meta.description,
    updated: dates[RESOURCES.path],
    body: join([
      RESOURCES.lede(count),
      ...groups.map((g) => join([heading(2, g.title), g.lead, g.items.map((i) => item(i.title, i.href, i.line)).join("\n")])),
    ]),
  };
});

const about = single(ABOUT.path, ABOUT.meta, () =>
  doc(ABOUT.path, ABOUT.h1, ABOUT.meta, [
    ABOUT.lede,
    ...ABOUT.sections.map((s) =>
      join([
        heading(2, s.title),
        ...(s.paragraphs ?? []).map(inline),
        s.steps && s.steps.map((x) => `- **${x.lead}** ${inline(x.line)}`).join("\n"),
        cite(s.cite),
      ]),
    ),
  ], ABOUT.next),
);

const sectionPage = (c: { path: string; meta: { title: string; description: string }; h1: string; lede: string; sections: Section[]; next: NextBlock }) =>
  single(c.path, c.meta, () => doc(c.path, c.h1, c.meta, [c.lede, ...c.sections.map((s) => section(s))], c.next));

const determinism = sectionPage(DETERMINISM);
const whenDeterminism = sectionPage(WHEN_DETERMINISM);

function problem(p: Problem) {
  return join([heading(3, `${p.id}. ${p.title} (${STATUS_LABEL[p.status]})`), `Why it is hard: ${p.why}`, `Where vawe stands: ${p.does}`, `${p.figure}: ${p.figureLabel}`]);
}

const problems = single(PROBLEMS_PAGE.path, PROBLEMS_PAGE.meta, () =>
  doc(PROBLEMS_PAGE.path, PROBLEMS_PAGE.h1, PROBLEMS_PAGE.meta, [
    PROBLEMS_PAGE.lede,
    inline(PROBLEMS_PAGE.note),
    heading(2, PROBLEMS_PAGE.solved.title),
    PROBLEMS_PAGE.solved.lead,
    ...SOLVED.map(problem),
    heading(2, PROBLEMS_PAGE.open.title),
    PROBLEMS_PAGE.open.lead,
    ...OPEN.map(problem),
  ], PROBLEMS_PAGE.next),
);

const roadmap = single(ROADMAP.path, ROADMAP.meta, () =>
  doc(ROADMAP.path, ROADMAP.h1, ROADMAP.meta, [
    ROADMAP.lede,
    inline(ROADMAP.note),
    ...ROADMAP.columns.map((c) => join([heading(2, c.title), c.lead, c.items.map((i) => `- ${i.name}: ${i.note} (problem ${i.problem})`).join("\n")])),
  ], ROADMAP.next),
);

const launchVideo = single(LAUNCH_VIDEO.path, LAUNCH_VIDEO.meta, () =>
  doc(LAUNCH_VIDEO.path, LAUNCH_VIDEO.h1, LAUNCH_VIDEO.meta, [
    LAUNCH_VIDEO.lede,
    section(LAUNCH_VIDEO.route),
    section(LAUNCH_VIDEO.beats),
    join([heading(2, LAUNCH_VIDEO.moves.title), LAUNCH_VIDEO.moves.lead, LAUNCH_VIDEO.moves.clips.map((name) => item(name, `/video-components/${name}`)).join("\n")]),
    section(LAUNCH_VIDEO.invent),
    section(LAUNCH_VIDEO.family),
  ], LAUNCH_VIDEO.next),
);

const agenticEditing = single(AGENTIC_EDITING.path, AGENTIC_EDITING.meta, () =>
  doc(AGENTIC_EDITING.path, AGENTIC_EDITING.h1, AGENTIC_EDITING.meta, [
    AGENTIC_EDITING.lede,
    section(AGENTIC_EDITING.how),
    section(AGENTIC_EDITING.reads),
    section(AGENTIC_EDITING.scope),
    join([heading(2, AGENTIC_EDITING.moves.title), AGENTIC_EDITING.moves.lead, AGENTIC_EDITING.moves.clips.map((name) => item(name, `/video-components/${name}`)).join("\n")]),
    section(AGENTIC_EDITING.more),
  ], AGENTIC_EDITING.next),
);

const editWithClaudeCode = single(EDIT_WITH_CLAUDE_CODE.path, EDIT_WITH_CLAUDE_CODE.meta, () =>
  doc(EDIT_WITH_CLAUDE_CODE.path, EDIT_WITH_CLAUDE_CODE.h1, EDIT_WITH_CLAUDE_CODE.meta, [
    EDIT_WITH_CLAUDE_CODE.lede,
    section(EDIT_WITH_CLAUDE_CODE.setup),
    section(EDIT_WITH_CLAUDE_CODE.ask),
    section(EDIT_WITH_CLAUDE_CODE.steps),
    section(EDIT_WITH_CLAUDE_CODE.questions),
    section(EDIT_WITH_CLAUDE_CODE.gotchas),
    section(EDIT_WITH_CLAUDE_CODE.more),
  ], EDIT_WITH_CLAUDE_CODE.next),
);

const videoType = (c: VideoTypePage) =>
  single(c.path, c.meta, () =>
    doc(c.path, c.h1, c.meta, [
      c.lede,
      section(c.contains),
      section(c.timing),
      join([heading(2, c.examples.title), c.examples.lead, c.examples.items.map((e) => `- [${e.title}](${e.href}) by ${e.by}`).join("\n"), item(c.examples.all.label, c.examples.all.href)]),
      join([heading(2, c.moves.title), c.moves.lead, c.moves.clips.map((name) => item(name, `/video-components/${name}`)).join("\n")]),
      section(c.make),
      heading(2, "Questions"),
      qa(c.faq),
    ], c.next),
  );

const evidence = join([
  heading(2, ALT_EVIDENCE.title),
  ALT_EVIDENCE.lead,
  ALT_EVIDENCE.items.map((e) => `- ${e.fact} ${link(e.label, e.href)}`).join("\n"),
]);

const remotionAlternatives = single(REMOTION_ALTERNATIVES.path, REMOTION_ALTERNATIVES.meta, () => {
  const r = REMOTION_ALTERNATIVES;
  return doc(r.path, r.h1, r.meta, [
    r.lede,
    r.note,
    join([heading(2, r.table.title), r.table.lead, tableOf(r.table.data)]),
    section(r.shapes),
    section(r.license),
    section(r.selfHosted),
    section(r.revideo),
    section(r.json2video),
    section(r.creatomate),
    evidence,
    heading(2, ALT_EVIDENCE.faqTitle),
    qa(r.faq),
    section(r.notCompared),
  ], r.next);
});

const hyperframesAlternatives = single(HYPERFRAMES_ALTERNATIVES.path, HYPERFRAMES_ALTERNATIVES.meta, () => {
  const h = HYPERFRAMES_ALTERNATIVES;
  return doc(h.path, h.h1, h.meta, [
    h.lede,
    h.note,
    join([heading(2, h.table.title), tableOf(h.table.data)]),
    heading(2, "Four alternatives"),
    ...h.alternatives.map((a) => join([heading(3, a.name), a.body, item(a.cta, a.href)])),
    evidence,
    heading(2, ALT_EVIDENCE.faqTitle),
    qa(h.faq),
    join([heading(2, h.stay.title), h.stay.body, h.stay.sources.map((s) => item(s.label, s.href)).join("\n")]),
  ], h.next);
});

const bullets = (items: string[]) => items.map((x) => `- ${x}`).join("\n");

function vsDoc(r: Rival): Doc {
  const v = vsPage(r);
  const n = nextOf(v.next);
  return {
    title: r.h1.replace(/\.$/, ""),
    description: r.metaDescription,
    updated: dates[v.path],
    body: join([
      r.intro,
      v.note,
      join([heading(2, v.what), r.what]),
      join([heading(2, v.chooseLabel), heading(3, v.chooseThem), bullets(r.chooseThem), heading(3, v.choosevawe), bullets(r.choosevawe)]),
      join([heading(2, v.table.title.replace(/\.$/, "")), table([v.table.feature, r.name, "vawe"], r.rows.map((x) => [x.feature, x.them, x.vawe]))]),
      join([heading(2, v.stronger.replace(/\.$/, "")), bullets(r.stronger)]),
      join([heading(2, v.faqTitle.replace(/\.$/, "")), qa(r.faq)]),
      join([heading(2, "Sources"), [...r.sources, ...VAWE_SOURCES].map((s) => item(s.label, s.url)).join("\n")]),
      n.body,
    ]),
    related: n.related,
  };
}

const vs: Renderer = {
  entries: () => RIVALS.map((r) => entry(`/vs/${r.slug}`, { title: r.metaTitle, description: r.metaDescription }, "item")),
  render: ({ slug }) => {
    const r = RIVAL_BY_SLUG[slug];
    return r ? vsDoc(r) : null;
  },
};

function compareDoc(): Doc {
  const c = COMPARE;
  const n = nextOf(c.next);
  const cell = (x: { text: string }) => x.text;
  return {
    title: c.h1.replace(/\.$/, ""),
    description: c.metaDescription,
    updated: dates[c.path],
    body: join([
      c.intro,
      c.note,
      join([heading(2, "Which one to choose"), ...c.choose.map((x) => join([heading(3, `Choose ${x.name} when`), bullets(x.items)]))]),
      join([heading(2, "Side by side"), table(["feature", "Remotion", "HyperFrames", "vawe"], c.rows.map((x) => [x.feature, cell(x.remotion), cell(x.hyperframes), cell(x.vawe)]))]),
      join([heading(2, "How each one handles time"), ...c.time.map((t) => `**${t.name}.** ${t.text}`)]),
      join([heading(2, "Where each one is stronger"), ...c.stronger.map((x) => join([heading(3, x.name), bullets(x.items)]))]),
      join([heading(2, "Questions"), qa(c.faq)]),
      join([heading(2, `Sources (read ${c.read})`), c.sources.map((x) => item(x.label, x.url)).join("\n")]),
      n.body,
    ]),
    related: n.related,
  };
}

const compare: Renderer = {
  entries: () => [entry(COMPARE.path, { title: COMPARE.metaTitle, description: COMPARE.metaDescription }, "item")],
  render: ({ slug }) => (slug === COMPARE.slug ? compareDoc() : null),
};

function groupDoc(id: string): Doc | null {
  const p = groupPage(id);
  if (!p) return null;
  const facts = groupFacts(id);
  const moves = MOVES.filter((m) => m.group === id);
  return {
    title: p.h1.replace(/\.$/, ""),
    description: groupMetaDescription(p),
    updated: dates[groupPath(id)],
    body: join([
      ...p.intro,
      `${facts.count} components, ${facts.clips} with a clip.`,
      join([heading(2, p.pickLead.replace(/\.$/, "")), table(["Component", "Use it when"], p.picks.map((x) => [link(moveByName(x.name)?.title ?? x.name, `/video-components/${x.name}`), x.when]))]),
      join([heading(2, `All ${facts.count} components in ${facts.label.toLowerCase()}`), moves.map((m) => item(m.title, `/video-components/${m.name}`, m.use)).join("\n")]),
      join([heading(2, "Rules that come with this group"), bullets(p.rules)]),
      join([heading(2, "More video components"), GROUP_PAGES.filter((o) => o.id !== id).map((o) => item(groupFacts(o.id).label, groupPath(o.id))).join("\n")]),
    ]),
    related: [...p.more.map((l) => ({ text: l.label, path: l.href })), { text: `All ${MOVES.length} video components`, path: "/video-components" }],
  };
}

const moveGroups: Renderer = {
  entries: () => GROUP_PAGES.map((p) => entry(groupPath(p.id), { title: groupMetaTitle(p), description: groupMetaDescription(p) }, "item")),
  render: ({ group }) => groupDoc(group),
};

export const CONTENT_RENDERERS: Record<string, Renderer> = {
  "/": home,
  "/features": features,
  "/resources": resources,
  "/about": about,
  "/determinism": determinism,
  "/when-determinism-matters": whenDeterminism,
  "/problems": problems,
  "/roadmap": roadmap,
  "/launch-video": launchVideo,
  [AGENTIC_EDITING.path]: agenticEditing,
  [EDIT_WITH_CLAUDE_CODE.path]: editWithClaudeCode,
  [PRODUCT_SHOWCASE.path]: videoType(PRODUCT_SHOWCASE),
  [EXPLAINER.path]: videoType(EXPLAINER),
  "/remotion-alternatives": remotionAlternatives,
  "/hyperframes-alternatives": hyperframesAlternatives,
  "/vs/[slug]": vs,
  "/compare/[slug]": compare,
  "/video-components/group/[group]": moveGroups,
};
