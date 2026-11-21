import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CHECKS, FORMS, addDays, entriesFromForm, isExpired, jobValidThrough } from '../../site/lib/marketplace-schema.mjs';
import { RateLimiter, checkMedia, handleSubmit, isPrivateAddress } from '../../site/lib/marketplace-submit.ts';
import { buildMarketplace, expiredJobs, readMarketplace } from '../../scripts/site/marketplace.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TODAY = '2026-11-21';

const creator = (over = {}) => ({ handle: 'ana-motion', name: 'Ana Ruiz', link: 'https://ana.example.com', ...over });
const listing = (over = {}) => ({
  id: 'glitch-titles', title: 'Glitch titles', summary: 'Twelve glitch title cards for trailers.', creator: 'ana-motion', software: 'after-effects',
  category: 'titles', preview: 'https://cdn.example.com/glitch.mp4', poster: 'https://cdn.example.com/glitch.jpg', price: { amount: 19, currency: 'USD' },
  url: 'https://ana.gumroad.com/l/glitch', added: TODAY, ...over,
});
const job = (over = {}) => ({
  id: 'northwind-motion-designer-20261121', title: 'Motion designer', company: 'Northwind', workplace: 'remote', countries: ['US', 'CA'],
  employment: ['FULL_TIME'], software: ['after-effects'], description: 'You make launch films and product loops. You know After Effects well and can show a reel of shipped work.',
  apply: 'https://northwind.example.com/jobs/1', posted: TODAY, ...over,
});
const designer = (over = {}) => ({
  handle: 'ana-motion', name: 'Ana Ruiz', reel: 'https://vimeo.com/123', software: ['after-effects', 'cinema-4d'], availability: 'available', updated: TODAY, ...over,
});

// ===== the schema ===============================================================================

test('a complete entry of each kind passes', () => {
  assert.deepEqual(CHECKS.creator(creator()), []);
  assert.deepEqual(CHECKS.listing(listing()), []);
  assert.deepEqual(CHECKS.job(job()), []);
  assert.deepEqual(CHECKS.designer(designer()), []);
  assert.deepEqual(CHECKS.listing(listing({ price: { amount: 0, currency: 'EUR' }, preview: 'media/glitch-titles.webm', poster: 'media/glitch-titles.png' })), []);
  assert.deepEqual(CHECKS.job(job({ workplace: 'hybrid', city: 'Berlin', countries: ['DE'], apply: 'mailto:jobs@northwind.example.com', pay: { min: 60, max: 90, currency: 'EUR', unit: 'HOUR' } })), []);
});

