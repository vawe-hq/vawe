// The marketplace data contract: every file under marketplace/ and every form submission passes these
// checks. Plain JS, because the build script, the tests and the site all import it.

export const SOFTWARE = [
  { id: 'vawe', label: 'vawe' },
  { id: 'after-effects', label: 'After Effects' },
  { id: 'premiere-pro', label: 'Premiere Pro' },
  { id: 'final-cut-pro', label: 'Final Cut Pro' },
  { id: 'davinci-resolve', label: 'DaVinci Resolve' },
  { id: 'motion', label: 'Motion' },
];

export const TOOLS = [
  ...SOFTWARE,
  { id: 'cinema-4d', label: 'Cinema 4D' },
  { id: 'blender', label: 'Blender' },
  { id: 'houdini', label: 'Houdini' },
  { id: 'cavalry', label: 'Cavalry' },
  { id: 'rive', label: 'Rive' },
  { id: 'figma', label: 'Figma' },
  { id: 'unreal-engine', label: 'Unreal Engine' },
];

export const CATEGORIES = [
  { id: 'titles', label: 'Titles' },
  { id: 'logos', label: 'Logos' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'lower-thirds', label: 'Lower thirds' },
  { id: 'captions', label: 'Captions' },
  { id: 'product', label: 'Product' },
  { id: 'launch', label: 'Launch' },
  { id: 'explainer', label: 'Explainer' },
  { id: 'slideshow', label: 'Slideshow' },
  { id: 'social', label: 'Social' },
  { id: 'social-proof', label: 'Social proof' },
  { id: 'devices', label: 'Devices' },
  { id: 'art', label: 'Art' },
];

// The values Google's JobPosting employmentType accepts.
export const EMPLOYMENT = [
  { id: 'FULL_TIME', label: 'Full time' },
  { id: 'PART_TIME', label: 'Part time' },
  { id: 'CONTRACTOR', label: 'Freelance' },
  { id: 'TEMPORARY', label: 'Temporary' },
  { id: 'INTERN', label: 'Internship' },
];

export const WORKPLACES = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On site' },
];

// HOUR to YEAR are Google's baseSalary unitText values; PROJECT is shown but left out of the JSON-LD.
export const PAY_UNITS = [
  { id: 'HOUR', label: 'an hour' },
  { id: 'DAY', label: 'a day' },
  { id: 'WEEK', label: 'a week' },
  { id: 'MONTH', label: 'a month' },
  { id: 'YEAR', label: 'a year' },
  { id: 'PROJECT', label: 'a project' },
];
export const RATE_UNITS = PAY_UNITS.filter((u) => ['HOUR', 'DAY', 'PROJECT'].includes(u.id));

export const AVAILABILITY = [
  { id: 'available', label: 'Available now' },
  { id: 'soon', label: 'Available soon' },
  { id: 'booked', label: 'Booked' },
];

export const JOB_DAYS = 60;

export const LIMITS = {
  title: 80,
  summary: 160,
  name: 60,
  company: 80,
  bio: 400,
  description: 6000,
  descriptionMin: 80,
  url: 500,
  tag: 24,
  tags: 8,
  version: 40,
  plugins: 120,
  resolution: 24,
  location: 60,
  countries: 10,
  software: 8,
  price: 10000,
  pay: 10000000,
};

export const MEDIA = {
  video: { exts: ['mp4', 'webm'], types: ['video/mp4', 'video/webm'], maxBytes: 40 * 1024 * 1024 },
  image: { exts: ['jpg', 'jpeg', 'png', 'webp'], types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024 },
};

export const FOLDERS = { creator: 'creators', listing: 'listings', job: 'jobs', designer: 'designers' };

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_MEDIA = /^media\/[a-z0-9]+(?:-[a-z0-9]+)*\.([a-z0-9]+)$/;
// Tabs, newlines aside, a control character in a text field is never typed by a person.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const ids = (list) => list.map((x) => x.id);
const labelOf = (list, id) => list.find((x) => x.id === id)?.label ?? id;
export const softwareLabel = (id) => labelOf(TOOLS, id);
export const categoryLabel = (id) => labelOf(CATEGORIES, id);
export const employmentLabel = (id) => labelOf(EMPLOYMENT, id);
export const workplaceLabel = (id) => labelOf(WORKPLACES, id);
export const unitLabel = (id) => labelOf(PAY_UNITS, id);
export const availabilityLabel = (id) => labelOf(AVAILABILITY, id);

