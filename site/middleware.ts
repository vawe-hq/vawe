import { NextResponse, type NextRequest } from "next/server";
import { logBotRequest } from "./lib/bots";
import { DESCRIBEDBY_LINK, prefersMarkdown } from "./lib/md/http";
import { DOCS_ORIGIN } from "./lib/docs-origin.mjs";
import { isExcluded, isRendered, pathOfMdUrl } from "./lib/md/routes.mjs";
import { absoluteUrl } from "./lib/site";

// Markdown for agents. /<page>.md and `Accept: text/markdown` both rewrite to the one handler
// (app/api/md/[...path]/route.ts). Negotiation is limited to the pages in lib/md/routes.mjs. A .md URL
// that no page owns still goes to the handler, so it answers with a markdown 404 and never HTML.
//
// The middleware also logs every bot request (lib/bots.ts), so the matcher takes the data files and the
// docs too; the markdown rewrite never applies to them (isExcluded).

const MOVE_FILE = /^\/moves\/([a-z0-9-]+)\.md$/;

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/|assets/|.*\\.(?:png|jpe?g|webp|gif|svg|ico|mp4|webm|woff2?|css|js|map)$).*)"],
};

// The 404 page cannot see the URL, so the middleware hands it the path.
function withPath(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-bot-path", req.nextUrl.pathname);
  return headers;
}

function toHandler(req: NextRequest, mdPath: string, negotiated: boolean) {
  const url = req.nextUrl.clone();
  url.pathname = `/api/md/${mdPath === "/" ? "index" : mdPath.slice(1)}`;
  const headers = withPath(req);
  if (negotiated) headers.set("x-md-negotiated", "1");
  return NextResponse.rewrite(url, { request: { headers } });
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/api/bot-log") return NextResponse.next();

  const move = MOVE_FILE.exec(pathname);
  if (move) {
    logBotRequest(req, "md");
    const res = NextResponse.next({ request: { headers: withPath(req) } });
    res.headers.set("Link", `<${absoluteUrl(`/video-components/${move[1]}`)}>; rel="canonical"`);
    return res;
  }
  if (pathname === "/docs.md") {
    logBotRequest(req, "md");
    return NextResponse.rewrite(new URL("/docs/index.md", DOCS_ORIGIN));
  }
  if (isExcluded(pathname)) {
    logBotRequest(req, pathname.endsWith(".md") || prefersMarkdown(req.headers.get("accept")) ? "md" : "html");
    return NextResponse.next({ request: { headers: withPath(req) } });
  }

  const mdPath = pathOfMdUrl(pathname);
  if (mdPath !== null) {
    logBotRequest(req, "md");
    return toHandler(req, mdPath, false);
  }

  if (isRendered(pathname) && prefersMarkdown(req.headers.get("accept"))) {
    logBotRequest(req, "md");
    return toHandler(req, pathname, true);
  }

  logBotRequest(req, "html");
  const res = NextResponse.next({ request: { headers: withPath(req) } });
  res.headers.set("Link", DESCRIBEDBY_LINK);
  if (isRendered(pathname)) res.headers.set("Vary", "Accept");
  return res;
}
