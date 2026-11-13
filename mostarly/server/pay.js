// Online payment page (/pay/) with Monri (https://monri.com), the card processor in Bosnia and Herzegovina.
//
// Flow: the guest enters the amount Mirna confirmed -> POST /api/pay/start saves a pending payment and returns
// the signed Monri form -> the guest pays on Monri's page -> Monri calls POST /api/pay/callback (signed) ->
// the payment is marked paid, added to the planner and Mirna gets a phone notification.
//
// Security:
//  - the merchant key never leaves the server; the amount is signed on the server (digest) and checked again
//    in the callback against what was saved, so a changed amount is rejected
//  - a payment is marked paid ONLY by a callback with a valid Monri signature (never by the browser redirect)
//  - processing is idempotent (a repeated callback does nothing)
//  - limits: amount between PAY_MIN and PAY_MAX, max 5 attempts per visitor in 10 minutes and 20 per day,
//    honeypot field, optional Cloudflare Turnstile (TURNSTILE_SITE_KEY + TURNSTILE_SECRET)
//  - card details are entered only on Monri's page; this site never sees them
//
// Settings (Worker variables): PAY_MODE = off | test | live (default off), PAY_CURRENCY (EUR), PAY_MIN (10),
// PAY_MAX (1000), MONRI_ENV = test | prod; secrets: MONRI_MERCHANT_KEY, MONRI_AUTHENTICITY_TOKEN.
// PAY_MODE=test simulates Monri (no money) and must never be used on the public site.
// When the Monri keys arrive, check the form fields and the callback signature against Monri's documentation
// (docs.monri.com, "WebPay form" / "Callback") before switching PAY_MODE to live.
import { pushAll } from './extra.js';

const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const te = new TextEncoder();
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
async function sha512hex(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-512', te.encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function same(a, b) { a = String(a || ''); b = String(b || ''); if (a.length !== b.length || !a.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
async function ipHash(request) { const ip = request.headers.get('cf-connecting-ip') || ''; if (!ip) return null; return [...new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode('mlypay:' + ip)))].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join(''); }

export function payConfig(env) {
  const hasKeys = !!(env.MONRI_MERCHANT_KEY && env.MONRI_AUTHENTICITY_TOKEN);
  let mode = String(env.PAY_MODE || 'off');
  if (mode === 'live' && !hasKeys) mode = 'off';
  if (!['off', 'test', 'live'].includes(mode)) mode = 'off';
  const currency = /^(EUR|BAM)$/.test(env.PAY_CURRENCY || '') ? env.PAY_CURRENCY : 'EUR';
  return { mode, currency, symbol: currency === 'EUR' ? '€' : 'KM', min: Number(env.PAY_MIN) > 0 ? Number(env.PAY_MIN) : 10, max: Number(env.PAY_MAX) > 0 ? Number(env.PAY_MAX) : 1000, turnstile: env.TURNSTILE_SITE_KEY || null, monriForm: (env.MONRI_ENV === 'prod' ? 'https://ipg.monri.com' : 'https://ipgtest.monri.com') + '/v2/form' };
}