export const slugify = (text, max = 48) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, max)
    .replace(/^-+|-+$/g, '');

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const isoDate = (date) => date.toISOString().slice(0, 10);
export const jobValidThrough = (job) => addDays(job.posted, JOB_DAYS);
export const isExpired = (job, today) => today > jobValidThrough(job);

function validDate(v) {
  if (typeof v !== 'string' || !DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function httpsUrl(v) {
  if (typeof v !== 'string' || v.length > LIMITS.url || /\s/.test(v)) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) return null;
    return u;
  } catch {
    return null;
  }
}

function extOf(pathname) {
  const m = /\.([a-z0-9]+)$/i.exec(pathname);
  return m ? m[1].toLowerCase() : '';
}

function checker(entry, allowed) {
  const errors = [];
  const add = (field, why) => errors.push(`${field}: ${why}`);
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { errors: ['the entry must be a JSON object'], add, entry: {} };
  for (const key of Object.keys(entry)) if (!allowed.includes(key)) add(key, 'is not a known field');
  return { errors, add, entry };
}

function textField(c, field, max, { required = true, multiline = false, min = 1 } = {}) {
  const v = c.entry[field];
  if (v === undefined) {
    if (required) c.add(field, 'is required');
    return;
  }
  if (typeof v !== 'string') return c.add(field, 'must be text');
  if (v !== v.trim()) return c.add(field, 'must not start or end with spaces');
  if (CONTROL.test(v) || (!multiline && /[\r\n\t]/.test(v))) return c.add(field, multiline ? 'holds a control character' : 'must be one line');
  if (v.length < min) return c.add(field, min > 1 ? `must be at least ${min} characters` : 'must not be empty');
  if (v.length > max) c.add(field, `must be ${max} characters or fewer`);
}

function urlField(c, field, { required = true, mailto = false } = {}) {
  const v = c.entry[field];
  if (v === undefined) {
    if (required) c.add(field, 'is required');
    return;
  }
  if (mailto && typeof v === 'string' && /^mailto:[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(v) && v.length <= LIMITS.url) return;
  if (!httpsUrl(v)) c.add(field, mailto ? 'must be an https link or a mailto: address' : 'must be an https link');
}

function mediaField(c, field, kind, { required = true } = {}) {
  const v = c.entry[field];
  if (v === undefined) {
    if (required) c.add(field, 'is required');
    return;
  }
  const spec = MEDIA[kind];
  const want = spec.exts.join(', ');
  if (typeof v !== 'string') return c.add(field, 'must be text');
  const local = LOCAL_MEDIA.exec(v);
  if (local) {
    if (!spec.exts.includes(local[1])) c.add(field, `must be a ${want} file`);
    return;
  }
  const u = httpsUrl(v);
  if (!u) return c.add(field, `must be an https link to a ${want} file, or media/<name>.<ext> in the repo`);
  if (!spec.exts.includes(extOf(u.pathname))) c.add(field, `must end in .${spec.exts.join(' or .')}`);
}

function oneOf(c, field, list, { required = true } = {}) {
  const v = c.entry[field];
  if (v === undefined) {
    if (required) c.add(field, 'is required');
    return;
  }
  if (!ids(list).includes(v)) c.add(field, `must be one of ${ids(list).join(', ')}`);
}

function listOf(c, field, list, { min = 1, max = LIMITS.software } = {}) {
  const v = c.entry[field];
  if (v === undefined) return min ? c.add(field, 'is required') : undefined;
  if (!Array.isArray(v)) return c.add(field, 'must be a list');
  if (v.length < min) return c.add(field, `needs at least ${min}`);
  if (v.length > max) return c.add(field, `takes at most ${max}`);
  if (new Set(v).size !== v.length) return c.add(field, 'lists a value twice');
  const bad = v.filter((x) => !ids(list).includes(x));
  if (bad.length) c.add(field, `${bad.join(', ')} is not one of ${ids(list).join(', ')}`);
}

function money(c, field, value, { min = 0, max = LIMITS.price } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return c.add(field, 'must be a number');
  if (value < min || value > max) return c.add(field, `must be from ${min} to ${max}`);
  if (Math.round(value * 100) !== value * 100) c.add(field, 'takes at most 2 decimals');
}

function currencyOk(c, field, v) {
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) c.add(field, 'must be a 3-letter currency code such as USD or EUR');
}

