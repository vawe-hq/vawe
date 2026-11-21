"use client";

import { useEffect, useState } from "react";
import { track } from "../../../lib/track";

// The copy buttons arrive in the generated markdown HTML (scripts/site/moves.mjs), so one delegated
// listener serves every code block instead of the page shipping the markdown twice.
export function CopyCode({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element).closest<HTMLButtonElement>("[data-copy]");
      const code = button?.closest(".mv-code")?.querySelector("pre");
      if (!button || !code) return;
      track("copy-code");
      void navigator.clipboard.writeText(code.textContent ?? "").then(
        () => flash(button, "Copied"),
        () => flash(button, "Select and copy"),
      );
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [rootId]);
  return null;
}

function flash(button: HTMLButtonElement, label: string) {
  button.textContent = label;
  button.dataset.done = "";
  window.setTimeout(() => {
    button.textContent = "Copy";
    delete button.dataset.done;
  }, 1600);
}

export function CopyMarkdown({ href }: { href: string }) {
  const [label, setLabel] = useState("Copy markdown");
  const copy = async () => {
    try {
      track("copy-markdown");
      const text = await fetch(href).then((r) => r.text());
      await navigator.clipboard.writeText(text);
      setLabel("Copied");
    } catch {
      setLabel("Open the .md and copy");
    }
    window.setTimeout(() => setLabel("Copy markdown"), 1600);
  };
  return (
    <button type="button" className="mv-copy mvd-copy" onClick={copy}>
      {label}
    </button>
  );
}
