// THE ONE OWNER OF SITE FACTS. The name, URL, description and contact that schema.ts, llms.txt,
// ai.txt, robots, the sitemap and the markdown pages print are read from here, never retyped.

export const SITE_NAME = "vawe";
export const SITE_ALT_NAMES = ["Vawe", "vawe.dev"];
export const SITE_URL = "https://vawe.dev";
export const ORG_URL = "https://github.com/vawe-hq";
export const REPO_URL = "https://github.com/vawe-hq/vawe";
export const SAME_AS = [REPO_URL, ORG_URL];
export const SITE_DESCRIPTION =
  "vawe is an open source framework that renders one HTML page into a video, so a developer or an AI agent can write motion graphics as code.";
export const CONTACT_URL = `${REPO_URL}/issues`;

export const absoluteUrl = (path: string) => `${SITE_URL}${path}`;