function amountObject(c, field, keys, { required = false } = {}) {
  const v = c.entry[field];
  if (v === undefined) {
    if (required) c.add(field, 'is required');
    return;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return c.add(field, 'must be an object');
  for (const k of Object.keys(v)) if (![...keys, 'currency', 'unit'].includes(k)) c.add(`${field}.${k}`, 'is not a known field');
  return v;
}

export function checkCreator(entry) {
  const c = checker(entry, ['handle', 'name', 'link', 'avatar', 'bio']);
  if (!HANDLE.test(c.entry.handle ?? '')) c.add('handle', 'must be 1 to 39 lowercase letters, digits or dashes');
  textField(c, 'name', LIMITS.name);
  urlField(c, 'link');
  mediaField(c, 'avatar', 'image', { required: false });
  textField(c, 'bio', LIMITS.bio, { required: false, multiline: true });
  return c.errors;
}

export function checkListing(entry) {
  const c = checker(entry, ['id', 'title', 'summary', 'creator', 'software', 'version', 'category', 'preview', 'poster', 'price', 'url', 'tags', 'length', 'resolution', 'plugins', 'added']);
  if (!SLUG.test(c.entry.id ?? '') || c.entry.id.length > 64) c.add('id', 'must be lowercase words joined by dashes, 64 characters or fewer');
  textField(c, 'title', LIMITS.title);
  textField(c, 'summary', LIMITS.summary);
  if (!HANDLE.test(c.entry.creator ?? '')) c.add('creator', 'must be the handle of a file in marketplace/creators');
  oneOf(c, 'software', SOFTWARE);
  textField(c, 'version', LIMITS.version, { required: false });
  oneOf(c, 'category', CATEGORIES);
  mediaField(c, 'preview', 'video');
  mediaField(c, 'poster', 'image');
  const price = amountObject(c, 'price', ['amount'], { required: true });
  if (price) {
    money(c, 'price.amount', price.amount);
    currencyOk(c, 'price.currency', price.currency);
  }
  urlField(c, 'url');
  const tags = c.entry.tags;
  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.length > LIMITS.tags) c.add('tags', `must be a list of at most ${LIMITS.tags}`);
    else for (const t of tags) if (typeof t !== 'string' || !t.trim() || t.length > LIMITS.tag || t !== t.trim() || /[\r\n\t]/.test(t)) c.add('tags', `each tag is one line of ${LIMITS.tag} characters or fewer`);
  }
  const length = c.entry.length;
  if (length !== undefined && (typeof length !== 'number' || !(length > 0) || length > 3600)) c.add('length', 'must be a number of seconds, up to 3600');
  textField(c, 'resolution', LIMITS.resolution, { required: false });
  textField(c, 'plugins', LIMITS.plugins, { required: false });
  if (!validDate(c.entry.added)) c.add('added', 'must be a date as YYYY-MM-DD');
  return c.errors;
}

