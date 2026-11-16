import { REPO_URL } from "../schema";
import type { Code, Crumb, Link, Meta, NextBlock, Para, Section } from "./types";

export type HowTo = {
  slug: string;
  meta: Meta;
  h1: string;
  blurb: string;
  lede: Para;
  steps: Section;
  wrong: Section;
  moves?: { title: string; lead: string; clips: string[] };
  more: Section;
  next: NextBlock;
};

const AGENTIC: Link = { href: "/agentic-video-editing", label: "Agentic video editing" };

const HOWTO_NEXT = (cmd: string): NextBlock => ({
  title: "Start from your clip.",
  lead: [{ code: cmd }, " logs it and starts the page."],
  primary: { href: REPO_URL, label: "Get vawe on GitHub" },
  related: [
    { href: "/how-to", label: "All how-to guides" },
    { href: "/how-to/add-captions-to-video", label: "Add captions to a video" },
    { href: "/how-to/remove-silences-from-video", label: "Remove silences from a video" },
    { href: "/how-to/trim-and-join-video-clips", label: "Trim and join clips" },
    AGENTIC,
    { href: "/edit-video-with-claude-code", label: "Edit video with Claude Code" },
  ],
});

const CAPTIONS_CODE: Code = {
  label: "Words from the transcript, as spans",
  text: [
    "<section data-world=\"talk\">",
    "  <video src=\"footage/talk.mp4\" data-at=\"0\"",
    "         data-trim=\"0\" data-trim-end=\"14.2\"></video>",
    "  <p class=\"line\">",
    "    <span class=\"w\" style=\"--at:0.42s\">so</span>",
    "    <span class=\"w\" style=\"--at:0.58s\">today</span>",
    "    <span class=\"w\" style=\"--at:1.02s\">I</span>",
    "  </p>",
    "</section>",
    "<style>.w { animation: say 0.4s var(--at) both }</style>",
  ].join("\n"),
};

const SILENCE_CODE: Code = {
  label: "Each span of speech is a Cut list row",
  text: [
    "| world | clip | in   | out  | rate | why |",
    "| ---   | ---  | ---  | ---  | ---  | --- |",
    "| s2    | talk | 0.42 | 2.62 | 1    | “so today I show this” |",
    "| s4    | talk | 4.10 | 5.50 | 1    | “it takes a minute”, gap was 1.48\u00a0s |",
  ].join("\n"),
};

const TEXT_CODE: Code = {
  label: "A title card, then the clip",
  text: [
    "<meta name=\"duration\" content=\"auto\">",
    "<section data-world=\"title\"><h1>How it works</h1></section>",
    "<section data-world=\"clip\">",
    "  <video src=\"footage/talk.mp4\" data-at=\"2\"",
    "         data-trim=\"0.42\" data-trim-end=\"5.5\"></video>",
    "</section>",
    "<style>h1 { font-size: calc(var(--vh) * 0.12) }</style>",
  ].join("\n"),
};

const JOIN_CODE: Code = {
  label: "Two clips, one after the other",
  text: [
    "<section data-world=\"s1\">",
    "  <video src=\"footage/intro.mp4\" data-at=\"0\"",
    "         data-trim=\"1.5\" data-trim-end=\"6.5\"></video>",
    "</section>",
    "<section data-world=\"s2\">",
    "  <video src=\"footage/street.mp4\" data-at=\"5\"",
    "         data-trim=\"0\" data-trim-end=\"4\"></video>",
    "</section>",
  ].join("\n"),
};

const MUSIC_CODE: Code = {
  label: "A track under a talking clip",
  text: [
    "<audio src=\"assets/track.mp3\" loop data-at=\"0\"",
    "       data-gain=\"-3\" data-fade-out=\"0.4\"></audio>",
    "<section data-world=\"talk\">",
    "  <video src=\"footage/talk.mp4\" data-at=\"0\"",
    "         data-trim=\"0\" data-trim-end=\"14.2\" data-role=\"vo\"></video>",
    "</section>",
  ].join("\n"),
};

