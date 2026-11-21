import {
  DESIGNERS, HIRE_DESCRIPTION, HIRE_INTRO, HIRE_TITLE, JOBS_DESCRIPTION, JOBS_INTRO, JOBS_TITLE, LISTINGS, MARKETPLACE_DESCRIPTION, MARKETPLACE_INTRO, MARKETPLACE_TITLE,
  availabilityText, categoryLabel, creatorByHandle, employmentLabel, jobById, jobValidThrough, listingById, liveJobs, marketItems, payLabel, placeLabel, priceLabel,
  profileHandles, profileOf, rateLabel, softwareLabel, storeName,
} from "../marketplace";
import { FORMS } from "../marketplace-schema.mjs";
import { formGroups } from "../marketplace-forms";
import { EMPTY, SUBMIT_PAGES } from "../marketplace-pages";
import { REPO_URL } from "../site";
import { bareTitle, heading, item, table } from "./format";
import type { Entry, Renderer } from "./registry";

const page = (path: string, title: string, description: string): Entry => ({ path, title: bareTitle(title), description, kind: "page", full: true });

const marketIndex: Renderer = {
  entries: () => [page("/marketplace", MARKETPLACE_TITLE, MARKETPLACE_DESCRIPTION)],
  render: () => {
    const items = marketItems();
    return {
      title: MARKETPLACE_TITLE,
      description: MARKETPLACE_DESCRIPTION,
      body: [
        MARKETPLACE_INTRO,
        items.length
          ? items.map((i) => item(i.title, i.href, `${softwareLabel(i.software)}, ${categoryLabel(i.category)}, ${i.price}, by ${i.by}. ${i.summary}`)).join("\n")
          : `No templates listed yet. ${EMPTY.listing}`,
      ].join("\n\n"),
      related: [{ text: "List a template", path: "/marketplace/submit" }, { text: "Motion design jobs", path: "/jobs" }, { text: "Hire a motion designer", path: "/hire" }],
    };
  },
};

const listingItem: Renderer = {
  entries: () => LISTINGS.map((l) => ({ path: `/marketplace/${l.id}`, title: l.title, description: l.summary, kind: "item", full: true })),
  render: ({ id }) => {
    const l = listingById(id);
    if (!l) return null;
    const by = creatorByHandle(l.creator)?.name ?? l.creator;
    return {
      title: l.title,
      description: l.summary,
      updated: l.added,
      body: [
        table(["Detail", "Value"], [
          ["Software", `${softwareLabel(l.software)}${l.version ? `, ${l.version}` : ""}`],
          ["Category", categoryLabel(l.category)],
          ["Price", priceLabel(l.price)],
          ["Made by", by],
          ...(l.length ? [["Length", `${l.length} s`]] : []),
          ...(l.resolution ? [["Resolution", l.resolution]] : []),
          ["Plugins", l.plugins ?? "Not stated"],
        ]),
        `Get it on ${storeName(l.url)}: ${l.url}`,
        `Preview: ${l.preview.startsWith("http") ? l.preview : `https://vawe.dev${l.preview}`}`,
      ].join("\n\n"),
      related: [{ text: `${by}’s page`, path: `/creators/${l.creator}` }, { text: "All templates", path: "/marketplace" }],
    };
  },
};

const profileItem: Renderer = {
  entries: () => profileHandles().map((h) => ({ path: `/creators/${h}`, title: profileOf(h)?.name ?? h, description: `Motion designer @${h}`, kind: "item", full: false })),
  render: ({ handle }) => {
    const p = profileOf(handle);
    if (!p) return null;
    const d = p.designer;
    return {
      title: `${p.name} (@${p.handle})`,
      description: `${p.name}, motion designer${d ? `. ${availabilityText(d)}` : ""}.`,
      updated: d?.updated,
      body: [
        p.bio ?? "",
        p.link ? `Site: ${p.link}` : "",
        ...(d ? [heading(2, "Hire"), table(["Detail", "Value"], [["Availability", availabilityText(d)], ["Rate", d.rate ? rateLabel(d.rate) : "Not stated"], ["Software", d.software.map(softwareLabel).join(", ")], ["Reel", d.reel]])] : []),
        ...(p.listings.length ? [heading(2, "Templates"), p.listings.map((l) => item(l.title, `/marketplace/${l.id}`, `${softwareLabel(l.software)}, ${priceLabel(l.price)}. ${l.summary}`)).join("\n")] : []),
      ].filter(Boolean).join("\n\n"),
      related: [{ text: "Marketplace", path: "/marketplace" }, { text: "Hire a motion designer", path: "/hire" }],
    };
  },
};

