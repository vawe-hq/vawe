// Chrome for Testing 156.0.8078.73 fixes CVE-2026-118306 (sandbox escape), -118331, -118344 and -118348;
// puppeteer 25.16.0 ships 156.0.8078.47. Raise this, never lower it, and run `bin/vawe-dev e2e` after.
module.exports = {
  chrome: { version: '156.0.8078.80' },
  'chrome-headless-shell': { version: '156.0.8078.80' },
};
