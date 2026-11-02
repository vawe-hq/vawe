import Link from "next/link";
import { clip, type Move } from "../../lib/moves";
import { moveAlt } from "../../lib/move-words";
import { GroupIcon, MiscSvg } from "./icons";

// The server-rendered twin of MovesGallery's Card: a poster, no live video.
export function GroupCard({ move, num, first }: { move: Move; num: number; first: boolean }) {
  const files = clip(move);
  return (
    <li className="mv-card panel" data-name={move.name}>
      <div className="mv-media">
        {move.clipHash ? (
          <img
            src={files.poster}
            alt={moveAlt(move)}
            width={640}
            height={360}
            loading={first ? "eager" : "lazy"}
            fetchPriority={first ? "high" : "auto"}
            decoding="async"
          />
        ) : (
          <p className="meta mv-soon">Clip coming</p>
        )}
        <span className="mv-chip mv-chip-num" aria-hidden="true">{String(num).padStart(2, "0")}</span>
        {move.duration ? (
          <span className="mv-chip mv-chip-dur" aria-hidden="true">
            <MiscSvg name="play" size={9} />
            {move.duration} s
          </span>
        ) : null}
        <p className="mv-use">{move.use}</p>
      </div>
      <div className="mv-cap">
        <GroupIcon id={move.group} size={14} />
        <h3 className="mv-title">
          <Link href={`/video-components/${move.name}`} prefetch={false}>{move.title}</Link>
        </h3>
        <p className="mv-use-touch">{move.use}</p>
      </div>
    </li>
  );
}