export async function payApi(request, env, path) {
  const cfg = payConfig(env), m = request.method, url = new URL(request.url);
  if (path === '/api/pay/config' && m === 'GET') return J({ mode: cfg.mode, currency: cfg.currency, symbol: cfg.symbol, min: cfg.min, max: cfg.max, turnstile: cfg.turnstile });
  if (!env.DB) return J({ error: 'unavailable' }, 503);

  if (path === '/api/pay/start' && m === 'POST') {
    if (cfg.mode === 'off') return J({ error: 'Online payment is not available yet. Please contact Mirna.' }, 503);
    if ((request.headers.get('content-type') || '').indexOf('application/json') !== 0) return J({ error: 'bad request' }, 415);
    let d; try { d = await request.json(); } catch { return J({ error: 'bad request' }, 400); }
    if (d.website) return J({ error: 'bad request' }, 400); // honeypot
    const amount = Math.round(Number(String(d.amount).replace(',', '.')) * 100);
    if (!Number.isFinite(amount) || amount < cfg.min * 100 || amount > cfg.max * 100) return J({ error: `Please enter an amount between ${cfg.symbol}${cfg.min} and ${cfg.symbol}${cfg.max}.` }, 422);
    const name = str(d.name, 100), email = str(d.email, 160).toLowerCase();
    if (name.length < 2) return J({ error: 'Please enter your name.' }, 422);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return J({ error: 'Please enter a valid email address.' }, 422);
    if (!d.agree) return J({ error: 'Please accept the booking and cancellation terms.' }, 422);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || '')) ? d.date : null;
    const tourSlug = str(d.tourSlug, 80).replace(/[^a-z0-9-]/g, '');
    let tour = str(d.tour, 160);
    if (tourSlug) { const row = await env.DB.prepare('SELECT data FROM tours WHERE slug = ? AND hidden = 0').bind(tourSlug).first(); if (row) tour = JSON.parse(row.data).name; }
    const ih = await ipHash(request);
    if (ih) {
      const r = await env.DB.prepare("SELECT SUM(created_at > datetime('now', '-10 minutes')) AS a, COUNT(*) AS b FROM payments WHERE ip_hash = ? AND created_at > datetime('now', '-1 day')").bind(ih).first();
      if (r && ((r.a || 0) >= 5 || (r.b || 0) >= 20)) return J({ error: 'Too many attempts. Please try again later or contact Mirna.' }, 429);
    }
    const all = await env.DB.prepare("SELECT COUNT(*) AS n FROM payments WHERE created_at > datetime('now', '-1 day')").first();
    if (all && all.n >= 300) return J({ error: 'Online payment is busy. Please try again later.' }, 429);
    if (env.TURNSTILE_SECRET) {
      const fd = new FormData(); fd.append('secret', env.TURNSTILE_SECRET); fd.append('response', str(d.turnstile, 2048)); if (request.headers.get('cf-connecting-ip')) fd.append('remoteip', request.headers.get('cf-connecting-ip'));
      const tv = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: fd }).then((r) => r.json()).catch(() => ({ success: false }));
      if (!tv.success) return J({ error: 'Please confirm you are not a robot and try again.' }, 422);
    }
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const order = 'MLY' + ymd + hex(5).toUpperCase(), key = hex(16);
    await env.DB.prepare("INSERT INTO payments (order_number, view_key, status, amount, currency, name, email, tour_slug, tour, date, ip_hash, mode, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))")
      .bind(order, key, amount, cfg.currency, name, email, tourSlug, tour, date, ih, cfg.mode).run();
    if (cfg.mode === 'test') return J({ ok: true, order, key, mode: 'test' });
    // live: the signed form the browser posts to Monri
    const info = (tour || 'Tour in Mostar').slice(0, 100) + (date ? ' · ' + date : '');
    const fields = {
      authenticity_token: env.MONRI_AUTHENTICITY_TOKEN, order_number: order, amount: String(amount), currency: cfg.currency,
      digest: await sha512hex(env.MONRI_MERCHANT_KEY + order + amount + cfg.currency),
      transaction_type: 'purchase', language: 'en', order_info: info, ch_full_name: name, ch_email: email,
      success_url_override: url.origin + '/pay/?done=' + order, cancel_url_override: url.origin + '/pay/?cancel=' + order, callback_url_override: url.origin + '/api/pay/callback'
    };
    return J({ ok: true, order, key, mode: 'live', form: { action: cfg.monriForm, fields } });
  }

  if (path === '/api/pay/status' && m === 'GET') {
    const o = str(url.searchParams.get('o'), 40), k = str(url.searchParams.get('k'), 40);
    const p = o && await env.DB.prepare('SELECT order_number, view_key, status, amount, currency, name, tour, date FROM payments WHERE order_number = ?').bind(o).first();
    if (!p || !same(p.view_key, k)) return J({ error: 'not found' }, 404);
    return J({ order: p.order_number, status: p.status, amount: p.amount / 100, currency: p.currency, name: p.name, tour: p.tour, date: p.date });
  }

  // test mode only: the fake card page answers here
  if (path === '/api/pay/test' && m === 'POST') {
    if (cfg.mode !== 'test') return J({ error: 'not found' }, 404);
    let d; try { d = await request.json(); } catch { return J({ error: 'bad request' }, 400); }
    const p = await env.DB.prepare('SELECT * FROM payments WHERE order_number = ?').bind(str(d.order, 40)).first();
    if (!p || !same(p.view_key, str(d.key, 40))) return J({ error: 'not found' }, 404);
    if (d.ok) await markPaid(env, p, { test: true }); else await env.DB.prepare("UPDATE payments SET status = 'failed', updated_at = datetime('now') WHERE order_number = ? AND status = 'pending'").bind(p.order_number).run();
    return J({ ok: true });
  }

  // Monri tells us about a payment. Signed with the merchant key: SHA512(merchant_key + raw body).
  if (path === '/api/pay/callback' && m === 'POST') {
    const raw = await request.text();
    if (!env.MONRI_MERCHANT_KEY) return J({ error: 'not configured' }, 503);
    const auth = request.headers.get('authorization') || request.headers.get('http_authorization') || '';
    const got = auth.replace(/^WP3-callback\s+/i, '').trim();
    if (!same(got, await sha512hex(env.MONRI_MERCHANT_KEY + raw))) { console.error('pay callback: bad signature'); return J({ error: 'forbidden' }, 403); }
    let b; try { b = JSON.parse(raw); } catch { return J({ error: 'bad request' }, 400); }
    const p = await env.DB.prepare('SELECT * FROM payments WHERE order_number = ?').bind(str(b.order_number, 40)).first();
    if (!p) return J({ error: 'unknown order' }, 404);
    const approved = String(b.status || '').toLowerCase() === 'approved' || String(b.response_code || '') === '0000';
    if (!approved) { await env.DB.prepare("UPDATE payments SET status = 'failed', provider = ?, updated_at = datetime('now') WHERE order_number = ? AND status = 'pending'").bind(raw.slice(0, 4000), p.order_number).run(); return J({ ok: true }); }
    if (Number(b.amount) !== p.amount || String(b.currency || '').toUpperCase() !== p.currency) { console.error('pay callback: amount mismatch', p.order_number); await env.DB.prepare("UPDATE payments SET status = 'review', provider = ?, updated_at = datetime('now') WHERE order_number = ?").bind(raw.slice(0, 4000), p.order_number).run(); return J({ ok: true }); }
    await markPaid(env, p, { provider: raw.slice(0, 4000) });
    return J({ ok: true });
  }
  return J({ error: 'not found' }, 404);
}

