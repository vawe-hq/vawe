import { INSPIRATION, INSPIRATION_PATH } from "../inspiration";
import type { InspirationCard } from "../inspiration";
import { REPO_URL } from "../schema";
import type { Link } from "./types";

// A type gets its own page only with this many posts: fewer would be a thin page made for a search phrase.
export const MIN_TYPE_POSTS = 12;

export type TypeLesson = { text: string; file: string };
export type TypeCopy = {
  id: string;
  noun: string;
  title: string;
  description: string;
  intro: string[];
  lessons: TypeLesson[];
  vawe: Link;
  also: Link[];
};

// Every lesson restates a line of the file it names. Posts are described from the gallery data: titles, lengths, tags and models.
const COPY: TypeCopy[] = [
  {
    id: "explainer",
    noun: "Explainer",
    title: "Explainer video examples made with AI | vawe",
    description: "AI-made explainer videos from X, each credited, with prompts to recreate them and the craft rules vawe uses to make one.",
    intro: [
      "An explainer video teaches one topic with visuals the maker draws. Nothing is sold in it.",
      "The posts here run from a 15\u00a0second motion graphic to a film of about 12\u00a0minutes on how a Transformer works. Some are things you can play with, such as a lens lab or a rocket engine you can take apart. Most list Claude Opus 5.5 as the model.",
    ],
    lessons: [
      { text: "Give each scene one idea. The picture is the explanation, and type is for labels and one sentence per scene.", file: "prompts/story-explainer.md" },
      { text: "List every factual claim and its source before you draw. Copy formulas, dates, numbers and names. Do not paraphrase them.", file: "prompts/story-explainer.md" },
      { text: "Match the claim to a graphic: a quantity wants a bar, a proportion a ring, a change over time a line, a flow a diagram.", file: "taste/craft/show-dont-tell.md" },
      { text: "Hold a line of text for the longer of 1.2\u00a0seconds or its word count divided by 3.", file: "taste/build/DIGEST.md" },
      { text: "Plan the length early. A film over 60\u00a0seconds takes the director’s brief.", file: "prompts/story-explainer.md" },
    ],
    vawe: { href: "/explainer-video", label: "How to make an explainer video with code" },
    also: [{ href: "/video-components/group/point-the-eye", label: "Components that point the eye" }],
  },
  {
    id: "product-ui",
    noun: "Product UI",
    title: "Product UI video examples made with AI | vawe",
    description: "AI-made product UI videos from X: interfaces that move, each credited, with the vawe rules for showing a screen on video.",
    intro: [
      "A product UI video shows an interface at work: a dashboard, an editor, a card that changes shape.",
      "The posts here run from 8\u00a0seconds to about 4\u00a0minutes. Many mix UI with 3D or an explainer. Most were made with Claude Opus 5.5, and a few with HyperFrames, After Effects or Codex. One is a single shape that becomes a series of UI states.",
    ],
    lessons: [
      { text: "Show real things working, not slogans in boxes. An invented product gets a real interface, never chrome with no function.", file: "taste/build/DIGEST.md" },
      { text: "A capture of the real surface beats a chart you drew. If the claim is about the product, show the product.", file: "taste/craft/show-dont-tell.md" },
      { text: "For a loop, let one element become 8 to 12 UI states on a beat grid.", file: "guides/ROUTING.md" },
      { text: "Pair a long held beat with a hero and a proof: the claim, then a screen, a stat or a diff that shows it.", file: "taste/craft/density.md" },
      { text: "UI that is the subject can use text at 3 percent of the frame height. Other lines need 6 percent.", file: "taste/build/DIGEST.md" },
    ],
    vawe: { href: "/product-showcase-video", label: "How to make a product showcase video with code" },
    also: [
      { href: "/video-components/group/product-moments", label: "Product moment components" },
      { href: "/launch-video", label: "How to make a launch video with code" },
    ],
  },
  {
    id: "typography",
    noun: "Typography",
    title: "Typography video examples made with AI | vawe",
    description: "AI-made kinetic typography videos from X, each credited, with the vawe rules for faces, sizes and reading time.",
    intro: [
      "A typography video is made mostly of moving text: an essay, a history, a launch told in words.",
      "The posts here run from 15\u00a0seconds to about 4\u00a0minutes. Examples include an essay turned into a video of under 200\u00a0seconds, a short history of AI and a launch video for a made-up calendar app. Most list Claude Opus 5.5 as the model.",
    ],
    lessons: [
      { text: "Do not pair two sans-serif faces. Cross the line: a serif with a sans, or a sans with a mono.", file: "taste/craft/typography.md" },
      { text: "Use one expressive face per scene. Make the weight gap visible at a glance.", file: "taste/craft/typography.md" },
      { text: "Use video sizes, not web sizes. Fill the frame with hero text, and set display type tighter than on the web.", file: "taste/craft/typography.md" },
      { text: "Emphasise inside a line by recolouring at the same weight, not by making it bolder.", file: "taste/craft/typography.md" },
      { text: "Make cap height 6 percent of the frame or more, and hold a line for the longer of 1.2\u00a0seconds or its word count divided by 3.", file: "taste/build/DIGEST.md" },
    ],
    vawe: { href: "/video-components/group/reveal-a-title", label: "Text reveal animations in CSS" },
    also: [{ href: "/docs/kinetic-type", label: "The kinetic type guide" }],
  },
  {
    id: "3d",
    noun: "3D",
    title: "3D video examples made with AI | vawe",
    description: "AI-made 3D videos from X, many in three.js, each credited, with the vawe rules for 3D scenes that render the same every time.",
    intro: [
      "A 3D video moves a camera or an object through a scene built in code. The posts here include a CD case that opens, a rocket engine you can take apart and a software product shown as an object.",
      "They run from under 5\u00a0seconds to a film of over 35\u00a0minutes. Several list three.js, and most list Claude Opus 5.5. Some are also product UI videos or explainers.",
    ],
    lessons: [
      { text: "Make the frame a pure function of time. Frame 400 must not need frame 399.", file: "skills/vawe-page/SKILL.md" },
      { text: "Opacity or filter on a preserve-3d element flattens it. Fade the wrapper instead.", file: "skills/vawe-page/SKILL.md" },
      { text: "Do not use a new 3D toy every beat. Keep a 3D moment for the hero reveal, an act break or the end.", file: "taste/craft/failure-modes.md" },
      { text: "Keep the camera still. Allow one move, at the one big moment.", file: "taste/build/DIGEST.md" },
    ],
    vawe: { href: "/docs/three-and-canvas", label: "three.js and canvas in a film" },
    also: [{ href: "/blog/threejs-to-mp4", label: "Three.js to MP4, frame by frame" }, { href: "/video-components/group/move-the-camera", label: "Camera move components" }],
  },
  {
    id: "illustration",
    noun: "Illustration",
    title: "Illustration video examples made with AI | vawe",
    description: "AI-made illustrated videos from X, each credited, with the vawe rules for choosing images, colour and layout.",
    intro: [
      "An illustration video is a drawn picture that moves. In the posts here the model made the pictures, with no camera and no stock footage. One post says the model drew every frame in JavaScript.",
      "They run from under 5\u00a0seconds to a film of over 35\u00a0minutes. Most list Claude Opus 5.5. A few use Grok or Gemini.",
    ],
    lessons: [
      { text: "Pick the lightest visual that carries the meaning: a plain field, a gradient, a generated card, a capture, an illustration, then a photo.", file: "taste/craft/imagery.md" },
      { text: "Treat every image. A raw flat image reads as a dropped screenshot. Use one grade across the whole film.", file: "taste/craft/imagery.md" },
      { text: "Hold one accent colour scarce. Tint the neutrals, and do not use pure black or white.", file: "taste/craft/color.md" },
      { text: "Make one thing the hero, anchored to an edge, not everything centred with equal weight.", file: "taste/craft/layout.md" },
    ],
    vawe: { href: "/video-components/group/grounds", label: "Animated backgrounds in CSS and shaders" },
    also: [{ href: "/docs/backgrounds-and-images", label: "Backgrounds and images" }],
  },
  {
    id: "abstract",
    noun: "Abstract",
    title: "Abstract motion video examples made with AI | vawe",
    description: "AI-made abstract motion videos from X: shape, light and type, each credited, with the vawe rules for colour and grounds.",
    intro: [
      "An abstract video has no product to show. It is made of shape, light, colour and type in motion.",
      "The posts here run from about 10\u00a0seconds to a film of over 6\u00a0minutes. Some are plain motion tests. Others add narration, such as a 2\u00a0minute history of Google. Most list Claude Opus 5.5 as the model.",
    ],
    lessons: [
      { text: "Muted is fine. Flat is not. Every frame needs one colour that pulls the eye.", file: "taste/craft/color.md" },
      { text: "Do not leave the ground as one flat fill. Pure black reads as nothing loaded, so tint it toward the accent hue.", file: "taste/craft/density.md" },
      { text: "Hold one accent colour scarce. Dominant neutral first, a second tone, then a small accent.", file: "taste/craft/color.md" },
      { text: "A glowing disc or orb is fine only if the direction chose it. A disc needs a light source and a surface.", file: "taste/build/DIGEST.md" },
    ],
    vawe: { href: "/video-components/group/grounds", label: "Animated backgrounds in CSS and shaders" },
    also: [{ href: "/docs/backgrounds-and-images", label: "Backgrounds and images" }],
  },
];

const countOf = (id: string) => INSPIRATION.filter((p) => p.types.includes(id)).length;

export const INSPIRATION_TYPE_PAGES = COPY.filter((c) => countOf(c.id) >= MIN_TYPE_POSTS);

export const typePath = (id: string) => `${INSPIRATION_PATH}/${id}`;
export const typePage = (id: string) => INSPIRATION_TYPE_PAGES.find((c) => c.id === id);
export const postsOfType = (id: string): InspirationCard[] => INSPIRATION.filter((p) => p.types.includes(id));
export const lessonUrl = (file: string) => `${REPO_URL}/blob/main/${file}`;

export function typeFacts(id: string) {
  const posts = postsOfType(id);
  const lengths = posts.map((p) => p.duration).sort((a, b) => a - b);
  return {
    count: posts.length,
    median: Math.round(lengths[Math.floor(lengths.length / 2)]),
    withPrompt: posts.filter((p) => p.promptSource).length,
  };
}
