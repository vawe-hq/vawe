import { headers } from "next/headers";
import { logBotNotFound } from "./bots";

// Call it before notFound(). app/not-found.tsx cannot log: Next renders it inside every page's tree,
// so it runs on 200 responses too. A page that decides the URL has no content runs this only for a 404.
// The middleware skips file paths (.png, .mp4), so the caller passes the path it was given.
export async function logMissing(path: string): Promise<void> {
  logBotNotFound(await headers(), path);
}