const MJ = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
// paid: save it, add it to the planner (the guest's open enquiry, found by email, or a new entry) and notify
async function markPaid(env, p, extra) {
  const r = await env.DB.prepare("UPDATE payments SET status = 'paid', paid_at = datetime('now'), provider = COALESCE(?, provider), updated_at = datetime('now') WHERE order_number = ? AND status IN ('pending', 'failed')").bind(extra.provider || null, p.order_number).run();
  if (!r.meta.changes) return false; // already processed
  const amount = p.amount / 100, pay = { order: p.order_number, amount, currency: p.currency, at: now(), test: !!extra.test };
  let b = await env.DB.prepare("SELECT id, status, date, data FROM bookings WHERE lower(json_extract(data, '$.email')) = ? AND status NOT IN ('cancelled', 'done') AND created_at > datetime('now', '-180 days') ORDER BY created_at DESC LIMIT 1").bind(p.email).first();
  let id;
  if (b) {
    const d = JSON.parse(b.data);
    d.payments = (d.payments || []).concat([pay]).slice(-20); d.paidOnline = Math.round(((d.paidOnline || 0) + amount) * 100) / 100;
    if (!d.tourSlug && p.tour_slug) d.tourSlug = p.tour_slug; if (!d.tour && p.tour) d.tour = p.tour;
    const st = b.status === 'new' || b.status === 'replied' ? 'confirmed' : b.status;
    await env.DB.prepare('UPDATE bookings SET status = ?, date = COALESCE(date, ?), data = ?, updated_at = ? WHERE id = ?').bind(st, p.date, JSON.stringify(d), now(), b.id).run();
    id = b.id;
  } else {
    id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const d = { name: p.name, email: p.email, phone: '', instagram: '', tourSlug: p.tour_slug || '', tour: p.tour || '', time: '', adults: 0, children: 0, ages: '', tickets: [], price: null, paid: false, meeting: '', lang: '', message: 'Online payment from the website.', note: '', payments: [pay], paidOnline: amount };
    await env.DB.prepare("INSERT INTO bookings (id, status, source, date, data, created_at, updated_at) VALUES (?, 'confirmed', 'site-pay', ?, ?, ?, ?)").bind(id, p.date, JSON.stringify(d), now(), now()).run();
  }
  await env.DB.prepare('UPDATE payments SET booking_id = ? WHERE order_number = ?').bind(id, p.order_number).run();
  const sym = p.currency === 'EUR' ? '€' : ' KM', when = p.date ? ' · ' + (+p.date.slice(8)) + '. ' + MJ[+p.date.slice(5, 7) - 1] : '';
  const short = (() => { const x = String(p.tour || '').split(' – '); return x[0] === 'Mostar City Tour' && x[1] ? x[1] : x[0]; })();
  try { await pushAll(env, { title: 'Uplata: ' + p.name + ' · ' + (p.currency === 'EUR' ? '€' + amount : amount + sym), body: (short || 'Tura') + when + (extra.test ? ' · PROBNA UPLATA' : ''), url: '/admin/#/planer/' + id, tag: 'pay-' + p.order_number }); } catch (e) { console.error('pay notify', e); }
  return true;
}

// for the admin: the latest payments
export async function recentPayments(env) {
  return (await env.DB.prepare('SELECT order_number, status, amount, currency, name, email, tour, date, booking_id, mode, created_at, paid_at FROM payments ORDER BY created_at DESC LIMIT 50').all()).results.map((r) => Object.assign(r, { amount: r.amount / 100 }));
}
