// The one owner of bot classification and the bot log event. Pure except appendBotEvent, which needs
// Node's fs: call logBotRequest from a middleware that declares `runtime: "nodejs"`.
//
// UA tokens come from the vendors' docs (developers.openai.com/api/docs/bots, the Anthropic crawler
// page, docs.perplexity.ai/guides/bots). Coding-agent fingerprints come from arxiv.org/abs/2604.02544
// (HTTP traces of nine agents). Unknown on purpose: Codex CLI and Gemini CLI (no published UA), and
// Cline, Junie and Antigravity, whose UAs (curl/8.4.0, Go-http-client/2.0) are too generic to claim.

export type BotClass =
  | "ai-training"
  | "ai-search"
  | "ai-user-fetch"
  | "coding-agent"
  | "search-engine"
  | "ai-referral"
  | "other";

export type Classified = { class: BotClass; bot: string };

type Rule = { bot: string; class: BotClass; ua?: RegExp; accept?: RegExp };

// First match wins: put the longer token before its prefix (Applebot-Extended before Applebot).
export const BOT_TABLE: Rule[] = [
  { bot: "GPTBot", class: "ai-training", ua: /GPTBot/i },
  { bot: "ClaudeBot", class: "ai-training", ua: /ClaudeBot/i },
  { bot: "CCBot", class: "ai-training", ua: /CCBot/i },
  { bot: "Google-Extended", class: "ai-training", ua: /Google-Extended/i },
  { bot: "Applebot-Extended", class: "ai-training", ua: /Applebot-Extended/i },
  { bot: "Bytespider", class: "ai-training", ua: /Bytespider/i },
  { bot: "meta-externalagent", class: "ai-training", ua: /meta-externalagent/i },
  { bot: "FacebookBot", class: "ai-training", ua: /FacebookBot/i },
  { bot: "Amazonbot", class: "ai-training", ua: /Amazonbot/i },
  { bot: "cohere-ai", class: "ai-training", ua: /cohere-(ai|training-data-crawler)/i },
  { bot: "Diffbot", class: "ai-training", ua: /Diffbot/i },
  { bot: "omgili", class: "ai-training", ua: /omgili/i },
  { bot: "ImagesiftBot", class: "ai-training", ua: /ImagesiftBot/i },

  { bot: "OAI-SearchBot", class: "ai-search", ua: /OAI-SearchBot/i },
  { bot: "Claude-SearchBot", class: "ai-search", ua: /Claude-SearchBot/i },
  { bot: "PerplexityBot", class: "ai-search", ua: /PerplexityBot/i },
  { bot: "DuckAssistBot", class: "ai-search", ua: /DuckAssistBot/i },
  { bot: "YouBot", class: "ai-search", ua: /YouBot/i },

  { bot: "ChatGPT-User", class: "ai-user-fetch", ua: /ChatGPT-User/i },
  { bot: "Claude-User", class: "ai-user-fetch", ua: /Claude-User/i },
  { bot: "Perplexity-User", class: "ai-user-fetch", ua: /Perplexity-User/i },
  { bot: "MistralAI-User", class: "ai-user-fetch", ua: /MistralAI-User/i },
  { bot: "meta-externalfetcher", class: "ai-user-fetch", ua: /meta-externalfetcher/i },

  { bot: "claude-code", class: "coding-agent", ua: /^claude-code\//i },
  { bot: "claude-code", class: "coding-agent", ua: /^axios\/1\.8\.4$/ },
  { bot: "cursor", class: "coding-agent", ua: /^got \(https:\/\/github\.com\/sindresorhus\/got\)/ },
  { bot: "windsurf", class: "coding-agent", ua: /^colly - https:\/\/github\.com\/gocolly\/colly/ },
  { bot: "aider", class: "coding-agent", ua: /Aider\/\d/ },
  {
    bot: "opencode",
    class: "coding-agent",
    ua: /Chrome\//,
    accept: /^text\/html;q=1\.0, application\/xhtml\+xml;q=0\.9, text\/plain;q=0\.8, text\/markdown;q=0\.7/,
  },

  { bot: "Googlebot", class: "search-engine", ua: /Googlebot|Google-InspectionTool|GoogleOther/i },
  { bot: "Bingbot", class: "search-engine", ua: /bingbot|BingPreview/i },
  { bot: "Applebot", class: "search-engine", ua: /Applebot/i },
  { bot: "DuckDuckBot", class: "search-engine", ua: /DuckDuckBot/i },
  { bot: "YandexBot", class: "search-engine", ua: /YandexBot/i },
  { bot: "Baiduspider", class: "search-engine", ua: /Baiduspider/i },
  { bot: "Slurp", class: "search-engine", ua: /Slurp/i },
];

export const AI_REFERRER_HOSTS: Record<string, string> = {
  "chatgpt.com": "chatgpt",
  "chat.openai.com": "chatgpt",
  "perplexity.ai": "perplexity",
  "www.perplexity.ai": "perplexity",
  "gemini.google.com": "gemini",
  "copilot.microsoft.com": "copilot",
  "claude.ai": "claude",
};

export type RequestFacts = {
  userAgent?: string | null;
  referer?: string | null;
  accept?: string | null;
  utmSource?: string | null;
};

export function refererHost(referer?: string | null): string {
  if (!referer) return "";
  try {
    return new URL(referer).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function wantsMarkdown(accept?: string | null): boolean {
  return /text\/markdown/i.test(accept ?? "");
}

export function classifyRequest(r: RequestFacts): Classified {
  const ua = r.userAgent ?? "";
  const accept = r.accept ?? "";
  for (const rule of BOT_TABLE) {
    if (rule.ua && !rule.ua.test(ua)) continue;
    if (rule.accept && !rule.accept.test(accept)) continue;
    return { class: rule.class, bot: rule.bot };
  }
  const bot = AI_REFERRER_HOSTS[refererHost(r.referer)] ?? (/^chatgpt\.com$/i.test(r.utmSource ?? "") ? "chatgpt" : "");
  return bot ? { class: "ai-referral", bot } : { class: "other", bot: "" };
}

export type BotEvent = {
  t: string;
  class: BotClass;
  bot: string;
  path: string;
  status?: number;
  served: "html" | "md";
  wantsMd: boolean;
  refHost: string;
  ip?: string;
};

export type EventInput = RequestFacts & {
  path: string;
  ip?: string | null;
  status?: number;
  served?: "html" | "md";
  now?: Date;
};

// A human who arrives from an AI answer is logged without an IP; only the bot classes keep one.
// Coding agents run on a person's machine, so their IP is a person's IP and is never kept.
const KEEPS_IP: ReadonlySet<BotClass> = new Set(["ai-training", "ai-search", "ai-user-fetch", "search-engine"]);

// Any client can send a bot's User-Agent, so the log bounds what one request and one day may write.
const MAX_PATH = 512;
const MAX_DAY_BYTES = 50 * 1024 * 1024;

export function buildBotEvent(i: EventInput): BotEvent | null {
  const c = classifyRequest(i);
  if (c.class === "other") return null;
  const event: BotEvent = {
    t: (i.now ?? new Date()).toISOString(),
    class: c.class,
    bot: c.bot,
    path: i.path.slice(0, MAX_PATH),
    served: i.served ?? (i.path.endsWith(".md") ? "md" : "html"),
    wantsMd: wantsMarkdown(i.accept),
    refHost: refererHost(i.referer),
  };
  if (i.status !== undefined) event.status = i.status;
  if (KEEPS_IP.has(c.class) && i.ip) event.ip = i.ip;
  return event;
}

const RETENTION_DAYS = 90;

async function pruneOldLogs(dir: string, today: string): Promise<void> {
  const { readdir, unlink } = await import("node:fs/promises");
  const path = await import("node:path");
  const cutoff = new Date(Date.parse(today) - RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (const name of await readdir(dir)) {
    const day = /^bots-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(name)?.[1];
    if (day && day < cutoff) await unlink(path.join(dir, name)).catch(() => {});
  }
}

export async function appendBotEvent(dir: string, event: BotEvent): Promise<void> {
  const { appendFile, mkdir, stat } = await import("node:fs/promises");
  const path = await import("node:path");
  await mkdir(dir, { recursive: true });
  const day = event.t.slice(0, 10);
  const file = path.join(dir, `bots-${day}.jsonl`);
  const size = await stat(file).then((s) => s.size, () => -1);
  if (size > MAX_DAY_BYTES) return;
  const firstOfDay = size === -1;
  await appendFile(file, JSON.stringify(event) + "\n");
  if (firstOfDay) await pruneOldLogs(dir, day).catch(() => {});
}

type MiddlewareRequest = {
  headers: { get(name: string): string | null };
  nextUrl: { pathname: string; searchParams: { get(name: string): string | null } };
};

// Fire and forget: the response never waits on the disk, and a failed write must not break a page.
// The proxy sets x-real-ip or x-forwarded-for; a spoofed value only makes a bot read as unverified.
export function logBotRequest(req: MiddlewareRequest, served?: "html" | "md", status?: number): void {
  const dir = process.env.BOT_LOG_DIR;
  if (!dir) return;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const event = buildBotEvent({
    userAgent: req.headers.get("user-agent"),
    referer: req.headers.get("referer"),
    accept: req.headers.get("accept"),
    utmSource: req.nextUrl.searchParams.get("utm_source"),
    ip: req.headers.get("x-real-ip") ?? forwarded,
    path: req.nextUrl.pathname,
    served,
    status,
  });
  if (event) appendBotEvent(dir, event).catch(() => {});
}

// The middleware cannot see the status; lib/missing.ts can. It logs a second line for the same request,
// which the report counts under 404s and not as another hit. The middleware passes the path in x-bot-path.
export function logBotNotFound(headers: { get(name: string): string | null }, path = ""): void {
  logBotRequest({ headers, nextUrl: { pathname: headers.get("x-bot-path") ?? path, searchParams: { get: () => null } } }, "html", 404);
}
