import type { Segment } from "../faq";

export type Inline = Segment | { code: string } | { strong: string };
export type Para = Inline[];
export type Link = { href: string; label: string };
export type Meta = { title: string; description: string };
export type Crumb = { group?: string; current: string };
export type Code = { label: string; text: string };
export type NextBlock = { title: string; lead?: Para; primary: Link; secondary?: Link; related?: Link[] };

export type Block = { p: Para } | { ol: Para[] };
export type Table = { head: string[]; rows: { vawe?: boolean; cells: Para[] }[] };
export type Section = { id?: string; title: string; blocks: Block[]; cite?: string; code?: Code; columns?: boolean };

export const plain = (p: Para): string =>
  p.map((s) => (typeof s === "string" ? s : "text" in s ? s.text : "code" in s ? s.code : s.strong)).join("");
