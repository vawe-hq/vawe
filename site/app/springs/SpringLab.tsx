"use client";

import { useState, type CSSProperties } from "react";
import { CurveChart } from "../easing/Charts";

type Props = { name: string; y: number[]; vel: number[]; t50: number; t90: number; peakSpeed: number; settle: number; linear: string };

const SPEEDS = [1, 0.5, 0.25, 0.1];
const MIN_MOVE = 0.8;

// The first speed that makes the move last at least MIN_MOVE seconds, so a 0.2 s spring is not a blink.
const startSpeed = (settle: number) => SPEEDS.find((s) => settle / s >= MIN_MOVE) ?? SPEEDS[SPEEDS.length - 1];

export function SpringLab({ name, y, vel, t50, t90, peakSpeed, settle, linear }: Props) {
  const [speed, setSpeed] = useState(startSpeed(settle));
  const [loop, setLoop] = useState(true);
  const [run, setRun] = useState(0);
  const style = { "--ez": linear, "--d": `${(2 * settle) / speed}s`, "--loop": loop ? "infinite" : "1" } as CSSProperties;
  const curve = { name, y, vel, t50, t90, peakSpeed };
  const replay = () => setRun((n) => n + 1);

  return (
    <div className="ez-lab" style={style}>
      <div className="panel ez-lab-bar">
        <div className="ez-lab-motion ez-chips" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" className="ez-chip" aria-pressed={speed === s} onClick={() => { setSpeed(s); replay(); }}>{s === 1 ? "Real time" : `${s}× speed`}</button>
          ))}
        </div>
        <div className="ez-lab-motion ez-chips" role="group" aria-label="Playback">
          <button type="button" className="ez-chip" aria-pressed={loop} onClick={() => { setLoop((x) => !x); replay(); }}>Loop</button>
          <button type="button" className="ez-chip" onClick={replay}>Replay</button>
        </div>
      </div>

      <div key={run} className="ez-lab-body">
        <figure className="panel ez-chart ez-graphs">
          <span className="meta">Progress against time. The time axis runs 0 to {settle} s, the settle time.</span>
          <CurveChart e={curve} w={400} h={190} playhead />
          <figcaption className="ez-cap">Dashed: a straight line. The dot and the line move with the box on the right.</figcaption>
        </figure>

        <div className="panel ez-demo">
          <div className="ez-row">
            <span className="ez-lab-name" title={name}>{name}</span>
            <div className="ez-track"><span className="ez-box" /></div>
          </div>
          <div className="ez-row">
            <span className="ez-lab-name">linear</span>
            <div className="ez-track"><span className="ez-box ez-box-ref" /></div>
          </div>
          <p className="ez-cap">Both boxes take {settle} s. {speed === 1 ? "This is real time." : `Playing at ${speed}× speed.`}</p>
          <p className="ez-cap ez-stopnote">Your system asks for reduced motion, so nothing plays. The chart shows the whole move.</p>
        </div>
      </div>
    </div>
  );
}
