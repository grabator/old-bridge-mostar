// /api/admin/* : what the admin page calls. Every change is saved and the site is published right away.
import { seed, loadAll, publish, cleanTour, cleanReview, slugify, siteContent, BASE_CONTENT as C } from './store.js';
import { extraApi } from './extra.js';

const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const rid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 10);
const MEDIA_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function body(request) { try { return await request.json(); } catch { return null; } }

export async function adminApi(request, env, email) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/^\/api\/admin/, '') || '/';
  const m = request.method;
  // simple guard against requests from other sites: the admin always sends this header
  if (m !== 'GET' && request.headers.get('x-mly-admin') !== '1') return J({ error: 'Missing admin header' }, 403);
  if (!env.DB) return J({ error: 'The database (D1) is not connected to the Worker yet.' }, 503);

  if (p === '/state' && m === 'GET') {
    const seeded = await seed(env);
    if (seeded) await publish(env);
    const { tours, reviews } = await loadAll(env);
    const media = (await env.DB.prepare('SELECT key, name, type, size, w, h, created_at FROM media ORDER BY created_at DESC LIMIT 500').all()).results;
    const pub = await env.DB.prepare("SELECT value FROM meta WHERE key = 'published'").first();
    const site = await siteContent(env);
    return J({ email, tours, reviews, media, publishedAt: pub && pub.value, categories: site.S.categories, tickets: site.S.tickets, contact: site.S.contact, bundledImages: imagesFromContent(), mediaReady: !!env.MEDIA, siteUrl: C.BASE });
  }

  const ex = await extraApi(p, m, request, env, url);
  if (ex) return ex;

  /* ----- tours ----- */
  if (p === '/tours' && m === 'POST') {
    const b = await body(request); if (!b) return J({ error: 'Bad request' }, 400);
    const data = cleanTour(b.data);
    if (!data.name) return J({ error: 'Tura mora imati naziv.' }, 422);
    let slug = slugify(b.slug || data.name), n = 1;
    while (await env.DB.prepare('SELECT 1 FROM tours WHERE slug = ?').bind(slug).first()) slug = slugify(b.slug || data.name) + '-' + (++n);
    const max = await env.DB.prepare('SELECT COALESCE(MAX(sort), 0) AS s FROM tours').first();
    await env.DB.prepare('INSERT INTO tours (slug, data, sort, hidden, updated_at) VALUES (?, ?, ?, ?, ?)').bind(slug, JSON.stringify(data), (max.s || 0) + 1, b.hidden ? 1 : 0, now()).run();
    return J({ ok: true, slug, published: await publish(env) });
  }
  if (p === '/tours/order' && m === 'POST') {
    const b = await body(request); const slugs = (b && Array.isArray(b.slugs)) ? b.slugs.map(String) : [];
    await env.DB.batch(slugs.map((s, i) => env.DB.prepare('UPDATE tours SET sort = ? WHERE slug = ?').bind(i + 1, s)));
    return J({ ok: true, published: await publish(env) });
  }
  let mt = /^\/tours\/([a-z0-9-]+)$/.exec(p);
  if (mt) {
    const slug = mt[1];
    const row = await env.DB.prepare('SELECT data FROM tours WHERE slug = ?').bind(slug).first();
    if (!row) return J({ error: 'Tura ne postoji.' }, 404);
    if (m === 'PUT') {
      const b = await body(request); if (!b) return J({ error: 'Bad request' }, 400);
      const data = cleanTour(b.data, JSON.parse(row.data));
      if (!data.name) return J({ error: 'Tura mora imati naziv.' }, 422);
      await env.DB.prepare('UPDATE tours SET data = ?, hidden = ?, updated_at = ? WHERE slug = ?').bind(JSON.stringify(data), b.hidden ? 1 : 0, now(), slug).run();
      return J({ ok: true, slug, published: await publish(env) });
    }
    if (m === 'DELETE') {
      await env.DB.prepare('DELETE FROM tours WHERE slug = ?').bind(slug).run();
      return J({ ok: true, published: await publish(env) });
    }
  }

  /* ----- reviews ----- */
  if (p === '/reviews' && m === 'POST') {
    const b = await body(request); if (!b) return J({ error: 'Bad request' }, 400);
    const data = cleanReview(b.data);
    if (!data.name || !data.text) return J({ error: 'Recenzija treba ime i tekst.' }, 422);
    const id = rid(), max = await env.DB.prepare('SELECT COALESCE(MAX(sort), 0) AS s FROM reviews').first();
    await env.DB.prepare('INSERT INTO reviews (id, data, sort, hidden, updated_at) VALUES (?, ?, ?, ?, ?)').bind(id, JSON.stringify(data), (max.s || 0) + 1, b.hidden ? 1 : 0, now()).run();
    return J({ ok: true, id, published: await publish(env) });
  }
  if (p === '/reviews/order' && m === 'POST') {
    const b = await body(request); const ids = (b && Array.isArray(b.ids)) ? b.ids.map(String) : [];
    await env.DB.batch(ids.map((s, i) => env.DB.prepare('UPDATE reviews SET sort = ? WHERE id = ?').bind(i + 1, s)));
    return J({ ok: true, published: await publish(env) });
  }
  mt = /^\/reviews\/([a-z0-9]+)$/.exec(p);
  if (mt) {
    const id = mt[1];
    if (m === 'PUT') {
      const b = await body(request); if (!b) return J({ error: 'Bad request' }, 400);
      const data = cleanReview(b.data);
      if (!data.name || !data.text) return J({ error: 'Recenzija treba ime i tekst.' }, 422);
      const r = await env.DB.prepare('UPDATE reviews SET data = ?, hidden = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(data), b.hidden ? 1 : 0, now(), id).run();
      if (!r.meta.changes) return J({ error: 'Recenzija ne postoji.' }, 404);
      return J({ ok: true, id, published: await publish(env) });
    }
    if (m === 'DELETE') {
      await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
      return J({ ok: true, published: await publish(env) });
    }
  }

  /* ----- photos (R2) ----- */
  if (p === '/media' && m === 'PUT') {
    if (!env.MEDIA) return J({ error: 'Spremište za slike (R2) nije povezano.' }, 503);
    const type = (request.headers.get('content-type') || '').split(';')[0];
    if (!MEDIA_TYPES[type]) return J({ error: 'Dozvoljene su JPG, PNG i WebP slike.' }, 415);
    const len = Number(request.headers.get('content-length') || 0);
    if (len > 8 * 1024 * 1024) return J({ error: 'Slika je prevelika (najviše 8 MB).' }, 413);
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 8 * 1024 * 1024) return J({ error: 'Slika je prevelika (najviše 8 MB).' }, 413);
    const name = String(url.searchParams.get('name') || 'slika').slice(0, 120);
    const d = new Date(), key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${rid()}-${slugify(name.replace(/\.[a-z0-9]+$/i, '')).slice(0, 40)}.${MEDIA_TYPES[type]}`;
    await env.MEDIA.put(key, buf, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
    const w = Math.round(Number(url.searchParams.get('w')) || 0), h = Math.round(Number(url.searchParams.get('h')) || 0);
    await env.DB.prepare('INSERT INTO media (key, name, type, size, w, h, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(key, name, type, buf.byteLength, w, h, now()).run();
    return J({ ok: true, key, url: '/media/' + key });
  }
  mt = /^\/media\/(.+)$/.exec(p);
  if (mt && m === 'DELETE') {
    const key = decodeURIComponent(mt[1]);
    if (!/^[A-Za-z0-9/_.-]+$/.test(key)) return J({ error: 'Bad key' }, 400);
    const used = (await env.DB.prepare('SELECT slug, data FROM tours WHERE data LIKE ?').bind('%/media/' + key + '%').all()).results;
    if (used.length && url.searchParams.get('force') !== '1') return J({ error: 'Slika se koristi u turi: ' + used.map((u) => JSON.parse(u.data).name).join(', '), used: used.map((u) => u.slug) }, 409);
    if (env.MEDIA) await env.MEDIA.delete(key);
    await env.DB.prepare('DELETE FROM media WHERE key = ?').bind(key).run();
    return J({ ok: true });
  }

  /* ----- planner: enquiries and bookings ----- */
  if (p === '/bookings' && m === 'GET') {
    const rows = (await env.DB.prepare('SELECT id, status, source, date, data, created_at, updated_at FROM bookings ORDER BY created_at DESC LIMIT 3000').all()).results;
    return J({ bookings: rows.map((r) => ({ id: r.id, status: r.status, source: r.source, date: r.date, created_at: r.created_at, updated_at: r.updated_at, data: JSON.parse(r.data) })) });
  }
  if (p === '/bookings' && m === 'POST') {
    const b = await body(request); if (!b) return J({ error: 'Bad request' }, 400);
    const c = cleanBooking(b);
    if (!c.data.name) return J({ error: 'Upišite ime gosta.' }, 422);
    const id = rid() + rid().slice(0, 2);
    await env.DB.prepare('INSERT INTO bookings (id, status, source, date, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, c.status, c.source, c.date, JSON.stringify(c.data), now(), now()).run();
    return J({ ok: true, id });
  }
  mt = /^\/bookings\/([a-z0-9]+)$/.exec(p);
  if (mt) {
    const id = mt[1];
    if (m === 'PUT') {
      const b = await body(request); if (!b) return J({ error: 'Bad request' }, 400);
      const c = cleanBooking(b);
      if (!c.data.name) return J({ error: 'Upišite ime gosta.' }, 422);
      const r = await env.DB.prepare('UPDATE bookings SET status = ?, source = ?, date = ?, data = ?, updated_at = ? WHERE id = ?').bind(c.status, c.source, c.date, JSON.stringify(c.data), now(), id).run();
      if (!r.meta.changes) return J({ error: 'Ne postoji.' }, 404);
      return J({ ok: true, id });
    }
    if (m === 'DELETE') {
      await env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id).run();
      return J({ ok: true });
    }
  }

  if (p === '/publish' && m === 'POST') return J({ ok: true, published: await publish(env) });
  return J({ error: 'Not found' }, 404);
}

// photos that came with the site (src/img), offered in the photo picker next to Mirna's uploads
function imagesFromContent() {
  const set = new Set();
  for (const t of C.TOURS) if (t.image && !t.image.startsWith('/')) set.add(t.image);
  ['hero-d.jpg', 'hero-m.jpg', 'panorama.jpg', 'sumrak.jpg', 'kriva.jpg', 'night-m.jpg'].forEach((f) => set.add(f));
  return [...set];
}

// GET /media/<key>: photos uploaded in the admin
export async function serveMedia(request, env) {
  if (!env.MEDIA) return new Response('Not found', { status: 404 });
  const key = decodeURIComponent(new URL(request.url).pathname.slice('/media/'.length));
  if (!/^[A-Za-z0-9/_.-]+$/.test(key)) return new Response('Not found', { status: 404 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('cache-control', 'public, max-age=31536000, immutable');
  h.set('x-content-type-options', 'nosniff');
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers: h });
}

/* ---------- planner entries ---------- */
const STATUSES = ['new', 'replied', 'confirmed', 'done', 'cancelled'];
const SOURCES = ['site-email', 'site-whatsapp', 'instagram', 'whatsapp', 'phone', 'email', 'agency', 'walkin', 'other'];
function cleanBooking(b) {
  const s = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
  const d = b.data || {};
  const num = (v) => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : null; };
  const int = (v) => Math.max(0, Math.min(99, parseInt(v, 10) || 0));
  return {
    status: STATUSES.includes(b.status) ? b.status : 'new',
    source: SOURCES.includes(b.source) ? b.source : 'other',
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? b.date : null,
    data: {
      name: s(d.name, 120), phone: s(d.phone, 60), email: s(d.email, 160), instagram: s(d.instagram, 60).replace(/^@/, ''),
      tourSlug: s(d.tourSlug, 80).replace(/[^a-z0-9-]/g, ''), tour: s(d.tour, 200), time: s(d.time, 20),
      adults: int(d.adults), children: int(d.children), ages: s(d.ages, 60),
      tickets: (Array.isArray(d.tickets) ? d.tickets : []).map((t) => s(t, 80)).filter(Boolean).slice(0, 10),
      price: num(d.price), paid: !!d.paid, meeting: s(d.meeting, 200), lang: s(d.lang, 40),
      message: s(d.message, 3000), note: s(d.note, 3000), reviewAsked: !!d.reviewAsked
    }
  };
}
