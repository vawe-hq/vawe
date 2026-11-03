import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { logFilesFor, parseDays, tokenMatches } from "../../../lib/bot-log-download";

// Private download of the bot log for the weekly SEO report. Every refusal is a plain 404 so the route
// is invisible; the middleware skips it, so a request here is never logged.
export const dynamic = "force-dynamic";

const hidden = () => new Response("Not found", { status: 404 });

export async function GET(req: Request) {
  if (!tokenMatches(req.headers.get("authorization"), process.env.BOT_LOG_TOKEN)) return hidden();
  const dir = process.env.BOT_LOG_DIR;
  if (!dir) return hidden();
  const days = parseDays(new URL(req.url).searchParams.get("days"));
  const names = logFilesFor(await readdir(dir).catch(() => [] as string[]), days, new Date());
  const parts = await Promise.all(names.map((n) => readFile(path.join(dir, n), "utf8")));
  return new Response(parts.map((p) => (!p || p.endsWith("\n") ? p : `${p}\n`)).join(""), {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  });
}
