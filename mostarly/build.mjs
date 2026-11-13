// Mostarly Guide: static site build. No dependencies: node build.mjs -> dist/
// Content lives in content/ (site.json, places.json and one JSON file per tour). The pages are made by
// src/render.mjs, which the Worker also runs when Mirna saves something in the admin (/admin).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { render } from './src/render.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const S = read('content/site.json');
const TOURS = fs.readdirSync(path.join(ROOT, 'content/tours')).filter((f) => f.endsWith('.json'))
  .map((f) => read('content/tours/' + f)).sort((a, b) => (a.order || 99) - (b.order || 99));
const PL = read('content/places.json');
const PHOTOS = (() => { try { return read('src/img/places/credits.json'); } catch { return {}; } })();
const DRAFT = process.env.MOSTARLY_DRAFT ? process.env.MOSTARLY_DRAFT === '1' : !!S.draft;
const BASE = (process.env.SITE_URL || S.url).replace(/\/$/, '');
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const CSS = fs.readFileSync(path.join(ROOT, 'src/site.css'), 'utf8');
const JS = fs.readFileSync(path.join(ROOT, 'src/site.js'), 'utf8');
const MAPJS = fs.readFileSync(path.join(ROOT, 'src/maps.js'), 'utf8');
const V = { css: hash(CSS), js: hash(JS), maps: hash(MAPJS) };

const { pages, sitemap, robots, problems } = render({ S, TOURS, PL, PHOTOS, V, DRAFT, BASE });

/* ---------- write ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const [url, html] of pages) {
  const file = url === '/404' ? path.join(DIST, '404.html') : path.join(DIST, url, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
fs.writeFileSync(path.join(DIST, 'site.css'), CSS);
fs.writeFileSync(path.join(DIST, 'site.js'), JS);
fs.cpSync(path.join(ROOT, 'src/img'), path.join(DIST, 'img'), { recursive: true });
fs.cpSync(path.join(ROOT, 'src/geo'), path.join(DIST, 'geo'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'maps.js'), MAPJS);
fs.cpSync(path.join(ROOT, 'src/admin'), path.join(DIST, 'admin'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(DIST, 'robots.txt'), robots);
fs.writeFileSync(path.join(DIST, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/img/*\n  Cache-Control: public, max-age=2592000\n/site.*\n  Cache-Control: public, max-age=31536000, immutable\n/admin/*\n  Cache-Control: no-store\n  X-Robots-Tag: noindex\n`);

/* ---------- content for the Worker: the starting tours and reviews, and the asset versions ---------- */
fs.mkdirSync(path.join(ROOT, '.gen'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.gen/content.json'), JSON.stringify({ S, TOURS, PL, PHOTOS, V, DRAFT, BASE }));

console.log(`Mostarly: ${pages.length} pages${DRAFT ? ' (draft)' : ''} -> dist/`);
if (problems.length) { console.log(problems.join('\n')); process.exitCode = 1; }
