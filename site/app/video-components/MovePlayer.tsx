"use client";

import { Clip } from "../components/Clip";
import { clip, type ClipRef, type Theme } from "../../lib/clip";
import { ThemeToggle, useClipTheme } from "./ThemeToggle";
import { StageBar } from "./[name]/StageBar";

export function MovePlayer({ move, alt, duration }: { move: ClipRef & { theme: Theme }; alt: string; duration: number | null }) {
  const [theme, setTheme] = useClipTheme();
  const files = clip(move, theme);
  return (
    <>
      <div className="mvd-stage">
        <img src={files.posterHd} alt={alt} width={1280} height={720} fetchPriority="high" decoding="async" />
        <Clip key={files.mp4} src={files.mp4} poster={files.posterHd} />
        {move.variant ? <ThemeToggle shown={theme ?? move.theme} onChange={setTheme} className="mvd-theme" /> : null}
      </div>
      <StageBar key={files.mp4} duration={duration} />
    </>
  );
}
