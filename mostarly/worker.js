// Cloudflare Worker for Mostarly Guide.
//  - pages: served from D1 once Mirna has saved something in the admin (always up to date), otherwise
//    the files built into dist/ (static assets)
//  - /admin and /api/admin: Mirna's admin, behind Cloudflare Access (see server/auth.js)
//  - /media/*: photos uploaded in the admin (R2)
//  - POST /api/enquiry: the enquiry form (email through Resend)
import { onRequestPost as enquiry } from './functions/api/enquiry.js';
import { adminEmail } from './server/auth.js';
import { adminApi, serveMedia } from './server/api.js';

const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'permissions-policy': 'camera=(), microphone=(), geolocation=()' };

function denied() {
  return new Response(`<!doctype html><html lang="bs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Prijava · Mostarly admin</title>
<body style="font-family:system-ui,sans-serif;background:#272838;color:#f6f0e6;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem;text-align:center"><div><h1 style="font-weight:400">Mostarly admin</h1><p>Za ulaz je potrebna prijava sa odobrenim emailom.</p><p style="opacity:.7;font-size:.9rem">Ako se prijava ne pojavi, Cloudflare Access još nije podešen za /admin.</p><p><a href="/" style="color:#48e5c2">Nazad na sajt</a></p></div></body></html>`, { status: 403, headers: Object.assign({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, SEC) });
}

// a page from D1, or null when the admin has never published
async function page(env, path) {
  if (!env.DB) return null;
  let row;
  try { row = await env.DB.prepare('SELECT body, type FROM pages WHERE url = ?').bind(path).first(); } catch { return null; }
  if (row) return new Response(row.body, { headers: Object.assign({ 'content-type': row.type, 'cache-control': 'public, max-age=0, must-revalidate' }, SEC) });
  const nf = await env.DB.prepare("SELECT body FROM pages WHERE url = '/404'").first();
  if (nf && path !== '/sitemap.xml' && path !== '/robots.txt') return new Response(nf.body, { status: 404, headers: Object.assign({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, SEC) });
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (path === '/api/enquiry') {
        if (method === 'POST') return enquiry({ request, env });
        return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
      }
      if (path.startsWith('/media/')) return (method === 'GET' || method === 'HEAD') ? serveMedia(request, env) : new Response('Method not allowed', { status: 405 });
      if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin')) {
        const email = await adminEmail(request, env);
        if (!email) return path.startsWith('/api/') ? new Response(JSON.stringify({ error: 'Niste prijavljeni.' }), { status: 401, headers: { 'content-type': 'application/json' } }) : denied();
        if (path.startsWith('/api/admin')) return adminApi(request, env, email);
        if (path === '/admin') return Response.redirect(url.origin + '/admin/', 308);
        return env.ASSETS.fetch(request);
      }
      if ((method === 'GET' || method === 'HEAD') && !path.startsWith('/api/')) {
        const last = path.split('/').pop();
        const isPage = path.endsWith('/') || !last.includes('.') || path === '/sitemap.xml' || path === '/robots.txt';
        if (isPage) {
          if (!path.endsWith('/') && !last.includes('.')) return Response.redirect(url.origin + path + '/' + url.search, 308);
          const r = await page(env, path);
          if (r) return method === 'HEAD' ? new Response(null, { status: r.status, headers: r.headers }) : r;
        }
      }
      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error(e);
      return new Response('Something went wrong', { status: 500 });
    }
  }
};
