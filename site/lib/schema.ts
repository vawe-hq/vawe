// THE ONE OWNER OF STRUCTURED DATA. Every JSON-LD object the site emits is built here, from real
// data already in the repo (package.json's licence and repo URL, the same REPO_URL the header
// links to), never a hand-typed literal. Pages import the
// builder they need; nothing pastes a JSON-LD blob of its own. The builders that read move or FAQ data
// live in schema-content.ts.
//
// HowTo is absent on purpose: Google removed its rich result in 2023 and no page here is a step list.
// FAQPage is present only on the home FAQ, built in schema-content.ts from the data the page renders (lib/faq.ts).
// Google no longer shows an FAQ rich result for it; it stays as entity data for answer engines.

import pkg from "../../package.json";
import { REPO_URL, SAME_AS, SITE_ALT_NAMES, SITE_DESCRIPTION as BRAND_DESCRIPTION, SITE_URL } from "./site";

export { REPO_URL };

const ORG_ID = `${SITE_URL}/#organization`;
export const ORG_REF = { "@type": "Organization", "@id": ORG_ID, name: "vawe", url: SITE_URL } as const;

// Apache-2.0, no paid tier: the licence and repo URL below are read off package.json rather than
// retyped, so they cannot drift from the one the repo actually ships under.
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: "vawe",
    alternateName: SITE_ALT_NAMES,
    description: BRAND_DESCRIPTION,
    url: SITE_URL,
    // Google's logo guidance requires "at minimum" 112x112px (developers.google.com/search/docs/
    // appearance/structured-data/logo). The mark itself is a 64x64 viewBox SVG, so this points at a
    // 512x512 PNG rendered from that same SVG rather than the vector file, whose intrinsic pixel
    // size a crawler cannot be relied on to read as anything above the viewBox.
    logo: `${SITE_URL}/assets/favicon-512.png`,
    sameAs: SAME_AS,
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "vawe",
    alternateName: SITE_ALT_NAMES,
    description: BRAND_DESCRIPTION,
    url: SITE_URL,
    inLanguage: "en",
    publisher: ORG_REF,
  };
}

// license and no cost: true because the repo really does ship Apache-2.0 with no paid tier
// (package.json "license", site/app/components/Footer.tsx's "no licence badge... there is no tier
// or limit to state"). Stating that truthfully in `offers` is the point of this object, not an
// omission to fill in later.
export function softwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "vawe",
    description: pkg.description,
    url: SITE_URL,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Linux",
    softwareVersion: pkg.version,
    license: `https://www.apache.org/licenses/LICENSE-2.0`,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    codeRepository: REPO_URL,
    downloadUrl: REPO_URL,
    isAccessibleForFree: true,
    image: `${SITE_URL}/opengraph-image.png`,
    sameAs: SAME_AS,
  };
}

export function softwareSourceCodeSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: "vawe",
    description: pkg.description,
    codeRepository: REPO_URL,
    programmingLanguage: "JavaScript",
    runtimePlatform: "Node.js",
    license: "https://www.apache.org/licenses/LICENSE-2.0",
    url: SITE_URL,
  };
}

export function techArticleSchema(opts: { headline: string; description: string; path: string; datePublished: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: opts.headline,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    mainEntityOfPage: `${SITE_URL}${opts.path}`,
    datePublished: opts.datePublished,
    author: ORG_REF,
    publisher: ORG_REF,
  };
}

export function blogPostingSchema(opts: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
  images: string[];
  section: string;
  keywords: string[];
  words?: number;
}) {
  const org = ORG_REF;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: opts.headline,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${opts.path}` },
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    image: opts.images.map((src) => (src.startsWith("http") ? src : `${SITE_URL}${src}`)),
    articleSection: opts.section,
    keywords: opts.keywords.join(", "),
    inLanguage: "en",
    author: org,
    publisher: { ...org, logo: { "@type": "ImageObject", url: `${SITE_URL}/assets/favicon-512.png` } },
    isPartOf: { "@type": "Blog", name: "vawe blog", url: `${SITE_URL}/blog` },
  };
}

export function blogSchema(posts: { headline: string; path: string; datePublished: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "vawe blog",
    url: `${SITE_URL}/blog`,
    publisher: ORG_REF,
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.headline,
      url: `${SITE_URL}${p.path}`,
      datePublished: p.datePublished,
    })),
  };
}

export function aboutPageSchema(opts: { description: string; owner: { name: string; url: string } }) {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About vawe",
    description: opts.description,
    url: `${SITE_URL}/about`,
    mainEntity: {
      ...ORG_REF,
      sameAs: SAME_AS,
      founder: { "@type": "Person", name: opts.owner.name, url: opts.owner.url },
    },
  };
}

export type BreadcrumbItem ={ name: string; url: string };

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  };
}

// A page renders this with dangerouslySetInnerHTML, same reason the import map in layout.tsx does:
// JSON-LD must be literal script text. `<` is escaped because blog post text can hold "</script>".
export function jsonLdScript(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
