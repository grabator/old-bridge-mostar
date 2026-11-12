// Cloudflare Pages Function: POST /api/enquiry
// Sends the enquiry to the owner's inbox through Resend (https://resend.com).
// Environment variables (Pages > Settings > Variables): RESEND_API_KEY, MAIL_TO, MAIL_FROM
// Without RESEND_API_KEY it answers 501 and the site opens the visitor's email app instead.
const clean = (v, n = 500) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function onRequestPost({ request, env }) {
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: 'bad request' }, 400); }
  if (d.website) return json({ ok: true }); // honeypot: bots get a fake success
  const name = clean(d.name, 120);
  const email = clean(d.email, 160);
  const phone = clean(d.phone, 60);
  if (!name || (!email && !phone)) return json({ ok: false, error: 'missing contact' }, 422);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: 'bad email' }, 422);
  if (!env.RESEND_API_KEY) return json({ ok: false, error: 'mail not configured' }, 501);

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
  return json({ ok: true });
}
