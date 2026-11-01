// The part of lib/inspiration.ts a client component may import: no data, so the bundle stays small.
import { REPO_URL } from "./schema";

export type InspirationType = { id: string; chip: string; label: string };
export type InspirationPrompt = { text: string; source: string };
export const MAKERS = ["Claude", "OpenAI", "Google", "Other", "Unknown"] as const;
export type Maker = (typeof MAKERS)[number];
export type InspirationPost = {
  id: string;
  title: string;
  creator: { name: string; handle: string };
  url: string;
  types: string[];
  tags: string[];
  maker: Maker;
  model: string[];
  prompt?: InspirationPrompt;
  poster: string;
  playback: string;
  duration: number;
  saves?: number;
  likes?: number;
  avatar?: string;
};
// What the wall needs per post. The prompt text stays out of the page and loads on demand (PROMPTS_PATH).
export type InspirationCard = Omit<InspirationPost, "prompt"> & { posted: string; typeLabel: string; madeWith: string; promptSource?: string };

export const INSPIRATION_TITLE = "Motion video inspiration: AI-made motion design | vawe";
export const INSPIRATION_DESCRIPTION =
  "Motion videos made with Claude and other AI, from posts on X. Each one credits its creator, links the post and gives a prompt to recreate it with vawe.";

export const INSPIRATION_PATH = "/inspiration";
export const INSPIRATION_PAGE = 48;
export const PROMPTS_PATH = "/inspiration/prompts.json";

export const titleOf = (p: Pick<InspirationPost, "title">) => p.title || "Post text not available";

const slugOf = (p: Pick<InspirationPost, "title" | "creator">) =>
  p.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 4).join("-") || `x-${p.creator.handle.toLowerCase()}`;

// What a reader pastes into their own agent to rebuild the post's video with vawe; the creator's prompt, when known, gives the intent.
export function recreatePrompt(p: Pick<InspirationPost, "title" | "url" | "creator" | "duration">, creatorPrompt?: string | null) {
  const name = slugOf(p);
  const page = `films/recreations/${name}/page.html`;
  const lines = [
    `Recreate this motion video with vawe (${REPO_URL}), the open-source HTML-to-video framework for coding agents: one HTML page in, one MP4 out.`,
    "",
    `Reference: ${p.url} by @${p.creator.handle}${p.duration ? `, ${Math.round(p.duration)} s` : ""}.`,
    "",
    `1. Set up: git clone ${REPO_URL} && cd vawe && npm install && npx puppeteer browsers install chrome. Run bin/vawe doctor and fix what it lists.`,
    "2. Read AGENTS.md, then skills/vawe-reference/SKILL.md. Use bin/vawe verbs, never raw ffmpeg; run bin/vawe <verb> --help before a verb's first use.",
    `3. Fetch the reference: bin/vawe refs add ${p.url} --no-measure. Its video: line is the mp4 path.`,
    `4. Start the film: bin/vawe new ${name} --ref <the mp4 path>. It writes ${page} and SPEC.md, the reference measured shot by shot.`,
    "5. Mark every SPEC.md line KEEP or CHANGE. Rebuild the page light first, then camera, type and detail.",
    `6. Draft: bin/vawe dev ${page}. Compare at the key seconds: bin/vawe frame ${page} --vs <mp4> --at <s,s,s>.`,
    `7. Loop bin/vawe critique ${page} --ref <mp4> and fix the seconds it names until it passes. Then show me the draft. Do not run bin/vawe ship before I approve.`,
    "",
    `Keep 16:9 and the reference length. The video belongs to @${p.creator.handle}: use it only as a private reference, never republish their footage.`,
  ];
  if (creatorPrompt) lines.push("", "The prompt the creator posted, for intent:", "", creatorPrompt);
  return lines.join("\n");
}
