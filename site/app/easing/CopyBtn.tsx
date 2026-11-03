"use client";

import { useState } from "react";

export function CopyBtn({ value, label, className = "ez-chip" }: { value: string; label: string; className?: string }) {
  const [text, setText] = useState(label);
  const flash = (t: string) => {
    setText(t);
    window.setTimeout(() => setText(label), 1400);
  };
  return (
    <button type="button" className={className} onClick={() => void navigator.clipboard.writeText(value).then(() => flash("Copied"), () => flash("Select and copy"))}>
      {text}
    </button>
  );
}
