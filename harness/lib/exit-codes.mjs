// The exit codes of bin/vawe and of the scripts it runs, named by cause, so an agent can branch on the code without reading text.
// A script ends with `fail(code, message)`, or throws an error that carries `exitCode`; bin/vawe passes the child's code through.

export const EXIT = Object.freeze({
  OK: 0,
  ERROR: 1,
  USAGE: 2,
  CONTRACT: 3,
  BROWSER: 4,
  IO: 5,
  REFUSED: 6,
});

/** The cause each code names; 0 and 1 name none. */
export const EXIT_CAUSE = Object.freeze({
  [EXIT.USAGE]: 'bad arguments',
  [EXIT.CONTRACT]: 'page breaks the contract',
  [EXIT.BROWSER]: 'browser or render slot',
  [EXIT.IO]: 'file or IO',
  [EXIT.REFUSED]: 'refused by a gate',
});

export const EXIT_HELP = 'exit codes: 0 ok, 1 other error, 2 bad flag or argument, 3 the page breaks the contract, 4 browser or render slot, 5 file or IO, 6 refused by a gate (approval or critique missing)';

export const BROWSER_LOST = /detached Frame|Target closed|shared browser|lost its page|Protocol error \([^)]*\): (Target|Session|Connection) closed|protocolTimeout/i;

export class ExitError extends Error {
  constructor(exitCode, message) {
    super(message);
    this.exitCode = exitCode;
  }
}

const isCode = (n) => Object.values(EXIT).includes(n);

/** Print `message` to stderr and end the process with `code`. */
export function fail(code, message) {
  console.error(message);
  process.exit(code);
}

/** The code an error asks for: its own `exitCode`, else 4 for a browser that was lost or a navigation timeout, else 1. */
export function exitCodeOf(error) {
  if (isCode(error?.exitCode)) return error.exitCode;
  if (error?.name === 'TimeoutError' || BROWSER_LOST.test(String(error?.message))) return EXIT.BROWSER;
  return EXIT.ERROR;
}
