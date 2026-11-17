// The free guide and the mailing list (called from worker.js)
//  POST /api/subscribe        a visitor asks for the free guide: saved with their consent (D1, table subscribers),
//                             the guide is shown right away and, if Resend is set up, also sent by email
//  GET|POST /api/unsubscribe  one click from the link in every email (POST is the one-click unsubscribe of mail apps)
// At most 5 sign-ups per visitor per 10 minutes. Without the database the guide is still shown, nothing is saved.
import { notifySub } from '../../server/extra.js';

import { CONSENT } from '../../src/consent.mjs';
const clean = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export function guideLinks(base, pdf) {
  return { page: base + '/guide/mostar-herzegovina-tips/', pdf: base + (pdf || '/guide/mostarly-mostar-herzegovina-guide.pdf') };
}

export async function subscribe({ request, env, ctx, site }) {
  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: 'bad request' }, 400); }
  const base = new URL(request.url).origin;
  const links = guideLinks(base, site && site.guide && site.guide.pdf);
  if (d.website) return json({ ok: true, mailed: false, links }); // honeypot: bots get a fake success
  const email = clean(d.email, 160).toLowerCase();
  const name = clean(d.name, 80);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return json({ ok: false, error: 'bad email' }, 422);
  if (d.consent !== true) return json({ ok: false, error: 'consent required' }, 422);
  const source = clean(d.source, 60).replace(/[^a-z0-9/_-]/gi, '') || 'guide';

  let token = null, isNew = false;
  if (env.DB) {
    try {
      const ip = request.headers.get('cf-connecting-ip') || '';
      const ipHash = ip ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mly-sub:' + ip)))].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('') : null;
      if (ipHash) {
        const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM subscribers WHERE ip_hash = ? AND created_at > datetime('now', '-10 minutes')").bind(ipHash).first();
        if (recent && recent.n >= 5) return json({ ok: false, error: 'too many requests' }, 429);
      }
      const row = await env.DB.prepare('SELECT id, token, unsubscribed_at FROM subscribers WHERE email = ?').bind(email).first();
      if (row) {
        token = row.token;
        // signing up again after unsubscribing counts as a new consent
        await env.DB.prepare('UPDATE subscribers SET unsubscribed_at = NULL, name = COALESCE(NULLIF(?, \'\'), name), consent_text = ?, created_at = CASE WHEN unsubscribed_at IS NULL THEN created_at ELSE ? END WHERE id = ?').bind(name, CONSENT, now(), row.id).run();
        isNew = !!row.unsubscribed_at;
      } else {
        token = hex(16);
        await env.DB.prepare('INSERT INTO subscribers (id, email, name, source, consent_text, token, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(hex(6), email, name, source, CONSENT, token, ipHash, now()).run();
        isNew = true;
      }
      if (isNew) { const n = notifySub(env, { email, name, source }).catch((e) => console.error('notify sub', e)); if (ctx && ctx.waitUntil) ctx.waitUntil(n); }
    } catch (e) { console.error('subscribe save', e); }
  }

  let mailed = false;
  if (env.RESEND_API_KEY) {
    try {
      const unsub = token ? base + '/api/unsubscribe?t=' + token : '';
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: env.NEWS_FROM || env.MAIL_FROM || 'Mostarly Guide <hello@mostarlyguide.com>',
          to: [email],
          reply_to: env.MAIL_TO || 'mostarlyguide@gmail.com',
          subject: 'Your free guide: Mostar & Herzegovina, the local way',
          html: guideMail({ name, links, unsub }),
          text: guideText({ name, links, unsub }),
          headers: unsub ? { 'List-Unsubscribe': '<' + unsub + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined
        })
      });
      mailed = r.ok;
      if (mailed && env.DB) await env.DB.prepare('UPDATE subscribers SET mailed = 1 WHERE email = ?').bind(email).run();
    } catch (e) { console.error('subscribe mail', e); }
  }
  return json({ ok: true, mailed, links });
}