export function checkJob(entry) {
  const c = checker(entry, ['id', 'title', 'company', 'companyUrl', 'workplace', 'city', 'countries', 'employment', 'pay', 'software', 'description', 'apply', 'posted']);
  if (!SLUG.test(c.entry.id ?? '') || c.entry.id.length > 100) c.add('id', 'must be lowercase words joined by dashes, 100 characters or fewer');
  textField(c, 'title', LIMITS.title);
  textField(c, 'company', LIMITS.company);
  urlField(c, 'companyUrl', { required: false });
  oneOf(c, 'workplace', WORKPLACES);
  textField(c, 'city', LIMITS.location, { required: c.entry.workplace !== 'remote' });
  const countries = c.entry.countries;
  if (!Array.isArray(countries) || !countries.length || countries.length > LIMITS.countries) c.add('countries', `must list 1 to ${LIMITS.countries} countries`);
  else if (countries.some((x) => typeof x !== 'string' || !/^[A-Z]{2}$/.test(x))) c.add('countries', 'each country is a 2-letter code such as US or DE');
  listOf(c, 'employment', EMPLOYMENT, { min: 1, max: 3 });
  const pay = amountObject(c, 'pay', ['min', 'max']);
  if (pay) {
    money(c, 'pay.min', pay.min, { min: 1, max: LIMITS.pay });
    if (pay.max !== undefined) {
      money(c, 'pay.max', pay.max, { min: 1, max: LIMITS.pay });
      if (typeof pay.min === 'number' && typeof pay.max === 'number' && pay.max < pay.min) c.add('pay.max', 'must not be under pay.min');
    }
    currencyOk(c, 'pay.currency', pay.currency);
    if (!ids(PAY_UNITS).includes(pay.unit)) c.add('pay.unit', `must be one of ${ids(PAY_UNITS).join(', ')}`);
  }
  listOf(c, 'software', TOOLS, { min: 0 });
  textField(c, 'description', LIMITS.description, { multiline: true, min: LIMITS.descriptionMin });
  urlField(c, 'apply', { mailto: true });
  if (!validDate(c.entry.posted)) c.add('posted', 'must be a date as YYYY-MM-DD');
  return c.errors;
}

export function checkDesigner(entry) {
  const c = checker(entry, ['handle', 'name', 'link', 'avatar', 'reel', 'rate', 'software', 'availability', 'availableFrom', 'location', 'bio', 'updated']);
  if (!HANDLE.test(c.entry.handle ?? '')) c.add('handle', 'must be 1 to 39 lowercase letters, digits or dashes');
  textField(c, 'name', LIMITS.name);
  urlField(c, 'link', { required: false });
  mediaField(c, 'avatar', 'image', { required: false });
  urlField(c, 'reel');
  const rate = amountObject(c, 'rate', ['amount']);
  if (rate) {
    money(c, 'rate.amount', rate.amount, { min: 1 });
    currencyOk(c, 'rate.currency', rate.currency);
    if (!ids(RATE_UNITS).includes(rate.unit)) c.add('rate.unit', `must be one of ${ids(RATE_UNITS).join(', ')}`);
  }
  listOf(c, 'software', TOOLS, { min: 1 });
  oneOf(c, 'availability', AVAILABILITY);
  if (c.entry.availability === 'soon' && !validDate(c.entry.availableFrom)) c.add('availableFrom', 'is required as YYYY-MM-DD when availability is soon');
  else if (c.entry.availableFrom !== undefined && !validDate(c.entry.availableFrom)) c.add('availableFrom', 'must be a date as YYYY-MM-DD');
  textField(c, 'location', LIMITS.location, { required: false });
  textField(c, 'bio', LIMITS.bio, { required: false, multiline: true });
  if (!validDate(c.entry.updated)) c.add('updated', 'must be a date as YYYY-MM-DD');
  return c.errors;
}

export const CHECKS = { creator: checkCreator, listing: checkListing, job: checkJob, designer: checkDesigner };

// ===== the submit forms ===========================================================================
// Each field a form may send. The API refuses any other name, so this list is the allow-list.

const options = (list) => list.map(({ id, label }) => ({ value: id, label }));

