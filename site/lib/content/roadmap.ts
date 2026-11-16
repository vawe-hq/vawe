export type RoadmapItem = { name: string; note: string; problem: number };
export type RoadmapColumn = { title: string; lead: string; items: RoadmapItem[] };

export const ROADMAP = {
  h1: "Roadmap: now, next, later.",
  lede: "The order of work on vawe. There are no dates: Now comes before Next, and Next before Later. Each item links to the problem it addresses.",
  columns: [
    {
      title: "Now",
      lead: "In work today.",
      items: [
        { name: "Render reliability", note: "Resume a final render after a crash, and report the crash.", problem: 12 },
        { name: "One shared render lock", note: "One lock that every render command uses.", problem: 12 },
        { name: "Determinism under load", note: "Frames stay identical when the machine is busy.", problem: 1 },
      ],
    },
    {
      title: "Next",
      lead: "Planned after Now.",
      items: [
        { name: "Windowed drafts with their checks", note: "Draft one window of a film and run the checks on that window.", problem: 6 },
        { name: "vawe moves --check", note: "A command that checks the video component library.", problem: 4 },
        { name: "A pairwise judge", note: "The judge compares two films instead of scoring one.", problem: 9 },
        { name: "Motion-shape measures", note: "Numbers for the shape of a move.", problem: 10 },
        { name: "Hook and palette numbers", note: "Numbers for the opening hook and the palette.", problem: 10 },
        { name: "A default grain layer", note: "Grain on by default, to finish the frame.", problem: 3 },
      ],
    },
    {
      title: "Later",
      lead: "Not started.",
      items: [
        { name: "Eye-path and thread measures", note: "Measure where the eye goes and whether one thread runs through the film.", problem: 10 },
        { name: "Faster final capture", note: "Cut the screenshot time of a final render.", problem: 11 },
        { name: "Sound", note: "Parked until synthesized cues stop sounding machine-made.", problem: 13 },
      ],
    },
  ] as RoadmapColumn[],
};