test('each broken field is named with its fix', () => {
  const cases = [
    [CHECKS.listing(listing({ extra: 1 })), /^extra: is not a known field$/],
    [CHECKS.listing(listing({ preview: 'http://cdn.example.com/a.mp4' })), /^preview: must be an https link/],
    [CHECKS.listing(listing({ preview: 'https://cdn.example.com/a.exe' })), /^preview: must end in \.mp4 or \.webm$/],
    [CHECKS.listing(listing({ poster: 'https://cdn.example.com/a.svg' })), /^poster: must end in/],
    [CHECKS.listing(listing({ preview: 'media/../x.mp4' })), /^preview:/],
    [CHECKS.listing(listing({ software: 'flash' })), /^software: must be one of/],
    [CHECKS.listing(listing({ price: { amount: -1, currency: 'USD' } })), /^price\.amount: must be from 0/],
    [CHECKS.listing(listing({ price: { amount: 1.005, currency: 'USD' } })), /^price\.amount: takes at most 2 decimals$/],
    [CHECKS.listing(listing({ price: { amount: 5, currency: 'usd' } })), /^price\.currency:/],
    [CHECKS.listing(listing({ title: 'x'.repeat(81) })), /^title: must be 80 characters or fewer$/],
    [CHECKS.listing(listing({ title: ' padded' })), /^title: must not start or end with spaces$/],
    [CHECKS.listing(listing({ summary: 'two\nlines' })), /^summary: must be one line$/],
    [CHECKS.listing(listing({ url: 'javascript:alert(1)' })), /^url: must be an https link$/],
    [CHECKS.listing(listing({ url: 'https://user:pw@shop.example.com/x' })), /^url: must be an https link$/],
    [CHECKS.listing(listing({ added: '2026-02-30' })), /^added: must be a date/],
    [CHECKS.listing(listing({ id: 'Bad_Id' })), /^id: must be lowercase/],
    [CHECKS.creator(creator({ handle: '-ana' })), /^handle:/],
    [CHECKS.job(job({ workplace: 'onsite' })), /^city: is required$/],
    [CHECKS.job(job({ countries: [] })), /^countries: must list 1 to 10/],
    [CHECKS.job(job({ countries: ['USA'] })), /^countries: each country is a 2-letter code/],
    [CHECKS.job(job({ employment: ['GIG'] })), /^employment: GIG is not one of/],
    [CHECKS.job(job({ description: 'Too short.' })), /^description: must be at least 80 characters$/],
    [CHECKS.job(job({ apply: 'ftp://x.example.com' })), /^apply: must be an https link or a mailto: address$/],
    [CHECKS.job(job({ pay: { min: 90, max: 60, currency: 'EUR', unit: 'HOUR' } })), /^pay\.max: must not be under pay\.min$/],
    [CHECKS.job(job({ pay: { min: 90, currency: 'EUR', unit: 'SHIFT' } })), /^pay\.unit:/],
    [CHECKS.designer(designer({ availability: 'soon' })), /^availableFrom: is required/],
    [CHECKS.designer(designer({ software: [] })), /^software: needs at least 1$/],
    [CHECKS.designer(designer({ rate: { amount: 50, currency: 'USD', unit: 'YEAR' } })), /^rate\.unit:/],
    [CHECKS.designer(designer({ bio: 'a\u0007b' })), /^bio: holds a control character$/],
  ];
  for (const [errors, want] of cases) assert.ok(errors.some((e) => want.test(e)), `${want} not in ${JSON.stringify(errors)}`);
});

test('a job closes 60 days after it was posted, and is still open on its last day', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(jobValidThrough(job()), '2027-01-20');
  assert.equal(isExpired(job(), '2027-01-20'), false);
  assert.equal(isExpired(job(), '2027-01-21'), true);
});

test('every committed marketplace file passes the schema, names its own file and points at a creator that exists', () => {
  const data = readMarketplace({ root: ROOT });
  for (const [kind, entries] of Object.entries(data)) for (const e of entries) assert.deepEqual(CHECKS[kind](e), [], `${kind} ${e.id ?? e.handle}`);
});

// ===== the build script =========================================================================

function fixture({ creators = [creator()], listings = [listing()], jobs = [job()], designers = [designer()], media = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'marketplace-'));
  fs.mkdirSync(path.join(root, 'site', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'site', 'lib', 'templates.json'), JSON.stringify({ categories: [], templates: [{ id: 'title-sting' }] }));
  const put = (folder, name, value) => {
    fs.mkdirSync(path.join(root, 'marketplace', folder), { recursive: true });
    fs.writeFileSync(path.join(root, 'marketplace', folder, name), typeof value === 'string' ? value : JSON.stringify(value));
  };
  for (const c of creators) put('creators', `${c.handle}.json`, c);
  for (const l of listings) put('listings', `${l.id}.json`, l);
  for (const j of jobs) put('jobs', `${j.id}.json`, j);
  for (const d of designers) put('designers', `${d.handle}.json`, d);
  for (const m of media) put('media', m, 'bytes');
  return root;
}

test('the build writes every entry, hides an expired job and lists it with --expired', () => {
  const old = job({ id: 'old-job-20260101', posted: '2026-01-01' });
  const root = fixture({ jobs: [job(), old] });
  const out = buildMarketplace({ root, today: TODAY });
  assert.deepEqual(out.jobs.map((j) => j.id), [job().id]);
  assert.equal(out.hidden, 1);
  const written = JSON.parse(fs.readFileSync(path.join(root, 'site', 'lib', 'marketplace.json'), 'utf8'));
  assert.deepEqual(Object.keys(written), ['creators', 'listings', 'jobs', 'designers']);
  assert.equal(written.listings[0].id, 'glitch-titles');
  assert.deepEqual(expiredJobs({ root, today: TODAY }), [{ file: 'marketplace/jobs/old-job-20260101.json', validThrough: '2026-03-02' }]);
});