const jobsIndex: Renderer = {
  entries: () => [page("/jobs", JOBS_TITLE, JOBS_DESCRIPTION)],
  render: () => {
    const jobs = liveJobs();
    return {
      title: JOBS_TITLE,
      description: JOBS_DESCRIPTION,
      body: [
        JOBS_INTRO,
        jobs.length
          ? jobs.map((j) => item(`${j.title} at ${j.company}`, `/jobs/${j.id}`, `${placeLabel(j)}, ${j.employment.map(employmentLabel).join(", ")}${j.pay ? `, ${payLabel(j.pay)}` : ""}. Posted ${j.posted}.`)).join("\n")
          : `No open jobs right now. ${EMPTY.job}`,
      ].join("\n\n"),
      related: [{ text: "Post a job", path: "/jobs/post" }, { text: "Hire a motion designer", path: "/hire" }],
    };
  },
};

const jobItem: Renderer = {
  entries: () => liveJobs().map((j) => ({ path: `/jobs/${j.id}`, title: `${j.title} at ${j.company}`, description: placeLabel(j), kind: "item", full: true })),
  render: ({ id }) => {
    const j = jobById(id);
    if (!j) return null;
    return {
      title: `${j.title} at ${j.company}`,
      description: `${placeLabel(j)}, ${j.employment.map(employmentLabel).join(", ")}.`,
      updated: j.posted,
      body: [
        table(["Detail", "Value"], [["Company", j.company], ["Where", placeLabel(j)], ["Type", j.employment.map(employmentLabel).join(", ")], ["Pay", j.pay ? payLabel(j.pay) : "Not stated"], ["Software", j.software.map(softwareLabel).join(", ") || "Not stated"], ["Posted", j.posted], ["Closes", jobValidThrough(j)]]),
        j.description,
        `Apply: ${j.apply}`,
      ].join("\n\n"),
      related: [{ text: "All jobs", path: "/jobs" }],
    };
  },
};

const hireIndex: Renderer = {
  entries: () => [page("/hire", HIRE_TITLE, HIRE_DESCRIPTION)],
  render: () => ({
    title: HIRE_TITLE,
    description: HIRE_DESCRIPTION,
    body: [
      HIRE_INTRO,
      DESIGNERS.length
        ? DESIGNERS.map((d) => item(d.name, `/creators/${d.handle}`, `${availabilityText(d)}${d.rate ? `, ${rateLabel(d.rate)}` : ""}. ${d.software.map(softwareLabel).join(", ")}.`)).join("\n")
        : `No designers listed yet. ${EMPTY.designer}`,
    ].join("\n\n"),
    related: [{ text: "Add your profile", path: "/hire/join" }, { text: "Motion design jobs", path: "/jobs" }],
  }),
};

function submitPage(kind: keyof typeof SUBMIT_PAGES, fileKind: keyof typeof FORMS): Renderer {
  const p = SUBMIT_PAGES[kind];
  return {
    entries: () => [page(p.path, p.title, p.description)],
    render: () => ({
      title: p.title,
      description: p.description,
      body: [
        ...p.intro,
        `You can also open the pull request yourself: add a JSON file to [${p.folder}](${REPO_URL}/tree/main/${p.folder}).`,
        ...formGroups(fileKind).flatMap((g) => [heading(2, g.title), g.fields.map((f) => `- ${f.label}${f.required ? " (required)" : ""}${f.hint ? `: ${f.hint}` : ""}`).join("\n")]),
      ].join("\n\n"),
    }),
  };
}

export const MARKETPLACE_RENDERERS: Record<string, Renderer> = {
  "/marketplace": marketIndex,
  "/marketplace/submit": submitPage("listing", "listing"),
  "/marketplace/[id]": listingItem,
  "/creators/[handle]": profileItem,
  "/jobs": jobsIndex,
  "/jobs/post": submitPage("job", "job"),
  "/jobs/[id]": jobItem,
  "/hire": hireIndex,
  "/hire/join": submitPage("designer", "designer"),
};
