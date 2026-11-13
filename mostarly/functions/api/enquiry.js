// POST /api/enquiry (called from worker.js)
// 1. Saves every enquiry in Mirna's planner (D1, table bookings), also the ones sent on WhatsApp
//    (channel: 'whatsapp'), so nothing is lost. At most 6 enquiries per visitor per 10 minutes.
// 2. For email enquiries, sends them to the inbox through Resend (RESEND_API_KEY, MAIL_TO, MAIL_FROM).
//    Without RESEND_API_KEY it answers 501 and the site opens the visitor's email app instead.
import { notifyNew } from '../../server/extra.js';

const clean = (v, n = 500) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function onRequestPost({ request, env, ctx }) {
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: 'bad request' }, 400); }
  if (d.website) return json({ ok: true }); // honeypot: bots get a fake success
  const name = clean(d.name, 120);
  const email = clean(d.email, 160);
  const phone = clean(d.phone, 60);
  if (!name || (!email && !phone)) return json({ ok: false, error: 'missing contact' }, 422);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: 'bad email' }, 422);
  const channel = d.channel === 'whatsapp' ? 'whatsapp' : 'email';

  // save in the planner
  let saved = false;
  if (env.DB) {
    try {
      const ip = request.headers.get('cf-connecting-ip') || '';
      const ipHash = ip ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mly:' + ip)))].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('') : null;
      if (ipHash) {
        const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM bookings WHERE ip_hash = ? AND created_at > datetime('now', '-10 minutes')").bind(ipHash).first();
        if (recent && recent.n >= 6) return json({ ok: false, error: 'too many requests' }, 429);
      }
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || '')) ? d.date : null;
      const data = {
        name, email, phone,
        tour: clean(d.tour, 200), tourSlug: clean(d.tourSlug, 80).replace(/[^a-z0-9-]/g, ''),
        time: clean(d.time, 20), adults: Math.max(0, Math.min(99, parseInt(d.adults, 10) || 0)), children: Math.max(0, Math.min(99, parseInt(d.children, 10) || 0)),
        ages: clean(d.ages, 60), tickets: Array.isArray(d.tickets) ? d.tickets.map((t) => clean(t, 80)).slice(0, 10) : [],
        message: clean(d.message, 3000)
      };
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      await env.DB.prepare("INSERT INTO bookings (id, status, source, date, data, ip_hash, created_at, updated_at) VALUES (?, 'new', ?, ?, ?, ?, datetime('now'), datetime('now'))").bind(id, 'site-' + channel, date, JSON.stringify(data), ipHash).run();
      saved = true;
      // a notification on Mirna's phone (does not slow down the answer to the visitor)
      const n = notifyNew(env, data, date).catch((e) => console.error('notify', e));
      if (ctx && ctx.waitUntil) ctx.waitUntil(n);
    } catch (e) { console.error('enquiry save', e); }
  }
  if (channel === 'whatsapp') return json({ ok: true, saved });
  if (!env.RESEND_API_KEY) return json({ ok: false, saved, error: 'mail not configured' }, 501);

  const rows = [
    ['Tour', clean(d.tour, 200)],
    ['Preferred date', clean(d.date, 20) || 'flexible'],
    ['Time of day', clean(d.time, 20) || 'flexible'],
    ['Adults', clean(d.adults, 3)],
    ['Children', clean(d.children, 3) + (d.ages ? ' (ages ' + clean(d.ages, 60) + ')' : '')],
    ['Tickets', (Array.isArray(d.tickets) ? d.tickets.map((t) => clean(t, 80)).join(', ') : '') || 'none'],
    ['Name', name],
    ['Email', email || '-'],
    ['WhatsApp / phone', phone || '-'],
    ['Message', clean(d.message, 3000) || '-']
  ];
  const html = '<h2>New tour enquiry</h2><table cellpadding="6">' + rows.map(([k, v]) => '<tr><td><b>' + k + '</b></td><td>' + esc(v) + '</td></tr>').join('') + '</table><p>Not confirmed yet: reply to confirm availability, price and arrangements.</p>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Mostarly Guide <enquiries@mostarlyguide.com>',
      to: [env.MAIL_TO || 'mostarlyguide@gmail.com'],
      reply_to: email || undefined,
      subject: 'Tour enquiry: ' + clean(d.tour, 120) + ' · ' + name,
      html
    })
  });
  if (!r.ok) return json({ ok: false, error: 'mail failed' }, 502);
  return json({ ok: true, saved });
}