export const FORMS = {
  listing: [
    { name: 'title', label: 'Template title', type: 'text', max: LIMITS.title, required: true },
    { name: 'summary', label: 'One line: what it is and when to use it', type: 'text', max: LIMITS.summary, required: true },
    { name: 'software', label: 'Software', type: 'select', options: options(SOFTWARE), required: true },
    { name: 'version', label: 'Works with version', type: 'text', max: LIMITS.version, hint: 'For example 2024 or later' },
    { name: 'category', label: 'Category', type: 'select', options: options(CATEGORIES), required: true },
    { name: 'preview', label: 'Preview video link', type: 'url', hint: 'https, .mp4 or .webm, up to 40 MB. Leave it empty to add the file in the pull request.' },
    { name: 'poster', label: 'Poster image link', type: 'url', hint: 'https, .jpg, .png or .webp, up to 5 MB. Leave it empty to add the file in the pull request.' },
    { name: 'price', label: 'Price (0 for free)', type: 'number', min: 0, max: LIMITS.price, step: '0.01', required: true },
    { name: 'currency', label: 'Currency', type: 'text', max: 3, hint: 'USD, EUR, GBP and so on', placeholder: 'USD' },
    { name: 'url', label: 'Buy or download link', type: 'url', required: true, hint: 'Your own store page: Polar, Gumroad, Lemon Squeezy or any https link' },
    { name: 'length', label: 'Length in seconds', type: 'number', min: 0, max: 3600, step: '0.1' },
    { name: 'resolution', label: 'Resolution', type: 'text', max: LIMITS.resolution, placeholder: '3840×2160' },
    { name: 'plugins', label: 'Plugins it needs', type: 'text', max: LIMITS.plugins, placeholder: 'None' },
    { name: 'tags', label: 'Tags, separated by commas', type: 'text', max: 200 },
    { name: 'handle', label: 'Your handle', type: 'text', max: 39, required: true, hint: 'Lowercase letters, digits and dashes. Your page is vawe.dev/creators/<handle>.' },
    { name: 'name', label: 'Your name', type: 'text', max: LIMITS.name, required: true },
    { name: 'link', label: 'Your site or portfolio', type: 'url', required: true },
    { name: 'avatar', label: 'Avatar image link', type: 'url', hint: 'https, .jpg, .png or .webp, square, up to 5 MB' },
    { name: 'bio', label: 'About you', type: 'textarea', max: LIMITS.bio },
  ],
  job: [
    { name: 'title', label: 'Job title', type: 'text', max: LIMITS.title, required: true, hint: 'Only the title: no salary, place or company name' },
    { name: 'company', label: 'Company', type: 'text', max: LIMITS.company, required: true },
    { name: 'companyUrl', label: 'Company site', type: 'url' },
    { name: 'workplace', label: 'Where the work happens', type: 'select', options: options(WORKPLACES), required: true },
    { name: 'city', label: 'City', type: 'text', max: LIMITS.location, hint: 'Needed for hybrid and on-site jobs' },
    { name: 'countries', label: 'Countries, as 2-letter codes', type: 'text', max: 40, required: true, hint: 'Remote: where people may live. On site: the office country. For example US, CA.' },
    { name: 'employment', label: 'Type', type: 'checkboxes', options: options(EMPLOYMENT), required: true },
    { name: 'payMin', label: 'Pay from', type: 'number', min: 1, max: LIMITS.pay, step: '0.01' },
    { name: 'payMax', label: 'Pay up to', type: 'number', min: 1, max: LIMITS.pay, step: '0.01' },
    { name: 'currency', label: 'Currency', type: 'text', max: 3, placeholder: 'USD' },
    { name: 'unit', label: 'Pay per', type: 'select', options: options(PAY_UNITS) },
    { name: 'software', label: 'Software', type: 'checkboxes', options: options(TOOLS) },
    { name: 'description', label: 'Description', type: 'textarea', max: LIMITS.description, required: true, hint: 'The work, the skills you need, the hours. At least 80 characters.' },
    { name: 'apply', label: 'Apply link or email', type: 'text', max: LIMITS.url, required: true, hint: 'An https link, or mailto:jobs@example.com' },
  ],
  designer: [
    { name: 'handle', label: 'Your handle', type: 'text', max: 39, required: true, hint: 'Lowercase letters, digits and dashes. Your page is vawe.dev/creators/<handle>.' },
    { name: 'name', label: 'Your name', type: 'text', max: LIMITS.name, required: true },
    { name: 'reel', label: 'Reel link', type: 'url', required: true, hint: 'Your showreel: a video page or file, https' },
    { name: 'link', label: 'Your site or portfolio', type: 'url' },
    { name: 'avatar', label: 'Avatar image link', type: 'url', hint: 'https, .jpg, .png or .webp, square, up to 5 MB' },
    { name: 'software', label: 'Software you use', type: 'checkboxes', options: options(TOOLS), required: true },
    { name: 'availability', label: 'Availability', type: 'select', options: options(AVAILABILITY), required: true },
    { name: 'availableFrom', label: 'Available from', type: 'date', hint: 'Needed when you are available soon' },
    { name: 'rateAmount', label: 'Rate', type: 'number', min: 1, max: LIMITS.price, step: '0.01' },
    { name: 'currency', label: 'Currency', type: 'text', max: 3, placeholder: 'USD' },
    { name: 'unit', label: 'Rate per', type: 'select', options: options(RATE_UNITS) },
    { name: 'location', label: 'Where you are', type: 'text', max: LIMITS.location, placeholder: 'Lisbon, PT' },
    { name: 'bio', label: 'About you', type: 'textarea', max: LIMITS.bio },
  ],
};