test('media kept in the repo is copied and served from /marketplace-media; a missing file stops the build', () => {
  const local = listing({ preview: 'media/glitch-titles.mp4', poster: 'media/glitch-titles.webp' });
  assert.throws(() => buildMarketplace({ root: fixture({ listings: [local] }), today: TODAY }), /marketplace\/media\/glitch-titles\.mp4 is named by an entry but is not in the repo/);
  const root = fixture({ listings: [local], media: ['glitch-titles.mp4', 'glitch-titles.webp'] });
  const out = buildMarketplace({ root, today: TODAY });
  assert.equal(out.listings[0].preview, '/marketplace-media/glitch-titles.mp4');
  assert.ok(fs.existsSync(path.join(root, 'site', 'public', 'marketplace-media', 'glitch-titles.webp')));
});

test('the build refuses a bad file, a wrong file name, a missing creator and an id a vawe template uses', () => {
  assert.throws(() => buildMarketplace({ root: fixture({ listings: [listing({ software: 'flash' })] }) }), /listings\/glitch-titles\.json: software/);
  const root = fixture();
  fs.renameSync(path.join(root, 'marketplace', 'listings', 'glitch-titles.json'), path.join(root, 'marketplace', 'listings', 'other.json'));
  assert.throws(() => buildMarketplace({ root }), /file name must be glitch-titles\.json/);
  assert.throws(() => buildMarketplace({ root: fixture({ creators: [] }) }), /creator ana-motion has no file/);
  assert.throws(() => buildMarketplace({ root: fixture({ listings: [listing({ id: 'title-sting' })] }) }), /is a vawe template id/);
  const broken = fixture();
  fs.writeFileSync(path.join(broken, 'marketplace', 'jobs', 'x.json'), '{nope');
  assert.throws(() => buildMarketplace({ root: broken }), /jobs\/x\.json: not valid JSON/);
});

// ===== the submit API, GitHub mocked =============================================================

const listingForm = (over = {}) => ({
  kind: 'listing', title: 'Glitch titles', summary: 'Twelve glitch title cards for trailers.', software: 'after-effects', category: 'titles',
  preview: 'https://cdn.example.com/glitch.mp4', poster: 'https://cdn.example.com/glitch.jpg', price: '19', currency: 'usd', url: 'https://ana.gumroad.com/l/glitch',
  tags: 'glitch, trailer', handle: 'ana-motion', name: 'Ana Ruiz', link: 'https://ana.example.com', fax: '', ...over,
});
const jobForm = (over = {}) => ({
  kind: 'job', title: 'Motion designer', company: 'Northwind', workplace: 'remote', countries: 'us, ca', employment: ['FULL_TIME', 'CONTRACTOR'],
  payMin: '90000', payMax: '120000', currency: 'USD', unit: 'YEAR', software: ['after-effects'], apply: 'https://northwind.example.com/jobs/1',
  description: 'You make launch films and product loops.\r\nYou know After Effects well and can show a reel of shipped work.', ...over,
});
const designerForm = (over = {}) => ({ kind: 'designer', handle: 'ana-motion', name: 'Ana Ruiz', reel: 'https://vimeo.com/123', software: ['after-effects'], availability: 'available', rateAmount: '80', unit: 'HOUR', ...over });

const ENV = { MARKETPLACE_GITHUB_TOKEN: 'ghp_secret', MARKETPLACE_REPO: 'acme/site' };

