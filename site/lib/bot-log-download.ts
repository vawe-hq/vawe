import { timingSafeEqual } from "node:crypto";

export const DEFAULT_DAYS = 7;
export const MAX_DAYS = 90;

export function tokenMatches(header: string | null, token: string | undefined): boolean {
  if (!token) return false;
  const given = Buffer.from(/^Bearer (.+)$/.exec(header ?? "")?.[1] ?? "");
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

export function parseDays(raw: string | null): number {
  const n = Number(raw);
  if (raw === null || !Number.isInteger(n) || n < 1) return DEFAULT_DAYS;
  return Math.min(n, MAX_DAYS);
}

// The last `days` days including today, as the file names the logger writes.
export function logFilesFor(names: string[], days: number, now: Date): string[] {
  const first = new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return names
    .filter((n) => {
      const day = /^bots-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(n)?.[1];
      return day !== undefined && day >= first;
    })
    .sort();
}
