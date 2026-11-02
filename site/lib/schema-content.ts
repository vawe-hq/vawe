// JSON-LD for the pages that read data (the moves and the home FAQ). The builders that need only
// package.json live in schema.ts, which quality/gates/seo-surface.mjs runs standalone.
import { clip } from "./clip";
import { MOVES, groupLabel, type Move } from "./moves";
import { moveSeoDescription } from "./move-seo";
import { groupPath } from "./content/move-groups";
import { FAQ, faqText } from "./faq";
import { breadcrumbSchema } from "./schema";
import { INSPIRATION, INSPIRATION_PATH } from "./inspiration";

const SITE_URL = "https://vawe.dev";

export function faqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: faqText(item) },
    })),
  };
}

const absolute = (url: string) => `${SITE_URL}${url.split("?")[0]}`;
const publisher = { "@type": "Organization", name: "vawe", url: SITE_URL };

// ISO 8601 duration from seconds, for a clip of a few seconds: 2 -> PT2S, 2.5 -> PT2.5S.
const isoDuration = (seconds: number) => `PT${Number(seconds.toFixed(2))}S`;

export function videoObjectSchema(m: Move) {
  const files = clip(m);
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `${m.title}: motion graphics video component`,
    description: moveSeoDescription(m),
    thumbnailUrl: [absolute(files.posterHd)],
    contentUrl: absolute(files.mp4),
    uploadDate: m.clipDate ?? m.published,
    ...(m.duration ? { duration: isoDuration(m.duration) } : {}),
    isFamilyFriendly: true,
    inLanguage: "en",
    publisher,
  };
}

export function techArticleSchema(m: Move) {
  const url = `${SITE_URL}/video-components/${m.name}`;
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: m.title,
    description: moveSeoDescription(m),
    url,
    mainEntityOfPage: url,
    image: absolute(clip(m).posterHd),
    datePublished: m.published,
    dateModified: m.modified,
    articleSection: groupLabel(m.group),
    inLanguage: "en",
    author: publisher,
    publisher,
  };
}

export function moveBreadcrumbSchema(m: Move) {
  return breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Video components", url: "/video-components" },
    { name: groupLabel(m.group), url: groupPath(m.group) },
    { name: m.title, url: `/video-components/${m.name}` },
  ]);
}

export function movesItemListSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${MOVES.length} CSS motion graphics video components`,
    url: `${SITE_URL}/video-components`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: MOVES.length,
      itemListElement: MOVES.map((m, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/video-components/${m.name}`,
        name: m.title,
      })),
    },
  };
}

// Each post is credited to its creator and its url is the X post. contentUrl is X's CDN file, only where
// the post has one; the CDN serves it to a request that sends no Referer.
// The list names the posts the page shows first, not all of them, so the JSON-LD stays a few KB.
export function inspirationSchema(opts: { name: string; description: string; count: number }) {
  const listed = INSPIRATION.slice(0, opts.count);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${INSPIRATION_PATH}`,
    publisher,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: listed.length,
      itemListElement: listed.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "VideoObject",
          name: p.title || `Video post by @${p.creator.handle}`,
          description: [p.typeLabel, p.madeWith && `made with ${p.madeWith}`, `posted on X by @${p.creator.handle}`].filter(Boolean).join(", "),
          url: p.url,
          thumbnailUrl: [absolute(p.poster)],
          ...(p.playback ? { contentUrl: p.playback } : {}),
          uploadDate: p.posted,
          duration: isoDuration(p.duration),
          author: {
            "@type": "Person",
            name: p.creator.name || `@${p.creator.handle}`,
            alternateName: `@${p.creator.handle}`,
            url: `https://x.com/${p.creator.handle}`,
          },
        },
      })),
    },
  };
}
