import type { ActionName } from "./bots";

export function linkAction(href: string, siteHost: string): ActionName | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (u.hostname === "github.com" && u.pathname.startsWith("/vawe-hq/")) return "github";
  if (/(^|\.)npmjs\.com$/.test(u.hostname) && u.pathname.includes("@vawe/cli")) return "npm";
  if (u.host === siteHost && /^\/docs(\/|$)/.test(u.pathname)) return "docs";
  return null;
}