function fakeFetch({ existing = {}, media = {}, fail = {} } = {}) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const u = String(url);
    const method = init.method ?? 'GET';
    calls.push({ url: u, method, body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers });
    if (!u.startsWith('https://api.github.com/')) {
      const m = media[u] ?? { status: 200, type: u.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg', size: 1000 };
      return new Response(null, { status: m.status, headers: { ...(m.type ? { 'content-type': m.type } : {}), ...(m.size ? { 'content-length': String(m.size) } : {}), ...(m.location ? { location: m.location } : {}) } });
    }
    const p = u.slice('https://api.github.com'.length);
    if (fail[method]) return Response.json({}, { status: fail[method] });
    if (p === '/repos/acme/site/git/ref/heads/main') return Response.json({ object: { sha: 'base-sha' } });
    if (method === 'GET' && p.startsWith('/repos/acme/site/contents/')) {
      const file = decodeURIComponent(p.slice('/repos/acme/site/contents/'.length).split('?')[0]);
      return existing[file] ? Response.json({ content: Buffer.from(JSON.stringify(existing[file])).toString('base64') }) : Response.json({}, { status: 404 });
    }
    if (method === 'POST' && p === '/repos/acme/site/git/refs') return Response.json({}, { status: 201 });
    if (method === 'PUT') return Response.json({}, { status: 201 });
    if (method === 'POST' && p === '/repos/acme/site/pulls') return Response.json({ html_url: 'https://github.com/acme/site/pull/7' }, { status: 201 });
    return Response.json({}, { status: 500 });
  };
  return { impl, calls };
}

const publicLookup = async () => ['93.184.216.34'];

function submit(form, { env = ENV, fetchImpl = fakeFetch().impl, limiter = new RateLimiter(5, 3600000), ip = '203.0.113.9', headers = {}, raw, lookup = publicLookup } = {}) {
  const req = new Request('https://vawe.dev/api/marketplace/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1`, ...headers },
    body: raw ?? JSON.stringify(form),
  });
  return handleSubmit(req, env, { fetch: fetchImpl, lookup, limiter, now: () => new Date(`${TODAY}T12:00:00Z`), branchSuffix: () => 'abc123' });
}

const gh = (calls) => calls.filter((c) => c.url.startsWith('https://api.github.com/'));
const written = (calls) => Object.fromEntries(gh(calls).filter((c) => c.method === 'PUT').map((c) => [decodeURIComponent(c.url.split('/contents/')[1]), JSON.parse(Buffer.from(c.body.content, 'base64').toString('utf8'))]));

test('a valid listing opens one pull request adding the creator and the listing, with the token only sent to GitHub', async () => {
  const { impl, calls } = fakeFetch();
  const res = await submit(listingForm(), { fetchImpl: impl });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { ok: true, pr: 'https://github.com/acme/site/pull/7', files: ['marketplace/creators/ana-motion.json', 'marketplace/listings/glitch-titles.json'] });
  const files = written(calls);
  assert.deepEqual(files['marketplace/listings/glitch-titles.json'], { ...listing(), tags: ['glitch', 'trailer'] });
  assert.deepEqual(files['marketplace/creators/ana-motion.json'], creator());
  const ref = gh(calls).find((c) => c.url.endsWith('/git/refs'));
  assert.deepEqual(ref.body, { ref: 'refs/heads/marketplace/listing-glitch-titles-abc123', sha: 'base-sha' });
  const pr = gh(calls).find((c) => c.url.endsWith('/pulls'));
  assert.equal(pr.body.base, 'main');
  assert.equal(pr.body.title, 'marketplace: listing glitch-titles');
  for (const c of calls) {
    const auth = c.headers?.authorization;
    if (c.url.startsWith('https://api.github.com/')) assert.equal(auth, 'Bearer ghp_secret');
    else assert.equal(auth, undefined, c.url);
  }
  for (const c of calls.filter((c) => !c.url.startsWith('https://api.github.com/'))) assert.equal(c.method, 'HEAD');
});

test('a listing with no media links asks for the files in the pull request', async () => {
  const { impl, calls } = fakeFetch();
  const res = await submit(listingForm({ preview: '', poster: '' }), { fetchImpl: impl });
  assert.equal(res.status, 201);
  const l = written(calls)['marketplace/listings/glitch-titles.json'];
  assert.equal(l.preview, 'media/glitch-titles.mp4');
  assert.equal(l.poster, 'media/glitch-titles.webp');
  assert.match(gh(calls).find((c) => c.url.endsWith('/pulls')).body.body, /Add these files to this pull request before you merge:\n- `marketplace\/media\/glitch-titles\.mp4`/);
  assert.equal(calls.filter((c) => c.method === 'HEAD').length, 0);
});

