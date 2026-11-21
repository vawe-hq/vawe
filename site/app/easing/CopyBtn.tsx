"use client";

import { useState } from "react";
import type { ActionName } from "../../lib/bots";
import { track } from "../../lib/track";

export function CopyBtn({ value, label, className = "ez-chip", action = "copy-code" }: { value: string; label: string; className?: string; action?: ActionName }) {
  const [text, setText] = useState(label);
  const flash = (t: string) => {
    setText(t);
    window.setTimeout(() => setText(label), 1400);
  };
  return (
    <button type="button" className={className} onClick={() => { track(action); void navigator.clipboard.writeText(value).then(() => flash("Copied"), () => flash("Select and copy")); }}>
      {text}
    </button>
  );
}
