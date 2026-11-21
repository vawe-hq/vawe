import { ORG_REF, breadcrumbSchema } from "./schema";
import { SITE_URL } from "./site";
import { categoryLabel, jobValidThrough, softwareLabel, type Job, type Listing, type Profile } from "./marketplace";

// JSON-LD for the marketplace. Product and Offer per listing, Person per profile, JobPosting per job
// (https://developers.google.com/search/docs/appearance/structured-data/job-posting).

const absolute = (url: string) => (url.startsWith("http") ? url : `${SITE_URL}${url}`);
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

const person = (p: { handle: string; name: string; link?: string }) => ({
  "@type": "Person",
  name: p.name,
  url: `${SITE_URL}/creators/${p.handle}`,
  ...(p.link ? { sameAs: [p.link] } : {}),
});

export function marketplaceListSchema(items: { title: string; href: string }[], opts: { name: string; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    url: `${SITE_URL}${opts.path}`,
    publisher: ORG_REF,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: absolute(t.href), name: t.title })),
    },
  };
}

export function listingSchema(l: Listing, creator: { handle: string; name: string; link?: string }) {
  const url = `${SITE_URL}/marketplace/${l.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: l.summary,
    url,
    image: absolute(l.poster),
    category: `${softwareLabel(l.software)} template, ${categoryLabel(l.category)}`,
    ...(l.tags?.length ? { keywords: l.tags.join(", ") } : {}),
    brand: person(creator),
    subjectOf: {
      "@type": "VideoObject",
      name: `${l.title} preview`,
      description: l.summary,
      thumbnailUrl: [absolute(l.poster)],
      contentUrl: absolute(l.preview),
      uploadDate: `${l.added}T00:00:00Z`,
    },
    offers: {
      "@type": "Offer",
      price: l.price.amount,
      priceCurrency: l.price.currency,
      availability: "https://schema.org/InStock",
      url: l.url,
      seller: person(creator),
    },
  };
}

export function profileSchema(p: Profile) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${SITE_URL}/creators/${p.handle}`,
    mainEntity: {
      ...person(p),
      alternateName: p.handle,
      ...(p.avatar ? { image: absolute(p.avatar) } : {}),
      ...(p.bio ? { description: p.bio } : {}),
      jobTitle: "Motion designer",
      ...(p.designer ? { knowsAbout: p.designer.software.map(softwareLabel) } : {}),
    },
  };
}

const unitText = (unit: string) => (["HOUR", "DAY", "WEEK", "MONTH", "YEAR"].includes(unit) ? unit : null);

function baseSalary(j: Job) {
  if (!j.pay || !unitText(j.pay.unit)) return {};
  const value = j.pay.max && j.pay.max !== j.pay.min ? { minValue: j.pay.min, maxValue: j.pay.max } : { value: j.pay.min };
  return { baseSalary: { "@type": "MonetaryAmount", currency: j.pay.currency, value: { "@type": "QuantitativeValue", ...value, unitText: j.pay.unit } } };
}

const country = (code: string) => ({ "@type": "Country", name: code });

function location(j: Job) {
  const place = {
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", ...(j.city ? { addressLocality: j.city } : {}), addressCountry: j.countries[0] } },
  };
  if (j.workplace !== "remote") return place;
  return { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: j.countries.map(country) };
}

export function jobPostingSchema(j: Job) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: j.title,
    description: paragraphs(j.description).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join(""),
    datePosted: j.posted,
    validThrough: `${jobValidThrough(j)}T23:59:59Z`,
    employmentType: j.employment.length === 1 ? j.employment[0] : j.employment,
    hiringOrganization: { "@type": "Organization", name: j.company, ...(j.companyUrl ? { sameAs: j.companyUrl } : {}) },
    identifier: { "@type": "PropertyValue", name: j.company, value: j.id },
    directApply: false,
    url: `${SITE_URL}/jobs/${j.id}`,
    ...location(j),
    ...baseSalary(j),
    ...(j.software.length ? { skills: j.software.map(softwareLabel).join(", ") } : {}),
  };
}


export const marketplaceCrumbs = (items: { name: string; url: string }[]) => breadcrumbSchema([{ name: "Home", url: "/" }, ...items]);