test('a job gets its date, upper-case countries and a normalised description; a designer gets its handle as the file', async () => {
  const one = fakeFetch();
  assert.equal((await submit(jobForm(), { fetchImpl: one.impl })).status, 201);
  const j = written(one.calls)['marketplace/jobs/northwind-motion-designer-20261121.json'];
  assert.deepEqual(j.countries, ['US', 'CA']);
  assert.equal(j.posted, TODAY);
  assert.deepEqual(j.pay, { min: 90000, max: 120000, currency: 'USD', unit: 'YEAR' });
  assert.ok(!j.description.includes('\r'));
  const two = fakeFetch();
  assert.equal((await submit(designerForm(), { fetchImpl: two.impl })).status, 201);
  assert.deepEqual(written(two.calls)['marketplace/designers/ana-motion.json'].rate, { amount: 80, currency: 'USD', unit: 'HOUR' });
});

test('an invalid form is a 400 that names each field, and GitHub is never called', async () => {
  const { impl, calls } = fakeFetch();
  const res = await submit(listingForm({ software: 'flash', url: 'http://shop.example.com', price: 'ten' }), { fetchImpl: impl });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.errors.some((e) => e.startsWith('software:')));
  assert.ok(body.errors.some((e) => e.startsWith('url:')));
  assert.ok(body.errors.some((e) => e.startsWith('price.amount:')));
  assert.equal(calls.length, 0);
});

test('fields outside the allow-list, wrong value types, bad JSON, a bad kind and a big body are refused before any check', async () => {
  const { impl, calls } = fakeFetch();
  assert.match((await (await submit(listingForm({ isAdmin: 'yes' }), { fetchImpl: impl })).json()).error, /Unknown field: isAdmin/);
  assert.match((await (await submit(listingForm({ title: { $gt: '' } }), { fetchImpl: impl })).json()).error, /Wrong value type: title/);
  assert.equal((await submit(null, { raw: '{nope', fetchImpl: impl })).status, 400);
  assert.equal((await submit(null, { raw: '[1,2]', fetchImpl: impl })).status, 400);
  assert.equal((await submit({ kind: 'admin' }, { fetchImpl: impl })).status, 400);
  assert.equal((await submit(listingForm({ bio: 'x'.repeat(40000) }), { fetchImpl: impl })).status, 413);
  assert.equal((await submit(listingForm(), { headers: { 'content-type': 'text/plain' }, fetchImpl: impl })).status, 415);
  assert.equal(calls.length, 0);
});

test('a filled honeypot gets a quiet 200 and nothing is sent anywhere', async () => {
  const { impl, calls } = fakeFetch();
  const res = await submit(listingForm({ fax: 'buy now' }), { fetchImpl: impl });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 0);
});

test('the sixth submission from one address in an hour is a 429; another address still passes', async () => {
  const limiter = new RateLimiter(5, 3600000);
  const { impl } = fakeFetch();
  for (let i = 0; i < 5; i++) assert.equal((await submit(listingForm({ fax: 'x' }), { limiter, fetchImpl: impl })).status, 200);
  const blocked = await submit(listingForm(), { limiter, fetchImpl: impl });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '3600');
  assert.equal((await submit(listingForm(), { limiter, ip: '198.51.100.4', fetchImpl: impl })).status, 201);
  assert.equal(limiter.allow('203.0.113.9', new Date(`${TODAY}T13:00:01Z`).getTime()), true, 'the window has passed');
});

