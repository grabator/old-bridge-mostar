// Content in D1: Mirna's tours and reviews. After every save the whole site is rendered again with the
// same code as the build (src/render.mjs) and the pages are stored in D1, so the change is live at once.
import { render } from '../src/render.mjs';
import C from '../.gen/content.json';

export const BASE_CONTENT = C;

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

// first visit to the admin: copy the tours (and any reviews) from the content files into the database
export async function seed(env) {
  const done = await env.DB.prepare("SELECT value FROM meta WHERE key = 'seeded'").first();
  if (done) return false;
  const st = [];
  for (const t of C.TOURS) st.push(env.DB.prepare('INSERT OR IGNORE INTO tours (slug, data, sort, hidden, updated_at) VALUES (?, ?, ?, 0, ?)').bind(t.slug, JSON.stringify(t), t.order || 99, now()));
  (C.S.reviews.items || []).forEach((r, i) => st.push(env.DB.prepare('INSERT OR IGNORE INTO reviews (id, data, sort, hidden, updated_at) VALUES (?, ?, ?, 0, ?)').bind('r' + (i + 1), JSON.stringify(r), i + 1, now())));
  st.push(env.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded', ?)").bind(now()));
  await env.DB.batch(st);
  return true;
}

export async function loadAll(env) {
  const tours = (await env.DB.prepare('SELECT slug, data, sort, hidden, updated_at FROM tours ORDER BY sort, slug').all()).results
    .map((r) => ({ slug: r.slug, sort: r.sort, hidden: !!r.hidden, updated_at: r.updated_at, data: JSON.parse(r.data) }));
  const reviews = (await env.DB.prepare('SELECT id, data, sort, hidden, updated_at FROM reviews ORDER BY sort, id').all()).results
    .map((r) => ({ id: r.id, sort: r.sort, hidden: !!r.hidden, updated_at: r.updated_at, data: JSON.parse(r.data) }));
  return { tours, reviews };
}

/* ---------- small settings stored in the meta table ---------- */
export async function getMeta(env, key) { const r = await env.DB.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first(); return r ? r.value : null; }
export async function setMeta(env, key, value) { await env.DB.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind(key, String(value)).run(); }
export async function getJSON(env, key, def) { try { const v = await getMeta(env, key); return v == null ? def : JSON.parse(v); } catch { return def; } }

/* ---------- site texts edited in the admin (contact, about, FAQ...) on top of content/site.json ---------- */
const S_TEXT = ['tagline', 'description', 'ticketsNote'];
const S_CONTACT = ['phone', 'whatsapp', 'email', 'instagram', 'tripadvisor', 'meetingPoint'];
export function mergeSite(base, o) {
  const S = JSON.parse(JSON.stringify(base));
  if (!o || typeof o !== 'object') return S;
  S_TEXT.forEach((k) => { if (typeof o[k] === 'string') S[k] = o[k]; });
  if (o.contact) { S_CONTACT.forEach((k) => { if (typeof o.contact[k] === 'string') S.contact[k] = o.contact[k]; }); if (Array.isArray(o.contact.notes)) S.contact.notes = o.contact.notes; }
  if (o.about) { ['short', 'experience'].forEach((k) => { if (typeof o.about[k] === 'string') S.about[k] = o.about[k]; }); ['paragraphs', 'notes'].forEach((k) => { if (Array.isArray(o.about[k])) S.about[k] = o.about[k]; }); }
  ['why', 'services', 'faq', 'onRequest'].forEach((k) => { if (Array.isArray(o[k])) S[k] = o[k]; });
  if (Array.isArray(o.tickets)) S.tickets = S.tickets.map((t) => { const x = o.tickets.find((y) => y && y.id === t.id); return x ? Object.assign({}, t, { label: x.label || t.label, price: x.price }) : t; });
  if (Array.isArray(o.categories)) S.categories = S.categories.map((c) => { const x = o.categories.find((y) => y && y.id === c.id); return x ? Object.assign({}, c, { name: x.name || c.name, intro: x.intro }) : c; });
  return S;
}
export function cleanSite(i) {
  i = i || {};
  const pairs = (v, a, b, na, nb, max) => (Array.isArray(v) ? v : []).map((x) => ({ [a]: str(x && x[a], na), [b]: str(x && x[b], nb) })).filter((x) => x[a] || x[b]).slice(0, max);
  const c = i.contact || {}, ab = i.about || {};
  const num = (v) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : 0; };
  return {
    tagline: str(i.tagline, 200), description: str(i.description, 600), ticketsNote: str(i.ticketsNote, 400),
    contact: { phone: str(c.phone, 40), whatsapp: str(c.whatsapp, 20).replace(/[^\d]/g, ''), email: str(c.email, 120), instagram: str(c.instagram, 60).replace(/^@/, ''), tripadvisor: /^https:\/\//.test(str(c.tripadvisor, 400)) ? str(c.tripadvisor, 400) : '', meetingPoint: str(c.meetingPoint, 200), notes: list(c.notes, 600, 20) },
    about: { short: str(ab.short, 800), experience: str(ab.experience, 200), paragraphs: list(ab.paragraphs, 2000, 12), notes: list(ab.notes, 600, 20) },
    why: pairs(i.why, 't', 'd', 120, 500, 12), services: pairs(i.services, 't', 'd', 120, 500, 16), faq: pairs(i.faq, 'q', 'a', 300, 2000, 30),
    onRequest: list(i.onRequest, 160, 30),
    tickets: (Array.isArray(i.tickets) ? i.tickets : []).filter((t) => t && C.S.tickets.some((b) => b.id === t.id)).map((t) => ({ id: t.id, label: str(t.label, 120), price: num(t.price) })),
    categories: (Array.isArray(i.categories) ? i.categories : []).filter((t) => t && C.S.categories.some((b) => b.id === t.id)).map((t) => ({ id: t.id, name: str(t.name, 80), intro: str(t.intro, 600) }))
  };
}
export async function siteContent(env) {
  const S = mergeSite(C.S, await getJSON(env, 'site', null));
  const d = await getMeta(env, 'draft');
  return { S, DRAFT: d == null ? !!C.DRAFT : d === '1' };
}

// render every page from the current content and store them
export async function publish(env) {
  const { tours, reviews } = await loadAll(env);
  const TOURS = tours.filter((t) => !t.hidden).map((t, i) => Object.assign({}, t.data, { slug: t.slug, order: i + 1 }));
  const items = reviews.filter((r) => !r.hidden).map((r) => r.data);
  const site = await siteContent(env);
  const S = Object.assign({}, site.S, { reviews: Object.assign({}, site.S.reviews, { items }) });
  const out = render({ S, TOURS, PL: C.PL, PHOTOS: C.PHOTOS, V: C.V, DRAFT: site.DRAFT, BASE: C.BASE });
  const st = [env.DB.prepare('DELETE FROM pages')];
  for (const [url, html] of out.pages) st.push(env.DB.prepare('INSERT INTO pages (url, body, type) VALUES (?, ?, ?)').bind(url, html, 'text/html; charset=utf-8'));
  st.push(env.DB.prepare('INSERT INTO pages (url, body, type) VALUES (?, ?, ?)').bind('/sitemap.xml', out.sitemap, 'application/xml; charset=utf-8'));
  st.push(env.DB.prepare('INSERT INTO pages (url, body, type) VALUES (?, ?, ?)').bind('/robots.txt', out.robots, 'text/plain; charset=utf-8'));
  const at = now();
  st.push(env.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('published', ?)").bind(at));
  await env.DB.batch(st);
  return { at, pages: out.pages.length, problems: out.problems };
}

/* ---------- checking what the admin sends ---------- */
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
const list = (v, n, max = 40) => (Array.isArray(v) ? v : []).map((x) => str(x, n)).filter(Boolean).slice(0, max);
const IMG = /^(\/media\/[A-Za-z0-9/_.-]+|[A-Za-z0-9_.-]+\.(?:jpe?g|png|webp))$/;
const img = (v) => { const s = str(v, 300); return IMG.test(s) ? s : ''; };

export function cleanTour(input, existing) {
  const t = input || {};
  const cats = C.S.categories.map((c) => c.id), tickets = C.S.tickets.map((k) => k.id);
  const basis = ['person', 'group', 'request'].includes(t.price && t.price.basis) ? t.price.basis : 'request';
  const amount = Number(t.price && t.price.amount);
  const out = {
    name: str(t.name, 160),
    category: cats.includes(t.category) ? t.category : cats[0],
    featured: !!t.featured,
    tagline: str(t.tagline, 400),
    description: str(t.description, 5000),
    image: img(t.image),
    imageAlt: str(t.imageAlt, 200),
    gallery: (Array.isArray(t.gallery) ? t.gallery : []).map((g) => ({ src: img(g && g.src), alt: str(g && g.alt, 200) })).filter((g) => g.src).slice(0, 24),
    price: basis === 'request' ? { basis, confirmed: !!(t.price && t.price.confirmed) } : { amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0, basis, from: !!(t.price && t.price.from), confirmed: !!(t.price && t.price.confirmed) },
    duration: str(t.duration, 120), location: str(t.location, 160), groupSize: str(t.groupSize, 120), level: str(t.level, 200),
    languages: str(t.languages, 160), meetingPoint: str(t.meetingPoint, 200), availability: str(t.availability, 200),
    itinerary: (Array.isArray(t.itinerary) ? t.itinerary : []).map((s) => ({ text: str(s && s.text, 400), optional: !!(s && s.optional) })).filter((s) => s.text).slice(0, 40),
    included: list(t.included, 300), notIncluded: list(t.notIncluded, 300), practical: list(t.practical, 400),
    tickets: (Array.isArray(t.tickets) ? t.tickets : []).filter((k) => tickets.includes(k)),
    notes: list(t.notes, 600, 20),
    seoTitle: str(t.seoTitle, 120), seoDescription: str(t.seoDescription, 320)
  };
  if (!out.seoTitle) out.seoTitle = out.name;
  if (!out.seoDescription) out.seoDescription = out.tagline.slice(0, 300);
  // fields that are not edited in the admin (the map route) stay as they were
  if (existing && existing.route) out.route = existing.route;
  return out;
}

export function cleanReview(r) {
  r = r || {};
  const rating = Math.round(Number(r.rating) || 5);
  return { name: str(r.name, 80), country: str(r.country, 60), date: str(r.date, 40), rating: Math.max(1, Math.min(5, rating)), title: str(r.title, 140), text: str(r.text, 2500), source: str(r.source, 40) };
}

export function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'tour';
}
