"use client";

import { useState } from "react";

export function CopyCommand({ command, label = "Terminal" }: { command: string; label?: string }) {
  const [text, setText] = useState("Copy");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setText("Copied");
    } catch {
      setText("Select and copy");
    }
    window.setTimeout(() => setText("Copy"), 1600);
  };
  return (
    <div className="mv-code tpl-cmd">
      <div className="mv-code-bar">
        <span>{label}</span>
        <button type="button" className="mv-copy" onClick={copy}>{text}</button>
      </div>
      <pre><code>{command}</code></pre>
    </div>
  );
}
