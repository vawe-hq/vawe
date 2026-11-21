import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { outsideRefs, templateImportProblems } from '../../harness/lib/template-imports.mjs';

test('the template folder and ../../core/ are inside', () => {
  const page = `<style>@font-face{src:url("assets/a.woff2")}</style><link href="./x.css"><script type="module">
    import { a } from '../../core/motion/presets.js';
    import './assets/stage.js';
    const m = await import('../../core/engine/x.js');
  </script><img src="assets/shot.png">`;
  assert.deepEqual(outsideRefs(page), []);
});

test('a file under assets/ reaches core/ with three levels up', () => {
  assert.deepEqual(outsideRefs(`import { a } from '../../../core/motion/presets.js';`, 'assets'), []);
  assert.deepEqual(outsideRefs(`import { a } from '../../core/motion/presets.js';`, 'assets'), ['../../core/motion/presets.js']);
});

test('prompts, assets of the repo, a sibling template and an absolute path are outside', () => {
  const page = `import a from '../../prompts/moves/a.js';
    import b from '../../assets/brand-art/cards.js';
    import c from '../other-template/page.js';
    <img src="/Users/me/shot.png"> <script src="../../harness/x.js"></script>
    @import url("../../site/x.css"); body{background:url(../../assets/bg.png)}`;
  assert.deepEqual(outsideRefs(page).sort(), ['../../assets/bg.png', '../../assets/brand-art/cards.js', '../../harness/x.js', '../../prompts/moves/a.js', '../../site/x.css', '../other-template/page.js', '/Users/me/shot.png'].sort());
});

test('a path that goes up and comes back down is judged after it resolves', () => {
  assert.deepEqual(outsideRefs(`import a from 'assets/../../../core/x.js';`), []);
  assert.deepEqual(outsideRefs(`import a from 'assets/../../prompts/x.js';`), ['assets/../../prompts/x.js']);
  assert.deepEqual(outsideRefs(`import a from '../../core/../prompts/x.js';`), ['../../core/../prompts/x.js']);
});

test('urls with a scheme, data uris, fragments and template placeholders are not paths of the repo', () => {
  const page = `<script src="https://cdn.example.com/a.js"></script><img src="data:image/png;base64,AAAA"><a href="#top"></a>
    url(\${tile.toDataURL()}) from 'the page'`;
  assert.deepEqual(outsideRefs(page), []);
});

test('a query or a fragment on a path does not hide it', () => {
  assert.deepEqual(outsideRefs(`<script src="../../prompts/a.js?v=2"></script>`), ['../../prompts/a.js?v=2']);
});

test('templateImportProblems reads the page and every html, js, mjs and css file under assets, and names the file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vawe-imports-'));
  fs.mkdirSync(path.join(dir, 'assets', 'deep'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'page.html'), `<script type="module">import a from './assets/a.js'; import b from '../../core/b.js'</script>`);
  fs.writeFileSync(path.join(dir, 'assets', 'a.js'), `import x from '../../../core/x.js';`);
  fs.writeFileSync(path.join(dir, 'assets', 'deep', 'b.mjs'), `import x from '../../../prompts/x.js';`);
  fs.writeFileSync(path.join(dir, 'assets', 'c.css'), `@import "../../../assets/brand.css";`);
  fs.writeFileSync(path.join(dir, 'assets', 'note.txt'), `import x from '../../nowhere.js';`);
  const problems = templateImportProblems(dir);
  assert.equal(problems.length, 2, problems.join('\n'));
  assert.ok(problems.some((p) => p.startsWith('assets/deep/b.mjs loads ../../../prompts/x.js')));
  assert.ok(problems.some((p) => p.startsWith('assets/c.css loads ../../../assets/brand.css')));
});

test('every template in the repo stays inside its folder and ../../core/', () => {
  const root = path.resolve(import.meta.dirname, '../../templates');
  for (const id of fs.readdirSync(root)) assert.deepEqual(templateImportProblems(path.join(root, id)), [], id);
});