test('media links are checked with HEAD: type, size, status, redirects and private hosts', async () => {
  const deps = (media, lookup = publicLookup) => ({ fetch: fakeFetch({ media }).impl, lookup });
  const url = 'https://cdn.example.com/a.mp4';
  assert.equal(await checkMedia(url, 'video', deps({})), null);
  assert.match(await checkMedia(url, 'video', deps({ [url]: { status: 200, type: 'text/html', size: 10 } })), /is text\/html, not video\/mp4 or video\/webm/);
  assert.match(await checkMedia(url, 'video', deps({ [url]: { status: 200, type: 'video/mp4', size: 41 * 1048576 } })), /over 40 MB/);
  assert.match(await checkMedia(url, 'video', deps({ [url]: { status: 200, type: 'video/mp4' } })), /does not state its size/);
  assert.match(await checkMedia(url, 'video', deps({ [url]: { status: 404 } })), /answered 404/);
  assert.match(await checkMedia(url, 'video', deps({ [url]: { status: 302, location: 'http://cdn.example.com/a.mp4' } })), /must stay on https/);
  assert.equal(await checkMedia(url, 'video', deps({ [url]: { status: 302, location: '/b.mp4' } })), null);
  assert.match(await checkMedia(url, 'video', deps({}, async () => ['10.0.0.5'])), /must be on a public host/);
  assert.match(await checkMedia('https://127.0.0.1/a.mp4', 'video', deps({})), /public host/);
  assert.match(await checkMedia('https://localhost/a.mp4', 'video', deps({})), /public host/);
  const loop = 'https://cdn.example.com/loop.mp4';
  assert.match(await checkMedia(loop, 'video', deps({ [loop]: { status: 301, location: loop } })), /redirects too many times/);
  for (const ip of ['10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '127.0.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '100.64.0.1']) assert.equal(isPrivateAddress(ip), true, ip);
  for (const ip of ['93.184.216.34', '2606:4700::1111', '172.32.0.1']) assert.equal(isPrivateAddress(ip), false, ip);
});

test('a media link that fails is a 400 before GitHub is called', async () => {
  const preview = 'https://cdn.example.com/glitch.mp4';
  const { impl, calls } = fakeFetch({ media: { [preview]: { status: 200, type: 'application/zip', size: 10 } } });
  const res = await submit(listingForm(), { fetchImpl: impl });
  assert.equal(res.status, 400);
  assert.match((await res.json()).errors[0], /^preview: the link is application\/zip/);
  assert.equal(gh(calls).length, 0);
});

test('an existing listing or handle is a 409; a creator file with the same link is reused, not rewritten', async () => {
  const taken = fakeFetch({ existing: { 'marketplace/listings/glitch-titles.json': listing() } });
  const res = await submit(listingForm(), { fetchImpl: taken.impl });
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /glitch-titles exists/);
  assert.equal(gh(taken.calls).filter((c) => c.method !== 'GET').length, 0);

  const other = fakeFetch({ existing: { 'marketplace/creators/ana-motion.json': creator({ link: 'https://someone-else.example.com' }) } });
  assert.equal((await submit(listingForm(), { fetchImpl: other.impl })).status, 409);

  const same = fakeFetch({ existing: { 'marketplace/creators/ana-motion.json': creator() } });
  const ok = await submit(listingForm(), { fetchImpl: same.impl });
  assert.equal(ok.status, 201);
  assert.deepEqual(Object.keys(written(same.calls)), ['marketplace/listings/glitch-titles.json']);
});

test('no token is a 503 after the checks; a GitHub failure is a 502', async () => {
  assert.equal((await submit(listingForm(), { env: {} })).status, 503);
  assert.equal((await submit(listingForm({ url: 'nope' }), { env: {} })).status, 400);
  assert.equal((await submit(listingForm(), { fetchImpl: fakeFetch({ fail: { PUT: 422 } }).impl })).status, 502);
  const media = fakeFetch().impl;
  const down = async (u, init) => {
    if (String(u).startsWith('https://api.github.com/')) throw new Error('down');
    return media(u, init);
  };
  assert.equal((await submit(listingForm(), { fetchImpl: down })).status, 502);
});

test('every form field is a field the API maps, and the form maps to entries the schema accepts', () => {
  const forms = { listing: listingForm(), job: jobForm(), designer: designerForm() };
  for (const [kind, form] of Object.entries(forms)) {
    const names = FORMS[kind].map((f) => f.name);
    for (const key of Object.keys(form)) if (!['kind', 'fax'].includes(key)) assert.ok(names.includes(key), `${kind}.${key}`);
    for (const f of entriesFromForm(kind, form, TODAY)) assert.deepEqual(CHECKS[f.kind](f.entry), [], `${kind} -> ${f.kind}`);
  }
});
