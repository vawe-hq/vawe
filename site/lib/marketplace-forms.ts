import { FORMS } from "./marketplace-schema.mjs";
import type { Field, Group } from "../app/marketplace/SubmitForm";

type Kind = keyof typeof FORMS;

const LAYOUT: Record<Kind, [string, string[]][]> = {
  listing: [
    ["The template", ["title", "summary", "software", "version", "category", "length", "resolution", "plugins", "tags"]],
    ["Preview", ["preview", "poster"]],
    ["Price and link", ["price", "currency", "url"]],
    ["About you", ["handle", "name", "link", "avatar", "bio"]],
  ],
  job: [
    ["The job", ["title", "company", "companyUrl", "employment", "software", "description"]],
    ["Where", ["workplace", "city", "countries"]],
    ["Pay", ["payMin", "payMax", "currency", "unit"]],
    ["How to apply", ["apply"]],
  ],
  designer: [
    ["About you", ["handle", "name", "location", "link", "avatar", "bio"]],
    ["Your work", ["reel", "software"]],
    ["Availability and rate", ["availability", "availableFrom", "rateAmount", "currency", "unit"]],
  ],
};

export function formGroups(kind: Kind): Group[] {
  const fields = FORMS[kind] as Field[];
  const placed = LAYOUT[kind].flatMap(([, names]) => names);
  const missing = fields.map((f) => f.name).filter((n) => !placed.includes(n));
  if (missing.length || placed.length !== fields.length) throw new Error(`lib/marketplace-forms.ts: place every ${kind} field once (${missing.join(", ")})`);
  return LAYOUT[kind].map(([title, names]) => ({ title, fields: names.map((n) => fields.find((f) => f.name === n) as Field) }));
}
