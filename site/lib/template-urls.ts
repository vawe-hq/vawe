// URLs of one template's files, safe for a client component (lib/templates.ts reads the disk).
// The web copies carry ?v=<hash of preview.mp4>, which next.config.mjs caches for a year.
export const templateFiles = ({ id, hash }: { id: string; hash: string }) => ({
  mp4: `/templates/${id}.mp4?v=${hash}`,
  poster: `/templates/${id}.webp?v=${hash}`,
  source: `/templates/${id}.page.html`,
});
