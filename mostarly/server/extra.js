// Extras for Mirna's admin:
//  - message templates (WhatsApp / email), busy days, site texts, the "site is finished" switch
//  - a private calendar feed (/cal/<token>.ics) that Google Calendar or the iPhone calendar subscribes to
//  - phone notifications (Web Push) for new enquiries and a reminder in the evening for tomorrow's tours
import { getMeta, setMeta, getJSON, publish, cleanSite, siteContent, BASE_CONTENT as C } from './store.js';

const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
async function body(request) { try { return await request.json(); } catch { return null; } }
export function todayMostar(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sarajevo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/* ---------- message templates ---------- */
export const DEFAULT_TEMPLATES = [
  { id: 'en-thanks', name: 'Zahvala na upitu', lang: 'EN', text: 'Hello {ime}, this is Mirna from Mostarly Guide. Thank you for your enquiry about {tura}! ' },
  { id: 'en-confirm', name: 'Potvrda ture', lang: 'EN', text: 'Hello {ime}, your tour is confirmed: {tura}, {datum} at {vrijeme}. Meeting point: {mjesto}. Price: {cijena}. See you in Mostar! Mirna' },
  { id: 'en-reminder', name: 'Podsjetnik dan prije', lang: 'EN', text: 'Hello {ime}, a quick reminder for tomorrow: {tura} at {vrijeme}, meeting point: {mjesto}. Comfortable shoes are a good idea. See you soon! Mirna' },
  { id: 'en-review', name: 'Molba za recenziju', lang: 'EN', text: 'Hello {ime}, thank you so much for exploring Mostar with me! If you enjoyed the tour, a short review would mean a lot to me: {recenzija} Mirna' },
  { id: 'en-pay', name: 'Link za plaćanje', lang: 'EN', text: 'Hello {ime}, your tour {tura} on {datum} is reserved for you. To confirm it, please pay the deposit here: {placanje} Thank you! Mirna' },
  { id: 'de-thanks', name: 'Zahvala na upitu', lang: 'DE', text: 'Hallo {ime}, hier ist Mirna von Mostarly Guide. Vielen Dank für Ihre Anfrage zu {tura}! ' },
  { id: 'de-confirm', name: 'Potvrda ture', lang: 'DE', text: 'Hallo {ime}, Ihre Tour ist bestätigt: {tura}, {datum} um {vrijeme}. Treffpunkt: {mjesto}. Preis: {cijena}. Bis bald in Mostar! Mirna' },
  { id: 'de-reminder', name: 'Podsjetnik dan prije', lang: 'DE', text: 'Hallo {ime}, eine kurze Erinnerung für morgen: {tura} um {vrijeme}, Treffpunkt: {mjesto}. Bequeme Schuhe sind eine gute Idee. Bis morgen! Mirna' },
  { id: 'de-review', name: 'Molba za recenziju', lang: 'DE', text: 'Hallo {ime}, vielen Dank, dass Sie Mostar mit mir entdeckt haben! Wenn Ihnen die Tour gefallen hat, würde mich eine kurze Bewertung sehr freuen: {recenzija} Mirna' },
  { id: 'de-pay', name: 'Link za plaćanje', lang: 'DE', text: 'Hallo {ime}, Ihre Tour {tura} am {datum} ist für Sie reserviert. Zur Bestätigung zahlen Sie bitte hier die Anzahlung: {placanje} Vielen Dank! Mirna' },
];
function cleanTemplates(v) {
  return (Array.isArray(v) ? v : []).map((t, i) => ({ id: str(t && t.id, 40).replace(/[^a-z0-9-]/gi, '') || 't' + Date.now().toString(36) + i, name: str(t && t.name, 80) || 'Šablon', lang: str(t && t.lang, 8).toUpperCase(), text: str(t && t.text, 2000) })).filter((t) => t.text).slice(0, 40);
}
// templates added in a later version are offered once; the ones Mirna deleted on purpose do not come back
const FIRST_DEFAULTS = ['en-thanks', 'en-confirm', 'en-reminder', 'en-review', 'de-thanks', 'de-confirm', 'de-reminder', 'de-review'];
async function templatesWithNew(env) {
  let T = await getJSON(env, 'templates', null);
  if (!T) return DEFAULT_TEMPLATES;
  const seen = await getJSON(env, 'tpl_defaults', FIRST_DEFAULTS);
  const add = DEFAULT_TEMPLATES.filter((t) => !seen.includes(t.id) && !T.some((x) => x.id === t.id));
  if (add.length) { T = T.concat(add); await setMeta(env, 'templates', JSON.stringify(T)); }
  if (DEFAULT_TEMPLATES.some((t) => !seen.includes(t.id))) await setMeta(env, 'tpl_defaults', JSON.stringify(DEFAULT_TEMPLATES.map((t) => t.id)));
  return T;
}
async function blockedDates(env) { return (await getJSON(env, 'blocked', [])).filter((d) => ISO.test(d)); }

/* ---------- /api/admin/... extras ---------- */
export async function extraApi(p, m, request, env, url) {
  if (p === '/settings' && m === 'GET') {
    const site = await siteContent(env);
    const token = await getMeta(env, 'ical_token');
    const subs = (await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs').first()) || { n: 0 };
    return J({
      templates: await templatesWithNew(env),
      blocked: await blockedDates(env),
      site: siteForm(site.S), draft: site.DRAFT,
      icalUrl: token ? url.origin + '/cal/' + token + '.ics' : null,
      pushKey: await vapidPublic(env), pushCount: subs.n
    });
  }
  if (p === '/templates' && m === 'PUT') {
    const b = await body(request); if (!b) return J({ error: 'Bad request' }, 400);
    const t = cleanTemplates(b.templates);
    await setMeta(env, 'templates', JSON.stringify(t));
    return J({ ok: true, templates: t });
  }
  if (p === '/blocked' && m === 'PUT') {
    const b = await body(request); if (!b) return J({ error: 'Bad request' }, 400);
    const past = todayMostar(-1);
    const dates = [...new Set((Array.isArray(b.dates) ? b.dates : []).map(String).filter((d) => ISO.test(d) && d >= past))].sort().slice(0, 500);
    await setMeta(env, 'blocked', JSON.stringify(dates));
    return J({ ok: true, blocked: dates });
  }
  if (p === '/site' && m === 'PUT') {
    const b = await body(request); if (!b) return J({ error: 'Bad request' }, 400);
    const o = cleanSite(b.site);
    if (!o.contact.phone && !o.contact.email) return J({ error: 'Upišite bar telefon ili email.' }, 422);
    await setMeta(env, 'site', JSON.stringify(o));
    if (typeof b.draft === 'boolean') await setMeta(env, 'draft', b.draft ? '1' : '0');
    const published = await publish(env);
    const site = await siteContent(env);
    return J({ ok: true, published, site: siteForm(site.S), draft: site.DRAFT });
  }
  if (p === '/ical/reset' && m === 'POST') {
    const t = hex(18);
    await setMeta(env, 'ical_token', t);
    return J({ ok: true, icalUrl: url.origin + '/cal/' + t + '.ics' });
  }
  if (p === '/push/subscribe' && m === 'POST') {
    const b = await body(request);
    const ep = str(b && b.endpoint, 1000), k = b && b.keys;
    if (!/^https:\/\//.test(ep) || !k || !k.p256dh || !k.auth) return J({ error: 'Bad subscription' }, 400);
    await env.DB.prepare('INSERT OR REPLACE INTO push_subs (endpoint, keys, ua, created_at) VALUES (?, ?, ?, ?)').bind(ep, JSON.stringify({ p256dh: str(k.p256dh, 200), auth: str(k.auth, 100) }), str(request.headers.get('user-agent'), 200), new Date().toISOString()).run();
    return J({ ok: true });
  }
  if (p === '/push/unsubscribe' && m === 'POST') {
    const b = await body(request);
    await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(str(b && b.endpoint, 1000)).run();
    return J({ ok: true });
  }
  if (p === '/push/test' && m === 'POST') {
    const r = await pushAll(env, { title: 'Mostarly · probno obavještenje', body: 'Obavještenja rade. Ovako ćete saznati za svaki novi upit.', url: '/admin/#/planer', tag: 'test' });
    return J({ ok: true, sent: r.sent, failed: r.failed });
  }
  return null;
}

// the editable part of the site texts, as the admin form uses it
function siteForm(S) {
  return {
    tagline: S.tagline || '', description: S.description || '', ticketsNote: S.ticketsNote || '',
    contact: { phone: S.contact.phone || '', whatsapp: S.contact.whatsapp || '', email: S.contact.email || '', instagram: S.contact.instagram || '', tripadvisor: S.contact.tripadvisor || '', meetingPoint: S.contact.meetingPoint || '', notes: S.contact.notes || [] },
    about: { short: S.about.short || '', experience: S.about.experience || '', paragraphs: S.about.paragraphs || [], notes: S.about.notes || [] },
    why: S.why || [], services: S.services || [], faq: S.faq || [], onRequest: S.onRequest || [],
    company: Object.assign({ name: '', address: '', idNumber: '', vatNumber: '' }, S.company || {}), policy: Object.assign({ depositPercent: 30, freeCancelHours: 48 }, S.policy || {}),
    tickets: S.tickets.map((t) => ({ id: t.id, label: t.label, price: t.price })),
    categories: S.categories.map((c) => ({ id: c.id, name: c.name, intro: c.intro || '' }))
  };
}

/* ---------- public: busy days for the date picker on the site ---------- */
export async function publicBlocked(env) {
  let dates = [];
  if (env.DB) { try { const t = todayMostar(); dates = (await blockedDates(env)).filter((d) => d >= t); } catch { dates = []; } }
  return new Response(JSON.stringify({ dates }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=120' } });
}

/* ---------- calendar feed ---------- */
const TOUR_NAME = (d, tours) => { const t = tours[d.tourSlug]; const n = (t && t.name) || d.tour || 'Tura po dogovoru'; return n; };
function icsText(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1'); }
function fold(line) {
  const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = '';
  for (const ch of line) { if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch; }
  out.push(cur); return out.join('\r\n ');
}
const VTZ = ['BEGIN:VTIMEZONE', 'TZID:Europe/Sarajevo', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'];
export async function icsFeed(env, token) {
  const nf = () => new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
  if (!env.DB || !/^[a-f0-9]{36}$/.test(token)) return nf();
  const real = await getMeta(env, 'ical_token');
  if (!real || real !== token) return nf();
  const rows = (await env.DB.prepare("SELECT id, status, date, data, updated_at FROM bookings WHERE date IS NOT NULL AND status IN ('confirmed', 'done') ORDER BY date LIMIT 2000").all()).results;
  const tours = {}; (await env.DB.prepare('SELECT slug, data FROM tours').all()).results.forEach((r) => { tours[r.slug] = JSON.parse(r.data); });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mostarly Guide//Planer//BS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Mostarly ture', 'X-WR-TIMEZONE:Europe/Sarajevo', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H', ...VTZ];
  for (const r of rows) {
    const d = JSON.parse(r.data), ymd = r.date.replace(/-/g, '');
    const g = (d.adults || 0) + (d.children || 0);
    L.push('BEGIN:VEVENT', 'UID:' + r.id + '@mostarly-planer', 'DTSTAMP:' + stamp);
    const tm = /^(\d{1,2}):(\d{2})$/.exec(d.time || '');
    if (tm) {
      const h = +tm[1], mi = +tm[2], end = new Date(Date.UTC(+r.date.slice(0, 4), +r.date.slice(5, 7) - 1, +r.date.slice(8), h + 2, mi));
      const p2 = (n) => String(n).padStart(2, '0');
      L.push('DTSTART;TZID=Europe/Sarajevo:' + ymd + 'T' + p2(h) + p2(mi) + '00', 'DTEND;TZID=Europe/Sarajevo:' + end.toISOString().slice(0, 10).replace(/-/g, '') + 'T' + p2(end.getUTCHours()) + p2(end.getUTCMinutes()) + '00');
    } else {
      const nx = new Date(Date.UTC(+r.date.slice(0, 4), +r.date.slice(5, 7) - 1, +r.date.slice(8) + 1)).toISOString().slice(0, 10).replace(/-/g, '');
      L.push('DTSTART;VALUE=DATE:' + ymd, 'DTEND;VALUE=DATE:' + nx);
    }
    L.push('SUMMARY:' + icsText(TOUR_NAME(d, tours) + ' · ' + (d.name || 'gost') + (g ? ' (' + g + ')' : '')));
    const desc = [d.name, d.phone, d.email, d.instagram ? '@' + d.instagram : '', 'Gosti: ' + (d.adults || 0) + (d.children ? ' + ' + d.children + ' djece' : ''), d.time && !tm ? 'Vrijeme: ' + d.time : '', d.price != null ? 'Cijena: €' + d.price + (d.paid ? ' (plaćeno)' : '') : '', (d.tickets || []).length ? 'Ulaznice: ' + d.tickets.join(', ') : '', d.note ? 'Bilješka: ' + d.note : ''].filter(Boolean).join('\n');
    L.push('DESCRIPTION:' + icsText(desc));
    if (d.meeting) L.push('LOCATION:' + icsText(d.meeting + ', Mostar'));
    if (r.status === 'done') L.push('STATUS:CONFIRMED');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return new Response(L.map(fold).join('\r\n') + '\r\n', { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'private, max-age=300', 'x-robots-tag': 'noindex' } });
}

/* ---------- Web Push (RFC 8291 encryption + RFC 8292 VAPID), only WebCrypto ---------- */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ub64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const te = new TextEncoder();

// the VAPID key pair is made once by the Worker itself and kept in D1, so no secret has to be set up by hand
async function vapid(env) {
  const v = await getJSON(env, 'vapid', null);
  if (v && v.priv && v.pub) return v;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await crypto.subtle.exportKey('jwk', kp.privateKey), pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const nv = { priv, pub };
  await env.DB.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('vapid', ?)").bind(JSON.stringify(nv)).run();
  return getJSON(env, 'vapid', nv); // if two requests raced, everyone uses the one that was stored
}
async function vapidPublic(env) { try { return (await vapid(env)).pub; } catch { return null; } }
async function vapidHeader(env, endpoint) {
  const v = await vapid(env);
  const aud = new URL(endpoint).origin;
  const h = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: C.BASE || 'https://mostarlyguide.com' })));
  const key = await crypto.subtle.importKey('jwk', v.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(h + '.' + c));
  return 'vapid t=' + h + '.' + c + '.' + b64u(sig) + ', k=' + v.pub;
}
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
// encrypt one message for one subscription (aes128gcm content coding)
export async function encryptPush(payload, p256dh, auth) {
  const ua = ub64(p256dh), secret = ub64(auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(secret, shared, cat(te.encode('WebPush: info\0'), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(te.encode(payload), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt, 0); new DataView(head.buffer).setUint32(16, 4096); head[20] = 65;
  return cat(head, asPub, ct);
}
export async function pushAll(env, msg) {
  let sent = 0, failed = 0;
  if (!env.DB) return { sent, failed };
  const subs = (await env.DB.prepare('SELECT endpoint, keys FROM push_subs').all()).results;
  const payload = JSON.stringify(msg);
  await Promise.all(subs.map(async (s) => {
    try {
      const k = JSON.parse(s.keys);
      const r = await fetch(s.endpoint, { method: 'POST', headers: { authorization: await vapidHeader(env, s.endpoint), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '86400', urgency: 'high', topic: String(msg.tag || 'mly').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || 'mly' }, body: await encryptPush(payload, k.p256dh, k.auth) });
      if (r.status === 404 || r.status === 410) { await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(s.endpoint).run(); failed++; }
      else if (r.ok) sent++; else { failed++; console.error('push', r.status, await r.text().catch(() => '')); }
    } catch (e) { failed++; console.error('push error', e); }
  }));
  return { sent, failed };
}

const MJESECI = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
const SHORT = (n) => { const p = String(n).split(' – '); return p[0] === 'Mostar City Tour' && p[1] ? p[1] : p[0]; };
// a new enquiry from the site
export async function notifyNew(env, d, date) {
  const tours = {}; try { (await env.DB.prepare('SELECT slug, data FROM tours').all()).results.forEach((r) => { tours[r.slug] = JSON.parse(r.data); }); } catch {}
  const when = date ? (+date.slice(8)) + '. ' + MJESECI[+date.slice(5, 7) - 1] : 'datum fleksibilan';
  const g = (d.adults || 0) + (d.children || 0);
  return pushAll(env, { title: 'Novi upit: ' + (d.name || 'gost'), body: SHORT(TOUR_NAME(d, tours)) + ' · ' + when + (g ? ' · ' + g + (g === 1 ? ' osoba' : ' osobe') : ''), url: '/admin/#/planer', tag: 'enquiry' });
}

// every evening: tomorrow's tours
export async function eveningReminder(env) {
  if (!env.DB) return;
  const t = todayMostar(1);
  const rows = (await env.DB.prepare("SELECT data FROM bookings WHERE date = ? AND status = 'confirmed'").bind(t).all()).results.map((r) => JSON.parse(r.data));
  if (!rows.length) return;
  const tours = {}; (await env.DB.prepare('SELECT slug, data FROM tours').all()).results.forEach((r) => { tours[r.slug] = JSON.parse(r.data); });
  rows.sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const lines = rows.slice(0, 4).map((d) => (/\d/.test(d.time) ? d.time + ' ' : '') + SHORT(TOUR_NAME(d, tours)) + ' · ' + (d.name || ''));
  await pushAll(env, { title: 'Sutra: ' + rows.length + (rows.length === 1 ? ' tura' : ' ture'), body: lines.join('\n'), url: '/admin/#/planer', tag: 'tomorrow' });
}
