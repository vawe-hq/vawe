---
title: "Puppeteer, --no-sandbox and an old Chrome: a security audit of a video renderer"
description: "Our renderer ran Chrome 131 with the sandbox off. What four open-source scanners and a code review found, what we fixed, and a checklist for any tool that drives headless Chrome."
date: 2026-11-03
updated: 2026-11-03
section: rendering
topic: rendering
docs: determinism, agents
tags: "security, headless chrome, puppeteer, no-sandbox, trivy, cve"
keywords: "puppeteer no-sandbox security, headless chrome sandbox, puppeteer chromium cve, playwright chromium vulnerability, chrome for testing pin version, localhost csrf dev server"
---

A post went around on 2 November: Playwright 1.64.1, the newest release, ships Chromium 156.0.8078.4, which has four critical holes, and Playwright turns the sandbox off. We do not use Playwright. We use Puppeteer, and when we looked, our renderer was in a worse state: Chrome 131 from December 2024, with `--no-sandbox` on every render.

[vawe](https://github.com/vawe-hq/vawe) turns an HTML page into an MP4 with headless Chrome. Agents run it on a developer's laptop, and one command, `vawe new --from-url`, opens any website the person names. So the browser is a real way into the machine. This post lists what we found and what we changed, with the versions, so you can check your own tool.

## The four CVEs

All four are in Chrome and are fixed in 156.0.8078.73. In each one the attack is a web page built for it.

| CVE | Part of Chrome | What a crafted page can do | CVSS |
| --- | --- | --- | --- |
| CVE-2026-118306 | FileSystem | run code outside the sandbox | 9.6 |
| CVE-2026-118331 | FileAPI | run code inside the sandbox | 8.8 |
| CVE-2026-118344 | Layout (use after free) | run code in the tab | 8.8 |
| CVE-2026-118348 | Skia | run code in the tab | 8.8 |

An attack on a browser usually takes two steps: get code running in the tab, then escape the sandbox. The three 8.8 holes give the first step. The sandbox stops them there. CVE-2026-118306 does both steps alone, which is why it scores 9.6. With `--no-sandbox`, all four act like the 9.6 one, because no second step is needed.

## 1. Upgrading Puppeteer did not fix it

We expected one `npm install`. The newest Puppeteer, 25.16.0 from 22 October, ships Chrome 156.0.8078.47. That is version 156, but an early build, before the fix. A tool that bundles a browser freezes one build, and "we are on 156" says nothing about the patch.

Google publishes builds for automation tools as Chrome for Testing. Its stable build was 156.0.8078.80, so we pinned that in `.puppeteerrc.cjs`:

```js
module.exports = {
  chrome: { version: '156.0.8078.80' },
  'chrome-headless-shell': { version: '156.0.8078.80' },
};
```

Two surprises came with the upgrade:

- **The pin worked only from the repo folder.** Puppeteer looks for `.puppeteerrc.cjs` from the current folder upward. Our tests render from a temporary folder, so there Puppeteer asked for its own older Chrome and failed. One loader now reads the pin by its full path and passes it as `PUPPETEER_CHROME_VERSION` before Puppeteer loads. The version still lives in one file.
- **`executablePath()` became async in Puppeteer 25.** Our setup check called `fs.existsSync(puppeteer.executablePath())`. It got a promise, not a path, and reported "no Chrome" on a machine that had one.

## 2. The sandbox goes back on

`--no-sandbox` came in for CI. Chrome cannot start its sandbox on many Linux runners and in containers. On a Mac it gives nothing and removes the second wall. The flag now applies on Linux only:

```js
export const SANDBOX_ARGS = process.platform === 'linux' ? ['--no-sandbox'] : [];
```

We were afraid this would change pixels, because vawe promises the same frame for the same page. It did not. The end-to-end suite renders the example films and the test pages, and it passed with the sandbox on.

## 3. Four scanners

We ran four open-source scanners over the repo and the docs site, plus [AgentShield](https://github.com/affaan-m/agentshield) over the agent setup.

| Tool | What it checks | What it found |
| --- | --- | --- |
| Trivy 0.76.1 | known CVEs in lock files and images, secrets, config | renderer: 0 CVEs. Docs site: 18 HIGH or CRITICAL. Base image: 10 HIGH |
| OSV-Scanner 2.7.0 | lock files against Google's OSV database | the same picture as Trivy |
| Gitleaks 8.30.1 | secrets in all 7,594 commits | 69 hits, all false: GitHub repo names in a research file, and a fake key in a test |
| Semgrep 1.183.0 | unsafe code patterns, CI files | 9 GitHub Actions on movable tags |
| AgentShield | hooks, permissions and agents in `.claude/` | grade A, 100 of 100 |

Three of these led to changes:

- **The docs site ran Next.js 16.2.10**, with five critical advisories, among them unauthenticated remote code execution in the image optimizer. Next.js 16.4.4 fixes all 18 findings and brings sharp 0.35.5 too.
- **All 10 image CVEs were in npm**, inside `node:22-alpine`. The running server is `node server.js` and never calls npm, so the final image now deletes it. That was faster than waiting for a new base image.
- **The Actions now point at commit hashes,** the workflows get a read-only token, and a weekly Trivy job catches CVEs that are published after a commit.

## 4. What the scanners could not see

Scanners know about published holes in other people's code. A review of our own code found the worst problem, which no scanner could have found.

`vawe dev --studio` runs a small editor on `127.0.0.1:8799`. Its POST routes changed the film page and could start an agent session. They did not check where a request came from. A browser sends a cross-site POST with a `text/plain` body without asking first, and the server parsed JSON whatever the content type. So any website open in the same browser could write a script into the page.

The fix is two checks in the one function that serves every local page:

```js
export function localRequest(req, port) {
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!hosts.includes(req.headers.host)) return false;
  const origin = req.headers.origin;
  return origin === undefined || hosts.some((h) => origin === `http://${h}`);
}
```

The Host check stops DNS rebinding, where a hostile domain points itself at 127.0.0.1. The Origin check stops the cross-site POST, because browsers send `Origin` on every POST. Our own tools send no `Origin`, so they still work. A test sends each attack to a real server and expects 403.

The same review found three smaller problems:

- An `?aspect=` value went into an inline script unescaped. It must now match `W:H`.
- A request for `/%` crashed the server. It now gets a 400.
- A site opened with `--from-url` could reach other local servers from inside the capture browser. When the target is outside, requests to loopback and private addresses are dropped.

## A checklist for any tool that drives headless Chrome

1. **Read the build number, not the major version.** Compare the bundled build with the "fixed in" line of each Chrome advisory.
2. **Pin a Chrome for Testing build** when your library lags behind, and check that the pin applies from every folder your tool runs in.
3. **Keep the sandbox on.** Turn it off only where Chrome cannot start it, and only there.
4. **Check Host and Origin on every local server.** `127.0.0.1` keeps other machines out. Your own browser can still reach it.
5. **Remove what the runtime image does not run,** such as npm.
6. **Scan on a schedule.** A lock file that passed last week can fail today.

The changes are in vawe's main branch: the Chrome pin and sandbox in one commit, the local server checks and the CI jobs in the next. If you find a hole, open an issue on [GitHub](https://github.com/vawe-hq/vawe).
