import { lookup } from "node:dns/promises";
import { RateLimiter, handleSubmit } from "../../../../lib/marketplace-submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = new RateLimiter(5, 60 * 60 * 1000);
const resolve = async (host: string) => (await lookup(host, { all: true })).map((a) => a.address);

export async function POST(req: Request) {
  const { MARKETPLACE_GITHUB_TOKEN, MARKETPLACE_REPO } = process.env;
  return handleSubmit(req, { MARKETPLACE_GITHUB_TOKEN, MARKETPLACE_REPO }, { fetch, lookup: resolve, limiter });
}
