import { spawn } from 'node:child_process';

/** Open a file or URL in the OS default app. Never throws: a caller that prints the path still works. */
export function openFile(target) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [target]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', target]]
      : ['xdg-open', [target]];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true });
    child.on('error', () => {});
    child.unref();
  } catch { /* the printed path is enough */ }
}
