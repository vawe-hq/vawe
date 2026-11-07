// Writes studio edits to the page file, and keeps them only when `check` (reading the edited page back) accepts the result.
import fs from 'node:fs';
import { applyEdits } from './page-source.mjs';

/** The studio's writer for one page. Each undo step keeps the page before and after its edit, so undo refuses once anything else changed the file. */
export function createEditor(file) {
  const steps = [];
  let queue = Promise.resolve();
  // A rejected save restores the page it read, which would also erase a write made while its check ran.
  const oneAtATime = (fn) => {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  };

  /** The result of check() on the edited page. A page the check rejects is restored and the error rethrown, so a rejected edit leaves no file change and no undo step. */
  const save = (edits, check) => oneAtATime(async () => {
    const before = fs.readFileSync(file, 'utf8');
    const after = applyEdits(before, edits);
    if (after === before) return check();
    fs.writeFileSync(file, after);
    try {
      const result = await check();
      steps.push({ before, after });
      return result;
    } catch (e) {
      fs.writeFileSync(file, before);
      throw e;
    }
  });

  const undo = () => oneAtATime(() => {
    const step = steps.at(-1);
    if (!step) throw new Error('nothing to undo');
    if (fs.readFileSync(file, 'utf8') !== step.after) {
      steps.length = 0;
      throw new Error('the page changed after the last studio edit, so undo would erase that change; the undo steps are cleared');
    }
    steps.pop();
    fs.writeFileSync(file, step.before);
  });

  return { save, undo, depth: () => steps.length };
}
