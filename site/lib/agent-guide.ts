import fs from "node:fs";
import path from "node:path";

export const AGENTS_TITLE = "AI agent video generation: HTML to video with vawe";
export const AGENTS_DESCRIPTION =
  "AI agent video generation with vawe: the agent writes one HTML page, one command renders it to MP4, and a fresh session reviews the film.";

export const agentGuide = () => fs.readFileSync(path.join(process.cwd(), "content/agent-guide.md"), "utf8");
