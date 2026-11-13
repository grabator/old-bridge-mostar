// Admin sign-in is done by Cloudflare Access (a code sent to Mirna's email). Access puts a signed token
// on every request to /admin and /api/admin; we check that token here, so the API is safe even if Access
// were switched off by mistake. Variables: ACCESS_TEAM (e.g. mostarly.cloudflareaccess.com), ACCESS_AUD
// (the application's "AUD tag") and ADMIN_EMAILS (comma separated). For local development only:
// ADMIN_DEV=1 in .dev.vars lets localhost in without Access.

let certs = null, certsAt = 0;

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const json = (s) => JSON.parse(new TextDecoder().decode(b64url(s)));

async function keys(team) {
  if (certs && Date.now() - certsAt < 3600e3) return certs;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error('certs ' + r.status);
  certs = (await r.json()).keys || []; certsAt = Date.now();
  return certs;
}

function tokenOf(request) {
  const h = request.headers.get('cf-access-jwt-assertion');
  if (h) return h;
  const m = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(request.headers.get('cookie') || '');
  return m ? m[1] : '';
}

async function verify(token, env) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const head = json(h), body = json(p);
  if (head.alg !== 'RS256') return null;
  const jwk = (await keys(env.ACCESS_TEAM)).find((k) => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(h + '.' + p));
  if (!ok) return null;
  const now = Date.now() / 1000;
  const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (body.exp < now || (body.nbf && body.nbf > now + 60)) return null;
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (body.iss && body.iss !== `https://${env.ACCESS_TEAM}`) return null;
  return body;
}

// returns the signed-in email, or null
export async function adminEmail(request, env) {
  const url = new URL(request.url);
  if (env.ADMIN_DEV === '1' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return 'dev@localhost';
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) return null;
  const t = tokenOf(request);
  if (!t) return null;
  let body;
  try { body = await verify(t, env); } catch { return null; }
  if (!body || !body.email) return null;
  const allowed = String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(String(body.email).toLowerCase())) return null;
  return body.email;
}
