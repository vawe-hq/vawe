// What a shell command does, read from its text: shared by the trace reader and the live verb-hint hook, so both agree on what a poll is.
const HEREDOC_BODY = /<<-?\s*(['"]?)(\w+)\1([^\n]*)(?:\n[\s\S]*?\n\s*\2(?=\n|$)|[\s\S]*$)/g;

export const withoutHeredocs = (cmd) => String(cmd).replace(HEREDOC_BODY, '$3');

/** The command without heredoc bodies and quoted strings, so a tool named inside a grep pattern, a message or a file being written does not count. Pure. */
export const bare = (cmd) => withoutHeredocs(cmd).replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, 'Q');

/** A regex for `name` at command position: after a separator, `do`, `then`, `else` or `!`, past env assignments and a path. */
export const atCommand = (name, after = '\\s') => new RegExp(`(?:^|[\\n;&|(\`]\\s*(?:!\\s*)?|\\$\\(|\\b(?:do|then|else)\\s+)(?:[A-Z_]+=\\S+\\s+)*(?:\\S*/)?${name}${after}`);

export const SLEEP = atCommand('sleep', '\\s+[\\d$]');
export const PS_POLL = atCommand('(?:ps\\s+(?:aux|-[a-zA-Z]+)|pgrep)', '\\b');

/** A `bin/vawe` call whose output goes into tail, head or grep: the pipe hides the exit code. */
export const VAWE_PIPED = { test: (cmd) => atCommand('vawe(?:-dev)?', '\\s(?:2>&1|[^\\n|;&])*\\|\\s*(?:tail|head|grep|egrep)\\b').test(bare(cmd)) };

/** An in-place edit with sed or perl. */
export const INPLACE_EDIT = { test: (cmd) => [atCommand('sed', '\\s+(?:-[A-Za-z]+\\s+)*(?:-i|--in-place)'), atCommand('perl', '\\s+(?:-\\S+\\s+)*-[a-zA-Z]*i')].some((re) => re.test(bare(cmd))) };

const LOOP = /\b(?:until|while)\b/;
const JOB_NAME = /\b(?:vawe|chrome|ffmpeg|render|draft|films?)\b/i;

/** A ps or pgrep that waits for a job: at command position, inside an until or while loop or naming a vawe job. A one-time `pgrep caffeinate` is not one. Takes the whole command, since a job name may sit in a quoted pattern. */
export const PS_WAIT = {
  raw: true,
  test: (cmd) => PS_POLL.test(bare(cmd)) && (LOOP.test(bare(cmd)) || JOB_NAME.test(withoutHeredocs(cmd))),
};

/** A command that waits for a job: a sleep, or a PS_WAIT. Has `test` so it works as a rule matcher. */
export const POLL = { test: (cmd) => SLEEP.test(bare(cmd)) || PS_WAIT.test(cmd) };