export const HONEYPOT = 'fax';

const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const str = (v) => (blank(v) ? undefined : typeof v === 'string' ? v.trim() : v);
const num = (v) => (blank(v) ? undefined : typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v.trim()) : v);
const list = (v) => (blank(v) ? [] : Array.isArray(v) ? v : [v]);
const commaList = (v, upper = false) => (blank(v) ? undefined : String(v).split(',').map((x) => (upper ? x.trim().toUpperCase() : x.trim())).filter(Boolean));
const upper = (v) => (blank(v) ? undefined : String(v).trim().toUpperCase());
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function amount(fields, currency, unit) {
  if (Object.values(fields).every((v) => v === undefined)) return undefined;
  return compact({ ...fields, currency: currency ?? 'USD', ...(unit === undefined ? {} : { unit }) });
}

export function entriesFromForm(kind, form, today) {
  if (kind === 'listing') {
    const id = slugify(form.title, 64);
    const creator = compact({ handle: str(form.handle), name: str(form.name), link: str(form.link), avatar: str(form.avatar), bio: str(form.bio) });
    const listing = compact({
      id,
      title: str(form.title),
      summary: str(form.summary),
      creator: str(form.handle),
      software: str(form.software),
      version: str(form.version),
      category: str(form.category),
      preview: str(form.preview) ?? `media/${id}.mp4`,
      poster: str(form.poster) ?? `media/${id}.webp`,
      price: { amount: num(form.price), currency: upper(form.currency) ?? 'USD' },
      url: str(form.url),
      tags: commaList(form.tags),
      length: num(form.length),
      resolution: str(form.resolution),
      plugins: str(form.plugins),
      added: today,
    });
    return [{ kind: 'creator', entry: creator }, { kind: 'listing', entry: listing }];
  }
  if (kind === 'job') {
    const id = [slugify(form.company, 40), slugify(form.title, 40), today.replace(/-/g, '')].filter(Boolean).join('-');
    const job = compact({
      id,
      title: str(form.title),
      company: str(form.company),
      companyUrl: str(form.companyUrl),
      workplace: str(form.workplace),
      city: str(form.city),
      countries: commaList(form.countries, true),
      employment: list(form.employment),
      pay: amount({ min: num(form.payMin), max: num(form.payMax) }, upper(form.currency), str(form.unit) ?? 'YEAR'),
      software: list(form.software),
      description: typeof form.description === 'string' ? form.description.replace(/\r\n?/g, '\n').trim() : form.description,
      apply: str(form.apply),
      posted: today,
    });
    return [{ kind: 'job', entry: job }];
  }
  const designer = compact({
    handle: str(form.handle),
    name: str(form.name),
    link: str(form.link),
    avatar: str(form.avatar),
    reel: str(form.reel),
    rate: amount({ amount: num(form.rateAmount) }, upper(form.currency), str(form.unit) ?? 'HOUR'),
    software: list(form.software),
    availability: str(form.availability),
    availableFrom: str(form.availableFrom),
    location: str(form.location),
    bio: typeof form.bio === 'string' ? (form.bio.replace(/\r\n?/g, '\n').trim() || undefined) : form.bio,
    updated: today,
  });
  return [{ kind: 'designer', entry: designer }];
}

export const entryKey = (kind, entry) => (kind === 'creator' || kind === 'designer' ? entry.handle : entry.id);
export const entryPath = (kind, entry) => `marketplace/${FOLDERS[kind]}/${entryKey(kind, entry)}.json`;
