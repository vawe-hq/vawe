import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newest, routeSources } from '../../scripts/site/route-sources.mjs';

test('a page takes the lib/content modules it imports, and only those', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'routesrc-'));
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
    return path.join(dir, rel);
  };
  const page = write('site/app/x/page.tsx', 'import { A } from "../../lib/content/a";\nimport { H } from "../components/Header";');
  const a = write('site/lib/content/a.ts', 'import { B } from "./b";');
  const b = write('site/lib/content/b.ts', 'export const B = 1;');
  write('site/app/components/Header.tsx', 'import { Z } from "../../lib/content/z";');
  write('site/lib/content/z.ts', 'export const Z = 1;');
  assert.deepEqual(routeSources(page).sort(), [page, a, b].sort());
});

test('newest picks the latest date and ignores nulls', () => {
  assert.equal(newest(['2026-10-01', null, '2026-11-03']), '2026-11-03');
  assert.equal(newest([null]), null);
});
