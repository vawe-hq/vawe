import { appendBotEvent, buildActionEvent } from "../../../lib/bots";

// The beacon from lib/track.ts. The middleware skips this path, so a beacon is never logged as a page view.
export const dynamic = "force-dynamic";

const MAX_BODY = 2048;

export async function POST(req: Request) {
  const body = await req.text().catch(() => "");
  if (body.length > MAX_BODY) return new Response(null, { status: 413 });
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const event = buildActionEvent(parsed);
  if (!event) return new Response(null, { status: 400 });
  const dir = process.env.BOT_LOG_DIR;
  if (dir) await appendBotEvent(dir, event).catch(() => {});
  return new Response(null, { status: 204 });
}