function guideText({ name, links, unsub }) {
  return `Hello${name ? ' ' + name : ''},

thank you for downloading the guide! Here it is:

Read it online: ${links.page}
Download the PDF: ${links.pdf}

If you have a question about your trip, just reply to this email.

See you in Mostar,
Mirna, Mostarly Guide
${unsub ? '\nYou receive this email because you asked for the free guide. Unsubscribe: ' + unsub : ''}`;
}

function guideMail({ name, links, unsub }) {
  const btn = (href, label, bg, fg) => `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:${fg};text-decoration:none;font-weight:700;padding:13px 22px;border-radius:999px;margin:4px 6px 4px 0">${label}</a>`;
  return `<!doctype html><html><body style="margin:0;background:#f6f0e6;font-family:Arial,Helvetica,sans-serif;color:#26252f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f0e6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffaf2;border-radius:20px;overflow:hidden;border:1px solid #ddd2bf">
<tr><td style="background:#272838;padding:26px 28px;color:#f6f0e6"><p style="margin:0;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#48e5c2">Free guide</p><h1 style="margin:8px 0 0;font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.25">Mostar &amp; Herzegovina, the local way</h1></td></tr>
<tr><td style="padding:26px 28px;font-size:16px;line-height:1.6">
<p style="margin:0 0 14px">Hello${name ? ' ' + esc(name) : ''},</p>
<p style="margin:0 0 18px">thank you for downloading the guide! Inside are 12 tips I give my friends before they visit: when to see the Old Bridge without the crowds, what to eat and how to plan a day around Herzegovina.</p>
<p style="margin:0 0 18px">${btn(links.page, 'Read the guide', '#0a8a71', '#ffffff')}${btn(links.pdf, 'Download the PDF', '#272838', '#f6f0e6')}</p>
<p style="margin:0 0 14px">Planning your trip and have a question? Just reply to this email.</p>
<p style="margin:0">See you in Mostar,<br><b>Mirna</b><br>Mostarly Guide</p>
</td></tr>
${unsub ? `<tr><td style="padding:16px 28px 22px;font-size:12px;line-height:1.5;color:#6f6a66;border-top:1px solid #ece3d4">You receive this email because you asked for the free guide on the Mostarly Guide website. <a href="${esc(unsub)}" style="color:#6f6a66">Unsubscribe</a></td></tr>` : ''}
</table></td></tr></table></body></html>`;
}

export async function unsubscribe(request, env) {
  const url = new URL(request.url);
  const t = String(url.searchParams.get('t') || '').replace(/[^a-f0-9]/g, '').slice(0, 64);
  let ok = false;
  if (t && env.DB) {
    try {
      const r = await env.DB.prepare('UPDATE subscribers SET unsubscribed_at = ? WHERE token = ? AND unsubscribed_at IS NULL').bind(now(), t).run();
      const row = await env.DB.prepare('SELECT 1 FROM subscribers WHERE token = ?').bind(t).first();
      ok = !!row || !!(r && r.meta && r.meta.changes);
    } catch (e) { console.error('unsubscribe', e); }
  }
  if (request.method === 'POST') return new Response(ok ? 'Unsubscribed' : 'Not found', { status: ok ? 200 : 404 });
  const msg = ok ? ['You are unsubscribed', 'You will not receive any more emails from Mostarly Guide. Thank you for your interest, and we hope to see you in Mostar one day.'] : ['Link not valid', 'This unsubscribe link is not valid any more. If you still receive emails, reply to one of them and we will remove you.'];
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${msg[0]} · Mostarly Guide</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f0e6;color:#26252f;font-family:system-ui,sans-serif;padding:1.5rem;text-align:center"><div style="max-width:440px"><h1 style="font-family:Georgia,serif;font-weight:400">${msg[0]}</h1><p style="line-height:1.6">${msg[1]}</p><p><a href="/" style="color:#0a8a71;font-weight:700">Back to Mostarly Guide</a></p></div></body></html>`, { status: ok ? 200 : 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
