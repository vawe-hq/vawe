"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Kind = "rise" | "roll" | "stagger" | "pop" | "exit" | "push" | "scan" | "bubble" | "typing" | "stream";
type Lane = { label: string; ez: string };
type Chunk = { text: string; delayMs: number };

const HOLD_MS = 1000;
const ROWS = 4;

function Stage({ kind, chunks, stagger }: { kind: Kind; chunks: Chunk[]; stagger: number }) {
  switch (kind) {
    case "rise":
      return <div className="ej-card ej-rise"><i /><i /><b /></div>;
    case "roll":
      return (
        <p className="ej-num" aria-label="1,285">
          <span>1,28</span>
          <span className="ej-slot"><span className="ej-out">4</span><span className="ej-in">5</span></span>
        </p>
      );
    case "stagger":
      return (
        <ul className="ej-rows">
          {Array.from({ length: ROWS }, (_, i) => <li key={i} className="ej-row" style={{ "--i": i, "--gap": `${stagger}ms` } as CSSProperties}><i /></li>)}
        </ul>
      );
    case "pop":
      return <div className="ej-toast ej-pop"><span /><i /></div>;
    case "exit":
      return <div className="ej-card ej-leave"><i /><i /><b /></div>;
    case "push":
      return <div className="ej-frame"><div className="ej-scene ej-push"><i /><i /><i /><b /></div></div>;
    case "scan":
      return <div className="ej-frame"><div className="ej-line ej-scan" /><div className="ej-scene"><i /><i /><i /></div></div>;
    case "bubble":
      return <div className="ej-bubble ej-arrive" />;
    default:
      return (
        <p className={kind === "typing" ? "ej-text ej-typing" : "ej-text ej-stream"}>
          {chunks.map((c, i) => <span key={i} style={{ animationDelay: `${c.delayMs}ms` }}>{c.text}</span>)}
        </p>
      );
  }
}

export function JobDemo({ kind, lanes, ms, cycleMs, chunks, stagger, vars }: { kind: Kind; lanes: Lane[]; ms: number; cycleMs: number; chunks: Chunk[]; stagger: number; vars: Record<string, string> }) {
  const [run, setRun] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setRun((n) => n + 1), cycleMs + HOLD_MS);
    return () => window.clearInterval(id);
  }, [cycleMs]);
  return (
    <div className="ej-demo panel">
      <div className="ej-lanes" key={run}>
        {lanes.map((l) => (
          <div className="ej-lane" key={l.label}>
            <span className="ej-name">{l.label}</span>
            <div className="ej-stage" style={{ ...vars, "--ez": l.ez, "--ms": `${ms}ms` } as CSSProperties}>
              <Stage kind={kind} chunks={chunks} stagger={stagger} />
            </div>
          </div>
        ))}
      </div>
      <div className="ej-bar">
        <span className="meta">{ms} ms{lanes.length > 1 ? ", the ease against linear" : ""}</span>
        <button type="button" className="ez-chip" onClick={() => setRun((n) => n + 1)}>Replay</button>
      </div>
    </div>
  );
}