const SPEED_CODE: Code = {
  label: "A wait at 4 times, a slow part at half speed",
  text: [
    "<section data-world=\"wait\">",
    "  <video src=\"footage/demo.mp4\" data-at=\"0\"",
    "         data-trim=\"12\" data-trim-end=\"32\"",
    "         data-rate=\"4\" muted></video>",
    "</section>",
    "<section data-world=\"slow\">",
    "  <video src=\"footage/demo.mp4\" data-at=\"5\"",
    "         data-trim=\"40\" data-trim-end=\"44\"",
    "         data-rate=\"0.5\"></video>",
    "</section>",
  ].join("\n"),
};

export const HOW_TOS: HowTo[] = [
  {
    slug: "add-captions-to-video",
    blurb: "Word-timed captions from the transcript vawe writes on your machine.",
    meta: {
      title: "Add captions to a video with code, word by word | vawe",
      description:
        "Add word-timed captions to your own clip: vawe writes the word times on your machine, and you turn each word into a span. Commands and HTML included.",
    },
    h1: "Add captions to a video with code.",
    lede: [
      "vawe makes a transcript of your clip with every word timed, on your machine. You turn each word into a span with its start time, and one CSS animation lights it on its second. This guide has the commands and the page.",
    ],
    steps: {
      id: "steps",
      title: "The steps.",
      blocks: [
        {
          ol: [
            [{ strong: "Log the clip. " }, { code: "bin/vawe new captions --footage ~/clips/talk.mov" }, " copies it into ", { code: "films/captions/footage/" }, " and writes ", { code: "footage.md" }, " and ", { code: "footage/talk.words.json" }, ". Each entry in the words file has a word and its start and end in seconds."],
            [{ strong: "Set up the transcript tool once. " }, "The words come from whisper.cpp, so there is no API key and no upload. Install it with ", { code: "brew install whisper-cpp" }, ". The first footage log prints the line for the 148 MB model if it is missing."],
            [{ strong: "Make one span per word. " }, "Set ", { code: "--at" }, " to the word start, plus the clip’s ", { code: "data-at" }, ", minus its ", { code: "data-trim" }, ". Put the spans in the same world as the ", { code: "<video>" }, "."],
            [{ strong: "Animate the spans. " }, "One ", { code: "@keyframes" }, " rule with ", { code: "animation-delay: var(--at)" }, " lights the word on its second. The ", { text: "caption post", href: "/blog/animated-captions-html" }, " has the full rule."],
            [{ strong: "Render a draft and look. " }, { code: "bin/vawe dev films/captions/page.html" }, ", then ", { code: "bin/vawe frame films/captions/page.html --at 1,3,5" }, " for a sheet of frames at those seconds."],
          ],
        },
      ],
      code: CAPTIONS_CODE,
      cite: "skills/vawe-page/SKILL.md, Video clips · blog: animated captions in HTML",
    },
    wrong: {
      id: "wrong",
      title: "What can go wrong.",
      blocks: [
        {
          ol: [
            [{ strong: "The clip has no speech. " }, "A silent recording has no words file to read. Give the agent the text and the seconds yourself."],
            [{ strong: "The captions run early or late. " }, "The clip is trimmed or starts late in the film, and the ", { code: "--at" }, " values ignore that. Add ", { code: "data-at" }, " and subtract ", { code: "data-trim" }, "."],
            [{ strong: "The model is missing. " }, "The footage log prints the download line. Run it, then log the clip again."],
            [{ strong: "The text is too small on a vertical film. " }, "Size the line in ", { code: "--vw" }, " or ", { code: "--vh" }, " units, as the blog page does with 9vw."],
          ],
        },
      ],
    },
    moves: {
      title: "Two caption styles to copy.",
      lead: "One lights the word being said. The other sets key words in a contrasting face.",
      clips: ["caption-karaoke", "caption-editorial"],
    },
    more: {
      id: "more",
      title: "Read next.",
      blocks: [
        {
          ol: [
            [{ text: "Captions on a video, in HTML", href: "/blog/animated-captions-html" }, ": the full page and the CSS rule, plus the section on your own footage."],
            [{ text: "How an agent reads footage it cannot watch", href: "/blog/how-an-agent-reads-footage" }, ": what the words file holds."],
            [{ text: "Agentic video editing", href: "/agentic-video-editing" }, ": the whole edit, from clips to MP4."],
          ],
        },
      ],
    },
    next: HOWTO_NEXT("bin/vawe new <name> --footage <file>"),
  },
  {
    slug: "remove-silences-from-video",
    blurb: "Find each gap over 0.5\u00a0seconds in the word times and keep the speech.",
    meta: {
      title: "Remove silences from a video with code and an agent | vawe",
      description:
        "Cut the pauses from a talking clip: find each gap over 0.5\u00a0seconds in the word times, keep each span of speech, and render it. Steps and rows included.",
    },
    h1: "Remove silences from a video with code.",
    lede: [
      "An agent reads the word times in your clip’s transcript, finds each gap longer than 0.5\u00a0seconds and keeps only the spans that hold speech. Each span becomes one trimmed clip in a page that vawe renders to MP4.",
    ],
    steps: {
      id: "steps",
      title: "The steps.",
      blocks: [
        {
          ol: [
            [{ strong: "Log the clip. " }, { code: "bin/vawe new talk --footage ~/clips/talk.mov" }, " writes ", { code: "footage/talk.words.json" }, ": every word with a start and an end in seconds."],
            [{ strong: "Find the gaps. " }, "The gap between two words is the start of the next one minus the end of the first. Over 0.5\u00a0seconds is a silence."],
            [{ strong: "Group the words between two silences. " }, "A span starts at its first word’s start and ends at its last word’s end. Cutting on word ends keeps each word whole."],
            [{ strong: "Write one row per span. " }, "The Cut list in ", { code: "brief.md" }, " takes the clip, the in and out seconds, the speed and the reason."],
            [{ strong: "Write one video per row. " }, { code: "data-trim" }, " is the in second, ", { code: "data-trim-end" }, " the out second, and each ", { code: "data-at" }, " is the sum of the lengths before it."],
            [{ strong: "Render and check the cuts. " }, { code: "bin/vawe dev films/talk/page.html" }, ", then ", { code: "bin/vawe frame films/talk/page.html --cuts" }, " writes a frame at each cut."],
          ],
        },
      ],
      code: SILENCE_CODE,
      cite: "prompts/edit-from-clips.md · blog: cut silences with an agent",
    },
    wrong: {
      id: "wrong",
      title: "What can go wrong.",
      blocks: [
        {
          ol: [
            [{ strong: "Fillers stay. " }, "vawe has no filler-word detector. The agent can read an “um” in the transcript and cut it on its word times, but the choice is the agent’s and yours."],
            [{ strong: "A bad take stays. " }, "Nothing scores a take."],
            [{ strong: "A cut feels wrong although the numbers are right. " }, "Look at the frames from ", { code: "--cuts" }, ". To keep a breath at the start of a span, move ", { code: "data-trim" }, " earlier by a few hundredths of a second."],
            [{ strong: "A span flashes. " }, "A clip held under 1.2\u00a0seconds reads as a flash. The agent can join two close spans and keep the short gap inside."],
          ],
        },
      ],
    },
    more: {
      id: "more",
      title: "Read next.",
      blocks: [
        {
          ol: [
            [{ text: "Cut the silences with an agent", href: "/blog/cut-silences-with-an-agent" }, ": the same method with the example word times worked out."],
            [{ text: "How an agent reads footage it cannot watch", href: "/blog/how-an-agent-reads-footage" }, ": what footage.md holds."],
            [{ text: "Agentic video editing", href: "/agentic-video-editing" }, ": the scope of an edit."],
          ],
        },
      ],
    },
    next: HOWTO_NEXT("bin/vawe new <name> --footage <file>"),
  },
  {
    slug: "add-text-to-video",
    blurb: "A title card before the clip and a name or line over it.",
    meta: {
      title: "Add text and a title to a video with code | vawe",
      description:
        "Put a title card before your clip and a name or caption over it. HTML and CSS in a vawe page, with the commands to render a draft and check each beat.",
    },
    h1: "Add text and a title to a video with code.",
    lede: [
      "Text on a video is HTML in the page that holds the clip. A title card is its own beat before the clip. A name or a line over the clip sits in the clip’s beat.",
    ],
    steps: {
      id: "steps",
      title: "The steps.",
      blocks: [
        {
          ol: [
            [{ strong: "Hand over the clip. " }, { code: "bin/vawe new titled --footage ~/clips/talk.mov" }, " writes the page, ", { code: "footage.md" }, " and a brief."],
            [{ strong: "Write the title as its own beat. " }, "One ", { code: "data-world" }, " element with the text. Size it in ", { code: "--vh" }, " units so it fits every aspect."],
            [{ strong: "Start the clip after the title. " }, "Set the clip’s ", { code: "data-at" }, " to the second the title ends."],
            [{ strong: "Add a name or a line over the clip. " }, "Copy the snippet from ", { code: "prompts/moves/lower-third.md" }, " into the clip’s beat. Its leaving move is faster than its entrance."],
            [{ strong: "Look at each beat, then render. " }, { code: "bin/vawe frame films/titled/page.html --world all" }, " gives one key frame per beat. ", { code: "bin/vawe dev films/titled/page.html" }, " renders the draft."],
          ],
        },
      ],
      code: TEXT_CODE,
      cite: "AGENTS.md, the smallest film · prompts/moves/lower-third.md",
    },
    wrong: {
      id: "wrong",
      title: "What can go wrong.",
      blocks: [
        {
          ol: [
            [{ strong: "The clip starts too early. " }, "Its ", { code: "data-at" }, " was not moved when the title was added. Until its ", { code: "data-at" }, ", the clip shows its first frame."],
            [{ strong: "The text moves with the frame size. " }, "A fixed pixel size breaks at another aspect. Use ", { code: "--vw" }, " and ", { code: "--vh" }, " lengths and ", { code: "<html data-aspect>" }, "."],
            [{ strong: "The video is hidden by removing it. " }, "Hide a clip with opacity or by hiding its beat. Removing it from the DOM is a listed mistake."],
            [{ strong: "The text covers the picture. " }, "A name card belongs inside the title-safe area, as in the lower-third snippet."],
          ],
        },
      ],
    },
    moves: {
      title: "Two text moves to copy.",
      lead: "A name that rises over a speaker, and a line that enters from under an edge.",
      clips: ["lower-third", "mask-rise"],
    },
    more: {
      id: "more",
      title: "Read next.",
      blocks: [
        {
          ol: [
            [{ text: "Add captions to a video", href: "/how-to/add-captions-to-video" }, ": text that follows the voice, word by word."],
            [{ text: "Turn a screen recording into a demo video", href: "/screen-recording-to-demo-video" }, ": a title card and lower thirds on a recording."],
            [{ text: "Agentic video editing", href: "/agentic-video-editing" }, ": the whole edit."],
          ],
        },
      ],
    },
    next: HOWTO_NEXT("bin/vawe new <name> --footage <file>"),
  },
  {
    slug: "trim-and-join-video-clips",
    blurb: "Keep the best seconds of each clip and play them one after the other.",
    meta: {
      title: "Trim and join video clips with code | vawe",
      description:
        "Trim each clip to its best seconds and join them in one page. The Cut list, the data-trim and data-at attributes, and the commands to render and check.",
    },
    h1: "Trim and join video clips with code.",
    lede: [
      "Each part you keep is one ",
      { code: "<video>" },
      " in its own beat. ",
      { code: "data-trim" },
      " and ",
      { code: "data-trim-end" },
      " pick the seconds of the source, and ",
      { code: "data-at" },
      " says when it plays in the film.",
    ],
    steps: {
      id: "steps",
      title: "The steps.",
      blocks: [
        {
          ol: [
            [{ strong: "Hand over the clips. " }, { code: "bin/vawe new trip --footage ~/Movies/trip" }, " copies each into ", { code: "films/trip/footage/" }, " as an MP4 a page can seek, and writes ", { code: "footage.md" }, "."],
            [{ strong: "Read footage.md. " }, "It lists each clip’s length, the shot changes, the loudness, a contact sheet of 8\u00a0frames and a transcript. Cut on an action or a word end."],
            [{ strong: "Fill the Cut list. " }, "One row per beat: the clip, in, out, rate and the reason."],
            [{ strong: "Write one beat per row. " }, "The first beat has ", { code: "data-at=\"0\"" }, ". Each next ", { code: "data-at" }, " is the sum of the lengths before it."],
            [{ strong: "Render and look at the cuts. " }, { code: "bin/vawe dev films/trip/page.html" }, ", then ", { code: "bin/vawe frame films/trip/page.html --cuts" }, "."],
          ],
        },
        {
          p: [
            "At film time t the clip shows source second trim + (t − at) × rate, held at the first frame before ",
            { code: "data-at" },
            " and at the last frame after the end. The engine seeks the clip on every frame and never plays it live.",
          ],
        },
      ],
      code: JOIN_CODE,
      cite: "skills/vawe-page/SKILL.md, Video clips · prompts/edit-from-clips.md",
    },
    wrong: {
      id: "wrong",
      title: "What can go wrong.",
      blocks: [
        {
          ol: [
            [{ strong: "A cut shows the wrong second. " }, "It was chosen from the file name, not from footage.md and its frames."],
            [{ strong: "A clip flashes. " }, "A clip held under 1.2\u00a0seconds reads as a flash. Keep one fast cut for the beat that earns it."],
            [{ strong: "A clip is played live. " }, { code: "play()" }, ", ", { code: "autoplay" }, ", a timer or your own ", { code: "currentTime" }, " breaks the render. Let the engine seek."],
            [{ strong: "A portrait clip is cropped to fit. " }, "vawe never crops. Lay the clip out with ", { code: "--vw" }, " and ", { code: "--vh" }, " and set ", { code: "<html data-aspect>" }, "."],
          ],
        },
      ],
    },
    moves: {
      title: "Two ways to change between clips.",
      lead: "A hard cut that carries the eye with a moving shape, and a soft change through the next clip’s own light.",
      clips: ["cut-on-motion", "luma-matte-dissolve"],
    },
    more: {
      id: "more",
      title: "Read next.",
      blocks: [
        {
          ol: [
            [{ text: "Remove silences from a video", href: "/how-to/remove-silences-from-video" }, ": the same trim, driven by word times."],
            [{ text: "How an agent reads footage it cannot watch", href: "/blog/how-an-agent-reads-footage" }, ": the fields of footage.md."],
            [{ text: "Agentic video editing", href: "/agentic-video-editing" }, ": what an edit can and cannot do."],
          ],
        },
      ],
    },
    next: HOWTO_NEXT("bin/vawe new <name> --footage <folder>"),
  },
  {
    slug: "add-music-to-video",
    blurb: "One audio tag with your own track, with gain, fade and ducking under a voice.",
    meta: {
      title: "Add music to a video with code, from your own track | vawe",
      description:
        "Put a music file under a clip with one audio tag: gain, fade and ducking under a voice. Plus the command that measures the loudness of the mix.",
    },
    h1: "Add music to a video with code.",
    lede: [
      "Music is one ",
      { code: "<audio loop>" },
      " tag in the page. vawe mixes it offline with the film. It uses only a track you give it: it makes no music of its own.",
    ],
    steps: {
      id: "steps",
      title: "The steps.",
      blocks: [
        {
          ol: [
            [{ strong: "Pick a track you may use. " }, "Put the file in the film’s ", { code: "assets/" }, " folder and use a relative path."],
            [{ strong: "Add the tag. " }, { code: "loop" }, " marks it as the music. ", { code: "data-at" }, " is its start second, ", { code: "data-gain" }, " its level in dB and ", { code: "data-fade-out" }, " the fade at the end."],
            [{ strong: "Duck the music under a voice. " }, "Add ", { code: "data-role=\"vo\"" }, " to the clip or the ", { code: "<audio>" }, " that holds speech. The music ducks 18\u00a0dB under it."],
            [{ strong: "Render a draft. " }, { code: "bin/vawe dev films/talk/page.html" }, " renders it with sound. A clip’s own sound joins the mix unless it is ", { code: "muted" }, "."],
            [{ strong: "Measure the mix. " }, { code: "bin/vawe sound films/talk/page.html --waveform" }, " prints the loudness and true peak of the mix as written and writes a waveform PNG."],
          ],
        },
        {
          p: [
            "The mix is the sum of your tags at the gains you wrote. Nothing is normalised unless you add ",
            { code: "<meta name=\"loudness\" content=\"-14\">" },
            ".",
          ],
        },
      ],
      code: MUSIC_CODE,
      cite: "skills/vawe-page/SKILL.md, Sound · taste/craft/sound.md · harness/media/page-audio.mjs",
    },
    wrong: {
      id: "wrong",
      title: "What can go wrong.",
      blocks: [
        {
          ol: [
            [{ strong: "The page asks for a synth bed. " }, { code: "data-synth=\"bed\"" }, " is refused. Use a real music file or no bed."],
            [{ strong: "The music is too loud or too quiet. " }, "Read the number from the measure step and move ", { code: "data-gain" }, " on purpose."],
            [{ strong: "The voice is lost. " }, "The clip has no ", { code: "data-role=\"vo\"" }, ", so the music does not duck."],
            [{ strong: "Cuts do not land on the beat. " }, "Time the cuts to the beat grid of your track. The beat post shows how."],
          ],
        },
      ],
    },
    more: {
      id: "more",
      title: "Read next.",
      blocks: [
        {
          ol: [
            [{ text: "LUFS for code-made video", href: "/blog/audio-as-written" }, ": the loudness target, the mix rule and why synth beds are banned."],
            [{ text: "Cut video to the beat with code", href: "/blog/beat" }, ": cuts on the beats of a track."],
            [{ text: "Agentic video editing", href: "/agentic-video-editing" }, ": the whole edit."],
          ],
        },
      ],
    },
    next: HOWTO_NEXT("bin/vawe new <name> --footage <file>"),
  },
  {
    slug: "speed-up-or-slow-down-video",
    blurb: "One attribute, data-rate, from 0.25 to 4 times.",
    meta: {
      title: "Speed up or slow down a video with code | vawe",
      description:
        "Change the speed of part of a clip with one attribute, data-rate, from 0.25 to 4 times. Sound keeps its pitch. Steps, a page and the limits.",
    },
    h1: "Speed up or slow down a video with code.",
    lede: [
      "Speed is one attribute on the clip: ",
      { code: "data-rate" },
      ". A value of 4 plays the source four times as fast. A value of 0.5 plays it at half speed. The sound follows the speed and keeps its pitch.",
    ],
    steps: {
      id: "steps",
      title: "The steps.",
      blocks: [
        {
          ol: [
            [{ strong: "Hand over the clip. " }, { code: "bin/vawe new demo --footage ~/Movies/demo.mov" }, " logs it."],
            [{ strong: "Choose the stretch and the speed. " }, "Write the source seconds and the rate in a Cut list row, with the reason."],
            [{ strong: "Write the attributes. " }, { code: "data-trim" }, " and ", { code: "data-trim-end" }, " keep the stretch. ", { code: "data-rate" }, " sets the speed."],
            [{ strong: "Work out the new length. " }, "Source seconds divided by the rate. Source 12 to 32 at 4 times is 5\u00a0seconds of film."],
            [{ strong: "Move the next clip. " }, "Its ", { code: "data-at" }, " must match the new length."],
            [{ strong: "Render and look. " }, { code: "bin/vawe dev films/demo/page.html" }, ", then ", { code: "bin/vawe frame films/demo/page.html --cuts" }, "."],
          ],
        },
      ],
      code: SPEED_CODE,
      cite: "skills/vawe-page/SKILL.md, Video clips · harness/media/page-audio.mjs",
    },
    wrong: {
      id: "wrong",
      title: "What can go wrong.",
      blocks: [
        {
          ol: [
            [{ strong: "The rate is outside 0.25 to 4. " }, "The render warns and the clip’s sound is left out of the mix."],
            [{ strong: "A clip has no sound. " }, "A ", { code: "muted" }, " clip, or one with no audio stream, adds nothing to the mix."],
            [{ strong: "The next clip starts at the wrong second. " }, "The length changed and its ", { code: "data-at" }, " did not."],
            [{ strong: "A speed ramp is not here. " }, "One ", { code: "data-rate" }, " is one steady speed for a clip. Split the clip into parts for a change of speed."],
          ],
        },
      ],
    },
    more: {
      id: "more",
      title: "Read next.",
      blocks: [
        {
          ol: [
            [{ text: "Turn a screen recording into a demo video", href: "/screen-recording-to-demo-video" }, ": speed up the waits and cut the dead time."],
            [{ text: "Trim and join video clips", href: "/how-to/trim-and-join-video-clips" }, ": the attributes that place each clip."],
            [{ text: "Agentic video editing", href: "/agentic-video-editing" }, ": the whole edit."],
          ],
        },
      ],
    },
    next: HOWTO_NEXT("bin/vawe new <name> --footage <file>"),
  },
];

