import { brief } from './redact.mjs';

const IMAGE = /\.(?:png|jpe?g|webp|gif)$/i;
const TASK_OUTPUT = /\/tasks\/[\w-]+\.output$/;
const TOP = 5;

const before = (pageMs) => (c) => pageMs === null || c.ms < pageMs;
const ofKind = (kind) => (c) => c.lookup.kind === kind;

function rereadsOf(reads) {
  const seen = new Map();
  for (const c of reads) seen.set(c.lookup.target, (seen.get(c.lookup.target) ?? 0) + 1);
  const again = [...seen].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  return { count: again.reduce((t, [, n]) => t + n - 1, 0), top: again.slice(0, TOP).map(([target, times]) => ({ target: brief(target, 120), times })) };
}

/** How the agent found its way: lookups before the first page write, text files read again, task output read as a poll, lookups that found nothing. Pure. */
export function navigationOf(calls, pageMs) {
  const looks = calls.filter((c) => c.lookup);
  const early = looks.filter(before(pageMs));
  const reads = looks.filter(ofKind('read'));
  const textReads = reads.filter((c) => !IMAGE.test(c.lookup.target) && !TASK_OUTPUT.test(c.lookup.target));
  const rereads = rereadsOf(textReads);
  const missed = looks.filter((c) => c.lookup.missed);
  return {
    readsBeforePage: early.filter(ofKind('read')).length,
    searchesBeforePage: early.filter(ofKind('search')).length,
    reads: reads.length,
    searches: looks.length - reads.length,
    rereads: rereads.count,
    topRereads: rereads.top,
    pollReads: reads.filter((c) => TASK_OUTPUT.test(c.lookup.target)).length,
    missedReads: missed.filter(ofKind('read')).length,
    missedSearches: missed.filter(ofKind('search')).length,
    missed: missed.slice(0, TOP).map((c) => `${c.lookup.kind} ${brief(c.lookup.target, 120)}`),
  };
}
