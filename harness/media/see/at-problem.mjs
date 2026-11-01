// The one message for an --at that is not one second. Pure; harness/cli/verbs.mjs loads the -math files that import it.

/** The problem with `at` as one moment in seconds, or null. A list gets the verb that takes a list. */
export function atProblem(at) {
  if (at !== '' && Number.isFinite(Number(at)) && Number(at) >= 0) return null;
  if (/[,\s]/.test(String(at).trim())) {
    return `--at takes one second, got a list: "${at}". Run it once per second, or use bin/vawe frame <page|mp4> --at ${String(at).trim().split(/[,\s]+/).join(',')} for one tile per second`;
  }
  return `--at is not a number of seconds: "${at}"`;
}