export const HOW_TO_BY_SLUG: Record<string, HowTo> = Object.fromEntries(HOW_TOS.map((h) => [h.slug, h]));

export const howToPath = (slug: string) => `/how-to/${slug}`;

export const HOW_TO_HUB = {
  path: "/how-to",
  meta: {
    title: "How to edit video with code: task guides | vawe",
    description:
      "Task guides for editing your own clips with code: captions, silences, titles, trimming and joining, music and speed. Each has real commands.",
  } as Meta,
  crumb: { group: "Learn", current: "How-to guides" } as Crumb,
  h1: "How to edit video with code.",
  lede: "One guide per editing task. Each one has the vawe commands and the page code, from your clip to an MP4 on your machine. A guide is here only when the repo’s own docs describe the task with a command or an attribute.",
  toc: [
    { href: "#tasks", label: "The guides" },
    { href: "#how", label: "How every edit runs" },
  ] as Link[],
  tasks: {
    id: "tasks",
    title: "The guides.",
    blocks: [
      {
        ol: HOW_TOS.map((h): Para => [{ text: h.h1.replace(/\.$/, ""), href: howToPath(h.slug) }, ": " + h.blurb]),
      },
    ],
  } as Section,
  how: {
    id: "how",
    title: "How every edit runs.",
    blocks: [
      {
        ol: [
          [{ strong: "Hand over the clips. " }, { code: "bin/vawe new <name> --footage <folder or clip>" }, " copies them and writes footage.md."],
          [{ strong: "Write one page. " }, "Each clip is a ", { code: "<video>" }, " in its own beat."],
          [{ strong: "Render a draft. " }, { code: "bin/vawe dev films/<name>/page.html" }, " renders half size with sound. The final render waits for your OK."],
          [{ strong: "Change it by hand. " }, "Open the page in ", { text: "the studio", href: "/studio" }, " to drag a key or change a colour or a line of text."],
        ],
      },
    ],
    cite: "prompts/edit-from-clips.md",
  } as Section,
  next: {
    title: "Start from your clip.",
    lead: [{ code: "bin/vawe new <name> --footage <file>" }, " logs it and starts the page."],
    primary: { href: REPO_URL, label: "Get vawe on GitHub" },
    related: [
      AGENTIC,
      { href: "/edit-video-with-claude-code", label: "Edit video with Claude Code" },
      { href: "/programmatic-video-editing", label: "Edit video with code" },
      { href: "/screen-recording-to-demo-video", label: "Screen recording to demo video" },
    ],
  } as NextBlock,
};
