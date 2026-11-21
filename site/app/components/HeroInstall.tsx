"use client";

import { useState } from "react";
import { CopyBtn } from "../easing/CopyBtn";
import { track } from "../../lib/track";

export function HeroInstall({ install, setup }: { install: { cmd: string }; setup: { prompt: string; copied: string; label: string } }) {
  const [done, setDone] = useState(false);
  const copyPrompt = () => {
    track("copy-prompt");
    void navigator.clipboard.writeText(setup.prompt).then(() => {
      setDone(true);
      window.setTimeout(() => setDone(false), 1400);
    });
  };
  return (
    <div className="lp-install">
      <div className="lp-install-row">
        <code className="lp-install-cmd">{install.cmd}</code>
        <CopyBtn className="lp-install-copy" value={install.cmd} label="Copy" action="copy-install" />
      </div>
      <button type="button" className="lp-install-agent" onClick={copyPrompt} aria-live="polite">
        {done ? setup.copied : setup.label}
      </button>
    </div>
  );
}
