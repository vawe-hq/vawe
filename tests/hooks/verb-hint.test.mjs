import test from 'node:test';
import assert from 'node:assert/strict';
import { hintFor, recentlyNamed } from '../../harness/live/verb-hint.mjs';

const id = (cmd) => hintFor(cmd)?.id ?? null;

test('a screenshot script or a headless chrome shot points at vawe shot', () => {
  assert.equal(id("node -e \"const pp=require('puppeteer');pp.launch()\""), 'shot');
  assert.equal(id('"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=/tmp/a.png http://localhost:3055/'), 'shot');
});

test('the screenshot advice names new --from-url, and the old advice text still counts as the same rule', () => {
  const rule = hintFor('node -e "require(\'puppeteer\')"');
  assert.match(rule.say, /bin\/vawe new --from-url <route\|url\|page\.html> --w 1440,390/);
  assert.doesNotMatch(rule.say, /bin\/vawe shot/);
  assert.match('bin/vawe shot <route|url|page.html> --w 1440,390 [--full] takes site', rule.legacy);
});

test('a curl status loop points at vawe-dev check links', () => {
  assert.equal(id('for u in /blog /moves; do curl -s -o /dev/null -w "%{http_code}\\n" localhost:3100$u; done'), 'links');
});

test('a sleep loop on a render points at vawe wait', () => {
  assert.equal(id('until grep -q "vawe: dev" out/x.log; do sleep 10; done'), 'wait');
  assert.equal(id('ps aux | grep render-page | wc -l'), 'wait');
});

test('every polling shape points at vawe wait, with the real arguments in the hint', () => {
  for (const cmd of ['sleep 5', 'sleep 1; echo waiting', 'until [ -s out/x.log ]; do sleep 2; done', 'ps aux | grep -i chrome | grep -v grep', 'pgrep -f render-page', 'until grep -q done f && ! pgrep -f x; do sleep 3; done']) assert.equal(id(cmd), 'wait', cmd);
  assert.match(hintFor('sleep 5').say, /bin\/vawe wait <page\|film>/);
});

test('a sleep that is not a poll gets no wait advice', () => {
  assert.equal(id("cat > tests/x.test.mjs <<'EOF'\nawait new Promise((r) => setTimeout(r, 5));\nsleep 5\nEOF"), null);
  assert.equal(id('echo "sleep 5 then retry"'), null);
  assert.equal(id('grep -rn "pgrep" harness/'), null);
});

test('a one-time process check that waits on nothing gets no wait advice', () => {
  for (const cmd of ['pgrep -fl caffeinate', 'ps aux | grep -i node | grep -v grep', 'ps -ef | grep nginx']) assert.equal(id(cmd), null, cmd);
});

test('an ffmpeg contact sheet and an ffmpeg frame grab point at sheet and still', () => {
  assert.equal(id('ffmpeg -i out/a.mp4 -vf "select=\'not(mod(n\\,30))\',scale=640:-1,tile=4x3" -frames:v 1 s.png'), 'sheet');
  assert.equal(id('ffmpeg -v error -y -ss 1.8 -i out/a.mp4 -frames:v 1 f.png'), 'still');
});

test('a vawe command and an unrelated command get no advice', () => {
  assert.equal(id('bin/vawe frame out/a.mp4 --at 1,2'), null);
  assert.equal(id('git status --short'), null);
  assert.equal(id('ffmpeg -i a.wav -af loudnorm b.wav'), null);
});

test('a verb is named once in the window and again after it', () => {
  assert.equal(recentlyNamed({ shot: 1000 }, 'shot', 1000 + 60000), true);
  assert.equal(recentlyNamed({ shot: 1000 }, 'shot', 1000 + 31 * 60 * 1000), false);
  assert.equal(recentlyNamed({}, 'shot', 5), false);
});

test('a bin/vawe call piped into tail, head or grep points at running it alone', () => {
  for (const cmd of ['bin/vawe dev films/a/page.html | tail -5', './bin/vawe frame out/a.mp4 --at 1 | head', 'bin/vawe check gates 2>&1 | grep FAIL']) assert.equal(id(cmd), 'pipe', cmd);
});

test('a piped command that is not a bin/vawe call gets no pipe advice', () => {
  for (const cmd of ['git log --oneline | head -5', 'bin/vawe frame out/a.mp4 --at 1', 'echo "bin/vawe dev | tail"', 'bin/vawe dev films/a/page.html; git log | head']) assert.equal(id(cmd), null, cmd);
});

test('sed -i and perl -pi point at the Edit tool', () => {
  for (const cmd of ["sed -i '' 's/a/b/' harness/x.mjs", 'sed -i.bak s/a/b/ f', 'sed -E -i s/a/b/ f', "perl -pi -e 's/a/b/' f", 'perl -i.bak -pe s/a/b/ f']) assert.equal(id(cmd), 'edit', cmd);
  assert.match(hintFor('sed -i s/a/b/ f').say, /Edit tool/);
});

test('sed and perl that do not edit in place get no edit advice', () => {
  for (const cmd of ["sed -n '1,5p' harness/x.mjs", "echo a | sed 's/a/b/'", 'perl -ne "print if /x/" f', 'echo "sed -i s/a/b/ f"', 'grep -i foo f']) assert.equal(id(cmd), null, cmd);
});

test('an ffmpeg proxy for footage points at vawe footage add', () => {
  for (const cmd of ['ffmpeg -i in.mov -g 1 -c:v libx264 films/a/footage/in.mp4', 'ffmpeg -i in.mov -intra out.mp4']) assert.equal(id(cmd), 'proxy', cmd);
});

test('an ffmpeg call no verb covers gets no advice', () => {
  for (const cmd of ['ffmpeg -i a.mp4 -c copy b.mp4', 'ffmpeg -i a.mp4 -vn -ar 48000 a.wav', 'ffmpeg -i a.mp4 -g 30 b.mp4']) assert.equal(id(cmd), null, cmd);
});

test('a sleep with a variable length points at vawe wait', () => {
  assert.equal(id('sleep $DELAY'), 'wait');
  assert.equal(id('echo sleep $DELAY'), null);
  assert.equal(id('sleep'), null);
});
