// A blog post's front matter: the parser, the sections and the share-card topics. lib/blog.ts reads posts through it;
// scripts/site/og-cards.mjs reads it to render each post's card, so both see one front matter.

export const SECTIONS = /** @type {const} */ ([
  { id: "how-to", label: "How-to", intro: "Step-by-step guides that end with a file you can run: render HTML to a video, export an animation, drive vawe from an agent." },
  { id: "rendering", label: "Rendering", intro: "Headless Chrome, Puppeteer, speed and repeatable frames: what broke when we rendered a page to video, and what fixed it." },
  { id: "agents", label: "Agents", intro: "What an AI agent gets wrong on its own, and the commands, defaults, checks and judges that make it succeed." },
  { id: "motion-sound", label: "Motion and sound", intro: "Easing, transitions, blur, depth and audio: how we turned a good film into measured rules." },
]);

// The `topic` a post names picks its share card's scene; each one is a key of TOPICS in assets/brand-art/cards.js.
export const TOPICS = /** @type {const} */ (["agents", "determinism", "rendering", "audio", "motion", "watching", "how-to", "site"]);

/** @param {string} raw */
function unquote(raw) {
  const v = raw.trim();
  const q = v[0];
  if (q === '"' || q === "'") {
    const end = v.lastIndexOf(q);
    if (end > 0) return v.slice(1, end).replace(/\\"/g, '"');
  }
  return v.replace(/\s+#.*$/, "").trim();
}

/**
 * The key: value lines between the --- fences, and the Markdown after them. Throws, naming the file, on a malformed head.
 * @param {string} file
 * @param {string} src
 * @returns {{ data: Record<string, string>, body: string }}
 */
export function parseFrontMatter(file, src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) throw new Error(`content/blog/${file}: no front matter between --- fences`);
  /** @type {Record<string, string>} */
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const i = line.indexOf(":");
    if (i < 1) throw new Error(`content/blog/${file}: front matter line is not "key: value": ${line}`);
    data[line.slice(0, i).trim()] = unquote(line.slice(i + 1));
  }
  return { data, body: m[2] };
}

// The docs pages a post points to, as titles for the link text. The pages live in the docs repo, so a slug that is not here
// gets a title made from the slug, and quality/gates/seo-surface.mjs warns when the docs repo has no such page.
const DOC_TITLES = {
  agents: "Use with an agent", "aspect-ratios": "Aspect ratios", audio: "Audio", "backgrounds-and-images": "Backgrounds and images",
  "batch-from-data": "Batch from data", "brand-reflection": "Brand reflection", brief: "Write the brief", cli: "CLI",
  critique: "Critique and fix", "cut-to-the-beat": "Cut to the beat", "design-kit": "Design system and kit", determinism: "Determinism",
  draft: "Draft", faq: "FAQ", "files-and-outputs": "Files and outputs", "html-to-mp4-with-claude-code": "HTML to MP4 with Claude Code",
  "image-to-particles": "Image to particles", "key-frames": "Key frames and the board", "kinetic-type": "Kinetic type",
  "launch-video": "Launch video", "lens-and-effects": "Lens and effects", "loudness-and-the-mix": "Loudness and the mix",
  "motion-blur": "Motion blur", "motion-pass": "Motion pass", motion: "Motion", moves: "Moves", "page-api": "Page API",
  platforms: "Video specs by platform", "product-ui": "Product UI", "quality-gates": "Checks", quickstart: "Quickstart",
  recipes: "Recipes", references: "Study references", "render-flags": "Render flags", ship: "Ship", templates: "Templates",
  "text-and-fonts": "Text and fonts", "the-page": "The page", "three-and-canvas": "Three.js and canvas", "time-and-seek": "Time and seek",
  transitions: "Transitions", troubleshooting: "When it looks wrong", "vertical-social": "Vertical social",
  "video-from-code": "Make a video from code", waivers: "Waivers", worlds: "Worlds",
};

/**
 * The `docs:` line of a post: 1 to 3 docs page slugs, comma separated. Throws, naming the file, on a malformed list.
 * @param {string} file
 * @param {Record<string, string>} data
 * @returns {{ slug: string, title: string }[]}
 */
export function docsLinks(file, data) {
  const slugs = (data.docs ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (slugs.length > 3) throw new Error(`content/blog/${file}: docs lists ${slugs.length} pages, the most is 3`);
  for (const s of slugs) if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) throw new Error(`content/blog/${file}: docs slug "${s}" must be lowercase words joined by hyphens`);
  return slugs.map((slug) => ({ slug, title: DOC_TITLES[slug] ?? slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) }));
}
