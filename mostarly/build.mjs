// Mostarly Guide: static site build. No dependencies: node build.mjs -> dist/
// Content lives in content/ (site.json + one JSON file per tour) and is editable in /admin.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const S = read('content/site.json');
const TOURS = fs.readdirSync(path.join(ROOT, 'content/tours')).filter((f) => f.endsWith('.json'))
  .map((f) => read('content/tours/' + f)).sort((a, b) => (a.order || 99) - (b.order || 99));
const DRAFT = process.env.MOSTARLY_DRAFT ? process.env.MOSTARLY_DRAFT === '1' : !!S.draft;
const BASE = (process.env.SITE_URL || S.url).replace(/\/$/, '');
const YEAR = new Date().getFullYear();

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const CSS = fs.readFileSync(path.join(ROOT, 'src/site.css'), 'utf8');
const JS = fs.readFileSync(path.join(ROOT, 'src/site.js'), 'utf8');
const MAPJS = fs.readFileSync(path.join(ROOT, 'src/maps.js'), 'utf8');
const V = { css: hash(CSS), js: hash(JS), maps: hash(MAPJS) };
// places for the maps; photos from Wikimedia Commons (src/img/places/credits.json) are added when present
const PL = read('content/places.json');
const PHOTOS = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'src/img/places/credits.json'), 'utf8')); } catch { return {}; } })();
const PLACES = PL.places.map((p) => Object.assign({}, p, !p.image && PHOTOS[p.id] ? { photo: p.id + '.jpg', credit: `${PHOTOS[p.id].artist || 'Wikimedia Commons'}, ${PHOTOS[p.id].license} (Wikimedia Commons)` } : {}));
const placeBy = (id) => PLACES.find((p) => p.id === id);
const wa = (text) => `https://wa.me/${S.contact.whatsapp}?text=${encodeURIComponent(text)}`;
const tel = 'tel:' + S.contact.phone.replace(/\s/g, '');
// Runs in <head> before the page paints: the visitor's saved choice, otherwise day or night in Mostar right now.
const THEME_BOOT = `(function(){var S=[[7.2,16.5],[6.75,17.25],[6.1,17.9],[6.3,19.5],[5.6,20.1],[5.25,20.5],[5.4,20.4],[5.9,19.85],[6.5,19],[7.1,18.15],[6.75,16.5],[7.15,16.25]],c='',n=false,k='';try{c=localStorage.getItem('mly-theme')||''}catch(e){}try{var p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Sarajevo',hour:'2-digit',minute:'2-digit',month:'numeric',hourCycle:'h23'}).formatToParts(new Date()),g=function(t){return +p.filter(function(x){return x.type===t})[0].value},h=g('hour')+g('minute')/60,s=S[g('month')-1];n=h<s[0]||h>=s[1];k=('0'+g('hour')).slice(-2)+':'+('0'+g('minute')).slice(-2)}catch(e){}if(c)n=c==='night';if(n)document.documentElement.classList.add('is-night');window.__mly={choice:c,clock:k}})();`;
const catName = (id) => (S.categories.find((c) => c.id === id) || {}).name || '';

/* ---------- icons & marks ---------- */
const I = {
  clock: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  pin: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 15s5-4.6 5-8.5A5 5 0 0 0 3 6.5C3 10.4 8 15 8 15z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="6.5" r="1.8" fill="currentColor"/></svg>',
  group: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6" cy="5.5" r="2.5" fill="currentColor"/><circle cx="11.5" cy="6.5" r="2" fill="currentColor"/><path d="M1.5 14c0-2.8 2-4.5 4.5-4.5s4.5 1.7 4.5 4.5M10 9.6c2.6-.4 4.5 1.3 4.5 4.4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  walk: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="9" cy="2.6" r="1.6" fill="currentColor"/><path d="M8.2 5.2 6.5 9l2.4 1.6.6 4M6.5 9l-1.8 5.2M8.2 5.2l2.4 2.3 2 .3M8.2 5.2 5.6 6.4 4.8 8.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lang: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 8h13M8 1.5c2 2 2 11 0 13M8 1.5c-2 2-2 11 0 13" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  cal: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor" stroke-width="1.4"/></svg>',
  yes: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" opacity=".14"/><path d="M4.8 8.2 7 10.3l4.2-4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  no: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" opacity=".12"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  arrow: '<svg viewBox="0 0 16 16" class="ic" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wa: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.2z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" fill="currentColor"/></svg>',
  mail: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  ig: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="27" fill="#48e5c2" opacity=".2"/><path d="M17 29l7 7 15-16" fill="none" stroke="#0a8a71" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor"/></svg>'
};
const HLOGO = '<img class="lg-dark" src="/img/logo-dark.png" alt="Mostarly Guide" width="167" height="34"><img class="lg-light" src="/img/logo-light.png" alt="Mostarly Guide" width="167" height="34">';
const mini = '<svg data-mini aria-hidden="true"></svg>';
const stars = '<span class="stars" aria-label="5 out of 5"><i>★</i><i>★</i><i>★</i><i>★</i><i>★</i></span>';
const tbc = (txt = 'to confirm') => (DRAFT ? `<span class="tbc">${esc(txt)}</span>` : '');
const notes = (arr) => (DRAFT && arr && arr.length ? `<div class="note" role="note"><b>For Mirna:</b><ul>${arr.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : '');

/* ---------- kilim art for tours without photos yet ---------- */
const KIL = { red: '#c8271c', cream: '#f3e7cf', black: '#1b1411', gold: '#efaa2f', green: '#2f5b2c', white: '#fffaf0', maroon: '#7c1d1b' };
const STAR = ['...A...', '..WAW..', '.WAYAW.', 'AAYGYAA', '.WAYAW.', '..WAW..', '...A...'];
function rects(grid, map, ox = 0, oy = 0) {
  let s = '';
  grid.forEach((row, y) => { let x = 0; while (x < row.length) { const ch = row[x]; if (ch === '.' || !map[ch]) { x++; continue; } let e = x; while (e < row.length && row[e] === ch) e++; s += `<rect x="${x + ox}" y="${y + oy}" width="${e - x}" height="1" fill="${map[ch]}"/>`; x = e; } });
  return s;
}
// field colours per category, like the red, deep red, green and black fields of Bosnian kilims
const FIELD = { city: KIL.red, food: KIL.maroon, daytrip: '#24452a', experience: KIL.black };
let ARTN = 0;
function art(t, label = true) {
  const id = 'k' + (++ARTN), bg = FIELD[t.category] || KIL.red, o = t.order || 0;
  const starMap = { A: t.category === 'experience' ? KIL.red : KIL.black, W: KIL.white, Y: KIL.gold, G: KIL.green };
  const cx = 50 + ((o * 13) % 21) - 10, cy = 37;
  const dia = (r) => `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`;
  return `<svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t.name)}"><defs>
<pattern id="${id}s" width="10" height="10" patternUnits="userSpaceOnUse" x="${o % 10}" y="${(o * 3) % 10}"><rect width="10" height="10" fill="${bg}"/><g shape-rendering="crispEdges">${rects(STAR, starMap, 1, 1)}${rects(STAR, starMap, 6, 6)}</g></pattern>
<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="${bg}" stop-opacity="0"/><stop offset="1" stop-color="${bg}" stop-opacity=".85"/></linearGradient></defs>
<rect width="100" height="75" fill="url(#${id}s)"/>
<path d="${dia(26)} ${dia(16)} M${cx} ${cy - 26}V${cy + 26}" fill="none" stroke="${t.category === 'experience' ? KIL.gold : KIL.black}" stroke-width="1.1" opacity=".9"/>
<g transform="translate(${cx - 5.25} ${cy - 5.25}) scale(1.5)" shape-rendering="crispEdges">${rects(STAR, { A: KIL.black, W: KIL.cream, Y: KIL.gold, G: KIL.green })}</g>
<rect y="0" width="100" height="3" fill="${KIL.cream}"/><rect y="3" width="100" height="1" fill="${KIL.black}"/>
<rect width="100" height="75" fill="url(#${id}g)"/></svg>${label && DRAFT ? '<span class="ph">Photo coming</span>' : ''}`;
}
const tourImg = (t, cls = '', eager = false) => (t.image
  ? `<img src="/img/${esc(t.image)}" alt="${esc(t.imageAlt || t.name)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${cls}>`
  : art(t));


/* ---------- Stari Most drawn with one line, in the style of the logo ---------- */
function cubicAt(p0, p1, p2, p3, t) { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; }
function bridge(cls = '') {
  const lines = [
    ['M0 150 C 20 140, 30 128, 34 118 H112 V158', 0],
    ['M58 118 V40 L76 26 L94 40 V118 M58 40 H94 M70 62 H82 M70 86 H82', .15],
    ['M104 106 C 150 52, 210 52, 256 106', .35],
    ['M104 99 C 150 45, 210 45, 256 99', .45],
    ['M116 156 C 132 78, 228 78, 244 156', .55],
    ['M248 118 H330 C 340 128, 350 140, 360 150 M248 118 V158', .3],
    ['M272 118 V52 C 272 38, 306 38, 306 52 V118 M272 52 H306 M283 72 H295 M283 94 H295', .2],
    ['M0 160 C 40 154, 80 166, 120 160 S 200 154, 240 160 S 320 166, 360 160', .7, 'water'],
    ['M150 168 h18 M186 168 h26 M224 168 h12', .9, 'water']
  ];
  const lamps = [.12, .3, .5, .7, .88].map((t, i) => `<g class="lamp" style="--i:${i}"><circle cx="${cubicAt(104, 150, 210, 256, t).toFixed(1)}" cy="${(cubicAt(99, 45, 45, 99, t) - 7).toFixed(1)}" r="7" class="glow"/><circle cx="${cubicAt(104, 150, 210, 256, t).toFixed(1)}" cy="${(cubicAt(99, 45, 45, 99, t) - 7).toFixed(1)}" r="2.4"/><path d="M${cubicAt(104, 150, 210, 256, t).toFixed(1)} ${(cubicAt(99, 45, 45, 99, t) - 4.6).toFixed(1)}v4.5"/></g>`).join('');
  return `<svg class="bridge ${cls}" viewBox="0 -4 360 178" role="img" aria-label="Stari Most, drawn in one line"><g fill="none" stroke-linecap="round" stroke-linejoin="round">${lines.map(([d, delay, k]) => `<path class="ln${k ? ' ' + k : ''}" pathLength="1" style="--d:${delay}s" d="${d}"/>`).join('')}</g>${lamps}</svg>`;
}

/* ---------- price ---------- */
function priceInfo(p) {
  const show = p.basis !== 'request' && (p.confirmed || DRAFT);
  if (!show) return { html: '<span class="req">Price on request</span><small>Final quote after your enquiry</small>', text: 'Price on request' };
  const basis = p.basis === 'person' ? 'per person' : 'per group';
  return { html: `<b>${p.from ? '<span style="font-size:.6em">from </span>' : ''}€${p.amount}</b><small>${basis}${p.confirmed ? '' : tbc()}</small>`, text: `${p.from ? 'from ' : ''}€${p.amount} ${basis}` };
}

/* ---------- layout ---------- */
const NAV = [['/tours/', 'Tours'], ['/about/', 'About'], ['/mostar-herzegovina/', 'Mostar & Herzegovina'], ['/travel-professionals/', 'For agencies'], ['/faq/', 'FAQ'], ['/contact/', 'Contact']];
function head({ title, desc, url, image = '/img/hero-d.jpg', ld = [], noindex = false }) {
  const full = BASE + url;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${full}">
${noindex || DRAFT ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website"><meta property="og:site_name" content="Mostarly Guide"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${full}"><meta property="og:image" content="${BASE + image}"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#272838"><meta name="color-scheme" content="light dark"><link rel="icon" href="/img/favicon.png" type="image/png"><link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<script>${THEME_BOOT}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..500&family=Inter:wght@400..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site.css?v=${V.css}">
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>`;
}
function nav(current, overHero) {
  return `<header class="nav${overHero ? '' : ' solid'}">
  <a class="home" href="/" aria-label="Mostarly Guide home">${HLOGO}</a>
  <nav class="links" aria-label="Main">${NAV.map(([h, l]) => `<a href="${h}"${current === h ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
  <div class="nav-tools"><div class="tswitch" role="group" aria-label="Day or night theme"><button type="button" data-t="day" aria-label="Day theme" aria-pressed="true">${I.sun}</button><button type="button" data-t="night" aria-label="Night theme" aria-pressed="false">${I.moon}</button></div>
  <a class="btn sm ${overHero ? 'mint' : ''} enq" href="/contact/">Enquire</a>
  <button class="menu-btn" type="button" data-menu aria-expanded="false" aria-controls="sheet" aria-label="Open menu">${I.menu}</button></div>
</header>
<div class="sheet" id="sheet" aria-label="Menu"><div class="sheet-top"><a class="home" href="/" aria-label="Mostarly Guide home"><img src="/img/logo-light.png" alt="Mostarly Guide" width="167" height="34" style="height:34px;width:auto"></a><button class="menu-btn" type="button" data-menu aria-label="Close menu">${I.close}</button></div>
<nav aria-label="Mobile">${[['/', 'Home']].concat(NAV).map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}</nav>
<div class="sheet-foot"><a class="btn wa block" href="${wa('Hello Mirna, I would like to ask about a tour in Mostar.')}">${I.wa} WhatsApp Mirna</a><a href="${tel}">${esc(S.contact.phone)}</a><a href="mailto:${S.contact.email}">${S.contact.email}</a></div></div>`;
}
function foot() {
  return `<section class="bridge-sign" aria-label="Stari Most">${bridge('signature')}<p>Stari Most · 1566</p></section><footer class="foot"><div class="band" data-band="1" style="--bh:44px" aria-hidden="true"></div><div class="fringe down" aria-hidden="true"></div><div class="wrap">
<div><img class="flogo" src="/img/logo-light.png" alt="Mostarly Guide" width="196" height="40" loading="lazy"><p>Licensed local guide in Mostar,<br>Bosnia and Herzegovina.</p></div>
<div><h4>Tours</h4><ul>${S.categories.map((c) => `<li><a href="/tours/#${c.id}">${esc(c.name)}</a></li>`).join('')}</ul></div>
<div><h4>Plan</h4><ul><li><a href="/mostar-herzegovina/">Mostar &amp; Herzegovina</a></li><li><a href="/faq/">Practical information</a></li><li><a href="/travel-professionals/">For travel professionals</a></li><li><a href="/about/">About Mirna</a></li></ul></div>
<div><h4>Contact</h4><ul><li><a href="${tel}">${esc(S.contact.phone)}</a></li><li><a href="${wa('Hello Mirna, I would like to ask about a tour in Mostar.')}">WhatsApp</a></li><li><a href="mailto:${S.contact.email}">${S.contact.email}</a></li><li><a href="https://instagram.com/${S.contact.instagram}">Instagram @${S.contact.instagram}</a></li></ul></div>
<div class="legal"><span>© ${YEAR} Mostarly Guide, Mostar</span><span><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/cancellation-policy/">Cancellation policy</a></span></div>
</div></footer>`;
}
function sticky(label, sub, href, waText) {
  return `<div class="sticky off" id="sticky"><div><b>${esc(label)}</b>${esc(sub)}</div><a class="wa-mini" href="${wa(waText)}" aria-label="Ask on WhatsApp">${I.wa}</a><a class="btn mint" href="${href}">Enquire</a></div>`;
}
function dataScript() {
  return `<script type="application/json" id="mly-data">${JSON.stringify({ tours: TOURS.map((t) => ({ slug: t.slug, name: t.name, tickets: t.tickets || [] })), tickets: S.tickets, places: PLACES.map(({ notes, ...p }) => p), whatsapp: S.contact.whatsapp, email: S.contact.email, ga4: S.analytics.ga4 || '' }).replace(/</g, '\\u003c')}</script>`;
}
function page({ current = '', hero = false, body, tour = '', stickyArgs, extraTop = '', maps = false }) {
  return `<body${tour ? ` data-tour="${esc(tour)}"` : ''}><a class="skip" href="#main">Skip to content</a>
${DRAFT ? '<div class="draftbar" title="Yellow notes and ‘to confirm’ labels are only visible in the draft">Draft</div>' : ''}
${extraTop}${nav(current, hero)}
<main id="main">${body}</main>
${foot()}
${stickyArgs ? sticky(...stickyArgs) : ''}
<div class="rail" id="rail" aria-hidden="true"><svg></svg></div>
${dataScript()}<script src="/site.js?v=${V.js}" defer></script>${maps ? `<script src="/maps.js?v=${V.maps}" defer></script>` : ''}</body></html>`;
}

/* ---------- reusable blocks ---------- */
function card(t) {
  const p = priceInfo(t.price);
  return `<a class="card rv" href="/tours/${t.slug}/"><div class="cimg shine">${tourImg(t)}<span class="ccat">${esc(catName(t.category))}</span></div>
<div class="cbody"><svg class="arab" data-arab viewBox="0 0 80 80" aria-hidden="true"></svg><h3>${esc(t.name)}</h3><p>${esc(t.tagline)}</p>
<ul class="chips"><li>${I.clock}${esc(t.duration)}</li><li>${I.pin}${esc(t.location.split(',')[0])}</li></ul>
<div class="crow"><div class="price">${p.html}</div><span class="go">View tour ${I.arrow}</span></div></div></a>`;
}
function enquiryForm(selected = '') {
  const opts = S.categories.map((c) => `<optgroup label="${esc(c.name)}">${TOURS.filter((t) => t.category === c.id).map((t) => `<option value="${t.slug}"${t.slug === selected ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join('');
  return `<div class="enq-wrap" data-enq>
<form class="form" novalidate>
  <label>Tour<select name="tour"><option value="">Not sure yet / custom request</option>${opts}</select></label>
  <label>Preferred date<input type="date" name="date"></label>
  <div class="two">
    <label>Adults<span class="step"><button type="button" data-s="adults" data-d="-1" aria-label="Fewer adults">−</button><b data-v="adults">2</b><button type="button" data-s="adults" data-d="1" aria-label="More adults">+</button></span><input type="hidden" name="adults" value="2"></label>
    <label>Children<span class="step"><button type="button" data-s="children" data-d="-1" aria-label="Fewer children">−</button><b data-v="children">0</b><button type="button" data-s="children" data-d="1" aria-label="More children">+</button></span><input type="hidden" name="children" value="0"></label>
  </div>
  <label class="ages" hidden>Children’s ages<input name="ages" placeholder="e.g. 6 and 9"></label>
  <fieldset class="ticks" hidden><legend>Add entrance tickets?</legend><div class="tk-list"></div><small>${esc(S.ticketsNote)}</small></fieldset>
  <label>Your name<input name="name" autocomplete="name" required></label>
  <div class="two"><label>Email<input type="email" name="email" autocomplete="email" inputmode="email"></label><label>WhatsApp / phone<input type="tel" name="phone" autocomplete="tel" inputmode="tel"></label></div>
  <label>Message <span class="opt">(optional)</span><textarea name="message" placeholder="Anything we should know: interests, mobility, where you are staying"></textarea></label>
  <div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
  <p class="formerr" role="alert"></p>
  <div class="actions"><button type="button" class="btn wa block" data-send="wa">${I.wa} Send on WhatsApp</button><button type="submit" class="btn block">Send enquiry by email</button></div>
  <p class="tiny">This is an enquiry, not a confirmed booking. Mirna confirms availability, the final price and arrangements personally. No payment needed now.</p>
</form>
<div class="done" role="status" aria-live="polite">${I.check}<h3>Thank you</h3><p class="done-how"></p><p style="margin-top:.6rem"><b>Your tour is not confirmed yet.</b> Mirna will reply personally to confirm availability, the final price and arrangements.</p><p style="margin-top:1rem"><button type="button" class="btn sm line" data-again>Send another enquiry</button></p></div>
</div>`;
}
const coffeeSVG = `<svg viewBox="0 0 320 260" aria-hidden="true"><defs><linearGradient id="cu2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f4a26"/><stop offset=".45" stop-color="#eab087"/><stop offset=".62" stop-color="#c47647"/><stop offset="1" stop-color="#7d3f1f"/></linearGradient><clipPath id="cupIn"><path d="M196 168 h52 l-6 40 q-20 8-40 0z"/></clipPath></defs>
<ellipse cx="190" cy="226" rx="128" ry="22" fill="url(#cu2)"/><ellipse cx="190" cy="222" rx="118" ry="17" fill="none" stroke="#fbe1c8" stroke-width="1" opacity=".55"/>
<g class="steam" fill="none" stroke="#b9ab97" stroke-width="2.2" stroke-linecap="round"><path d="M212 150 c-6-10 6-16 0-28"/><path d="M224 152 c-6-10 6-16 0-28"/><path d="M236 150 c-6-10 6-16 0-28"/></g>
<path d="M190 166 h64 l-8 46 q-24 10-48 0z" fill="#fffaf2" stroke="#272838" stroke-width="2.5" stroke-linejoin="round"/>
<g clip-path="url(#cupIn)"><rect class="lvl" x="190" y="186" width="66" height="40" fill="#5a3420"/><rect class="lvl" x="190" y="186" width="66" height="3" fill="#a8744f"/></g>
<path d="M194 178 h56" stroke="#48e5c2" stroke-width="2.5"/><path d="M196 190 l4 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4" fill="none" stroke="#a85f36" stroke-width="1.6"/>
<path class="stream" d="M178 112 C 186 122, 210 140, 220 176" fill="none" stroke="#5a3420" stroke-width="4" stroke-linecap="round"/>
<g class="dz"><path d="M96 92 h70 l6 8 -14 6 6 60 q-38 14-70 0 l8-60 -12-6z" fill="url(#cu2)" stroke="#6e3517" stroke-width="2" stroke-linejoin="round"/><path d="M100 124 q32 10 62 0 M98 140 q34 10 66 0" fill="none" stroke="#fbe1c8" stroke-width="1.2" opacity=".7"/><path d="M108 150 c6-8 14-8 20 0 c6 8 14 8 20 0" fill="none" stroke="#6e3517" stroke-width="1.4"/><path d="M96 100 L 22 128" stroke="#c9a24b" stroke-width="7" stroke-linecap="round"/><path d="M60 114 l4 10 M46 119 l4 10 M74 108 l4 10" stroke="#8a6a24" stroke-width="2"/></g></svg>`;
const rozeta = `<svg class="rozeta" viewBox="0 0 120 120" aria-label="Licensed guide, Mostar"><defs><linearGradient id="cuG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f4a26"/><stop offset=".45" stop-color="#e7aa7c"/><stop offset=".6" stop-color="#c47647"/><stop offset="1" stop-color="#7d3f1f"/></linearGradient><path id="circ" d="M60 60m-43 0a43 43 0 1 1 86 0a43 43 0 1 1-86 0"/><radialGradient id="glG"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<circle cx="60" cy="60" r="58" fill="url(#cuG)"/><circle cx="60" cy="60" r="52" fill="none" stroke="#fbe1c8" stroke-width=".8" opacity=".8"/>
<g class="spin"><text font-family="Inter" font-size="8.2" font-weight="700" letter-spacing="2.2" fill="#fff4e8"><textPath href="#circ">LICENSED GUIDE · MOSTAR · BORN HERE ·</textPath></text></g>
<circle cx="60" cy="60" r="31" fill="#272838"/><g fill="none" stroke="url(#cuG)" stroke-width="1.6" data-petals></g><circle cx="60" cy="60" r="4" fill="#fcec52"/><circle class="gl" id="glint" cx="40" cy="36" r="34" fill="url(#glG)"/></svg>`;
const arch = `<div class="arch rv"><div class="arch-in"><div><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="currentColor"/></svg>Mirna’s portrait</div></div>${rozeta}</div>`;
function reviewsBlock() {
  const items = S.reviews.items || [];
  const cards = items.length ? items.map((r) => `<figure class="rev rv">${'<span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span>'}${stars}<blockquote>“${esc(r.text)}”</blockquote><figcaption><span><b>${esc(r.name)}</b> · ${esc(r.country || '')}${r.date ? ' · ' + esc(r.date) : ''}</span><span class="ta"><i></i>${esc(r.source || 'Tripadvisor')}</span></figcaption></figure>`).join('')
    : [1, 2, 3].map((i) => `<figure class="rev ph rv d${i - 1}"><span class="corner c1"></span><span class="corner c2"></span><span class="corner c3"></span><span class="corner c4"></span>${stars}<blockquote>${DRAFT ? 'A verified guest review goes here: the guest’s own words, unedited, from Tripadvisor or Google.' : ''}</blockquote><figcaption><span><b>Guest name</b> · Country · Month year</span><span class="ta"><i></i>Tripadvisor</span></figcaption></figure>`).join('');
  return `<div class="rows">${cards}</div>${notes([S.reviews.note])}
<p style="margin-top:1.2rem"><a class="link" href="${S.contact.tripadvisor}" rel="noopener">Read the reviews on Tripadvisor →</a></p>`;
}
const crumbs = (arr) => `<nav class="crumbs" aria-label="Breadcrumb">${arr.map(([h, l], i) => (i < arr.length - 1 ? `<a href="${h}">${esc(l)}</a><span aria-hidden="true">/</span>` : `<span aria-current="page">${esc(l)}</span>`)).join('')}</nav>`;
const crumbLd = (arr) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: arr.map(([h, l], i) => ({ '@type': 'ListItem', position: i + 1, name: l, item: BASE + h })) });
const orgLd = { '@context': 'https://schema.org', '@type': 'LocalBusiness', '@id': BASE + '/#business', name: 'Mostarly Guide', description: S.description, url: BASE + '/', telephone: S.contact.phone, email: S.contact.email, logo: BASE + '/img/mark-dark.png', image: BASE + '/img/hero-d.jpg', address: { '@type': 'PostalAddress', addressLocality: 'Mostar', addressCountry: 'BA' }, areaServed: ['Mostar', 'Herzegovina'], sameAs: ['https://instagram.com/' + S.contact.instagram, S.contact.tripadvisor] };
function phead(c, h1, lead, extra = '') {
  return `<header class="phead"><div class="wrap">${crumbs(c)}<p class="eyebrow">${mini}${esc(c[c.length - 1][1])}</p><h1>${h1}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}${extra}</div></header><div class="band weave" data-band="0" style="--bh:22px" aria-hidden="true"></div>`;
}

function routeBlock(t) {
  const r = t.route, stops = r.stops.map(placeBy).filter(Boolean);
  // straight-line distance x 1.3 for winding roads, rounded to 5 km: an honest "about" for the legs
  const hav = (a, b) => { const R = 6371, r1 = (a.lat * Math.PI) / 180, r2 = (b.lat * Math.PI) / 180, dl = ((b.lon - a.lon) * Math.PI) / 180, dp = r2 - r1; return 2 * R * Math.asin(Math.sqrt(Math.sin(dp / 2) ** 2 + Math.cos(r1) * Math.cos(r2) * Math.sin(dl / 2) ** 2)); };
  const leg = (a, b) => (r.mode === 'drive' ? `≈ ${Math.max(5, Math.round((hav(a, b) * 1.3) / 5) * 5)} km by car` : r.mode === 'walk' ? 'a short walk' : '');
  const img = (p) => p.image ? `<img src="/img/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : p.photo ? `<img src="/img/places/${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : '<span class="pc-art" aria-hidden="true"></span>';
  return `<section class="tsec route-sec" data-route='${esc(JSON.stringify(r))}'><h2>The route</h2>
<p class="muted rt-mode">${r.mode === 'walk' ? 'On foot along the old kaldrma' : 'By car from Mostar'} · ${stops.length} stops · tap a stop</p>
<div class="rt-stage"></div>
<ol class="rt-steps">${stops.map((p, i) => `<li class="rt-step" data-id="${p.id}"><span class="rt-n">${i + 1}</span><div class="rt-img">${img(p)}</div><div class="rt-txt"><b>${esc(p.name)}</b>${p.kind === 'meet' ? '<em>Meeting point</em>' : ''}<p>${esc(p.text)}</p>${p.credit ? `<small class="pc-credit">Photo: ${esc(p.credit)}</small>` : ''}${i < stops.length - 1 ? `<span class="rt-leg">↓ ${leg(p, stops[i + 1])}</span>` : ''}</div></li>`).join('')}</ol>
${notes(r.map === 'oldtown' ? [PL.oldtownNote] : [PL.note].concat(stops.flatMap((p) => p.notes || [])))}</section>`;
}

/* ---------- pages ---------- */
const out = [];
const emit = (url, html) => out.push([url, html]);

// HOME
{
  const featured = TOURS.filter((t) => t.featured).slice(0, 4);
  const body = `
<section class="hero" aria-label="Mostar">
  <picture><source media="(min-width:900px)" srcset="/img/hero-d.jpg"><img src="/img/hero-m.jpg" alt="Stari Most over the emerald Neretva in Mostar" fetchpriority="high"></picture>
  <picture class="night"><source media="(min-width:900px)" srcset="/img/sumrak.jpg"><img src="/img/night-m.jpg" alt="" loading="lazy"></picture>
  <div class="sky" id="sky"></div>
  <div class="hero-in">
    <p class="kick"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M0 2h12L6 11z" fill="#48e5c2"/></svg>Licensed local guide · Mostar</p>
    <h1><span class="ln"><span>Mostar</span></span><span class="ln"><span>through the eyes</span></span><span class="ln"><span><em>of a local.</em></span></span></h1>
    <div class="hero-row"><div>
      <p class="sub">Discover Mostar and Herzegovina with a licensed local guide. Book a private tour through the Old Town, taste Bosnian coffee, learn the stories behind the landmarks or plan a day outside the city.</p>
      <div class="cta"><a class="btn mint" href="/tours/">Explore the tours</a><a class="btn ghost" href="/mostar-herzegovina/">Plan your visit</a></div>
    </div><p class="now" id="now"><i>☀</i><span>In Mostar</span></p></div>
  </div>
  <div class="fringe up" aria-hidden="true"></div><div class="band weave" data-band="1" style="--bh:56px" aria-hidden="true"></div>
</section>

<section class="sec tight"><div class="wrap intro">
  <div><p class="eyebrow rv">${mini}Mostarly Guide</p><div class="medal rv d1"><svg data-medallion aria-hidden="true"></svg></div></div>
  <div><p class="rv d1">Based in Mostar and led by <em>Mirna</em>, a licensed local guide born and raised in Mostar.</p>
  <p class="lead rv d2" style="font-family:var(--sans);font-size:1.05rem;margin-top:1rem">Walks through the Old Town, Bosnian coffee, food, and day trips to Blagaj, Počitelj and Kravice. Every tour is planned personally, at your pace.</p></div>
</div></section>

<section class="sec alt"><div class="wrap">
  <div class="head-row"><div><p class="eyebrow rv">${mini}Featured tours</p><h2 class="rv d1">Start <em>here</em></h2></div><a class="btn line sm rv" href="/tours/">All tours ${I.arrow}</a></div>
  <div class="cards four">${featured.map(card).join('')}</div>
</div></section>

<section class="sec explore" data-explore><div class="wrap">
  <div class="head-row"><div><p class="eyebrow rv">${mini}Where we go</p><h2 class="rv d1">From Mostar <em>to all of Herzegovina</em></h2></div></div>
  <p class="lead rv d2">Mostar is home. From here Mirna takes you to the Old Town, to Blagaj, Počitelj, the Kravice Waterfalls and beyond. Tap a place to see what is there and which tours go.</p>
  <div class="ex-grid">
    <div class="ex-stage rv"><canvas aria-hidden="true"></canvas><button type="button" class="ex-back btn sm" hidden>← Herzegovina</button></div>
    <div class="ex-side"><div class="ex-card" aria-live="polite"></div><div class="ex-chips" role="group" aria-label="Places"></div></div>
  </div>
  ${notes([PL.note, PL.oldtownNote].concat(placeBy('zitomislic').notes || []))}
</div></section>

<section class="sec dark"><div class="wrap">
  <p class="eyebrow rv">${mini}Why book with a local guide</p><h2 class="rv d1">The city, <em>from the inside</em></h2>
  <div class="why">${S.why.map((w, i) => `<div class="rv${i ? ' d' + Math.min(i, 3) : ''}"><svg data-sign="${['eye', 'star', 'water', 'amulet', 'eye'][i]}" aria-hidden="true"></svg><b>${esc(w.t)}</b><span>${esc(w.d)}</span></div>`).join('')}</div>
</div></section>

<section class="sec" id="mirna"><div class="wrap mirna">
  ${arch}
  <div><p class="eyebrow rv">${mini}Your guide</p><h2 class="rv d1">Hi, I’m <em>Mirna.</em></h2>
  <div class="prose">${S.about.paragraphs.slice(0, 2).map((p) => `<p class="rv d2">${esc(p)}</p>`).join('')}</div>
  <svg class="sigsvg" viewBox="0 0 200 66" aria-label="Mirna"><text x="2" y="52">Mirna</text></svg><p class="signame">Mirna Cemalović Kukrića · ${esc(S.about.experience)}${tbc()}</p>
  <p style="margin-top:1.3rem"><a class="btn line sm" href="/about/">More about Mirna ${I.arrow}</a></p>${notes(S.about.notes)}</div>
</div></section>

<section class="sec alt" id="reviews"><div class="wrap">
  <p class="eyebrow rv">${mini}Guest reviews</p><h2 class="rv d1">What guests <em>say</em></h2>
  ${reviewsBlock()}
</div></section>

<section class="sec"><div class="wrap">
  <p class="eyebrow rv">${mini}Planning your visit?</p><h2 class="rv d1">Before you <em>come</em></h2>
  <div class="tiles">
    <a class="tile rv" href="/mostar-herzegovina/#stari-most"><span class="ti" style="background:#d9efe8"><svg data-sign="water" data-ink="dark"></svg></span><span><b>Mostar & the Old Bridge</b><span>What to know about the city</span></span></a>
    <a class="tile rv d1" href="/mostar-herzegovina/#herzegovina"><span class="ti" style="background:#efe0cb"><svg data-sign="star" data-ink="dark"></svg></span><span><b>Around Herzegovina</b><span>Blagaj, Počitelj, Kravice</span></span></a>
    <a class="tile rv d2" href="/faq/"><span class="ti" style="background:#e3e6f2"><svg data-sign="amulet" data-ink="dark"></svg></span><span><b>Practical information</b><span>Meeting points, clothing, children</span></span></a>
    <a class="tile rv d3" href="/mostar-herzegovina/#speak"><span class="ti" style="background:#f3e3d9"><svg data-sign="eye" data-ink="dark"></svg></span><span><b>Speak a little Mostar</b><span>Ćejf, merak, polahko</span></span></a>
  </div>
</div></section>

<section class="prompt"><img src="/img/sumrak.jpg" alt="" loading="lazy"><div class="band weave" data-band="2" style="--bh:36px;position:relative;z-index:3" aria-hidden="true"></div><div class="wrap">
  <p class="eyebrow rv">${mini}Enquire</p><h2 class="rv d1">Tell us your dates. <em>Mirna will reply personally.</em></h2>
  <p class="rv d2">Send the tour you are interested in, your preferred date and how many of you are coming. You will get a personal reply with availability and the final price.</p>
  <div class="contact-row rv d3"><a class="btn mint" href="/contact/">Send an enquiry</a><a class="btn wa" href="${wa('Hello Mirna, I would like to ask about a tour in Mostar.')}">${I.wa} WhatsApp</a><a class="btn ghost" href="${tel}">${I.phone} Call</a></div>
</div></section>`;
  const loader = `<div class="loader" id="loader" aria-hidden="true"><div class="loom2">${bridge('draw')}<img class="lg2" src="/img/logo-light.png" alt=""></div></div>`;
  emit('/', head({ title: 'Mostarly Guide · Private Tours in Mostar with a Licensed Local Guide', desc: S.description, url: '/', ld: [orgLd] }) + page({ current: '/', hero: true, maps: true, body, extraTop: loader, stickyArgs: ['Tours in Mostar', 'With a licensed local guide', '/contact/', 'Hello Mirna, I would like to ask about a tour in Mostar.'] }));
}

// TOURS CATALOGUE
{
  const c = [['/', 'Home'], ['/tours/', 'Tours & Experiences']];
  const body = phead(c, 'Tours <em>&amp; experiences</em>', 'Private walks in Mostar, food and culture, and day trips around Herzegovina. Every tour can be adjusted to your time, pace and interests.') + `
<div class="wrap"><nav class="filters" aria-label="Tour categories">${S.categories.map((x) => `<a href="#${x.id}">${esc(x.name)}</a>`).join('')}<a href="#on-request">On request</a></nav>
${S.categories.map((x) => `<section class="cat" id="${x.id}"><h2 class="rv">${esc(x.name)}</h2><p class="rv d1">${esc(x.intro)}</p><div class="cards three">${TOURS.filter((t) => t.category === x.id).map(card).join('')}</div></section>`).join('')}
<section class="cat" id="on-request"><h2 class="rv">More on request</h2><p class="rv d1">Ask about these if they fit your plans. Details and prices are confirmed personally.</p>
<ul class="onreq">${S.onRequest.map((n) => `<li class="rv"><b>${esc(n)}</b><a class="btn sm line" href="${wa('Hello Mirna, I would like to ask about: ' + n)}" data-tour="${esc(n)}">Ask</a></li>`).join('')}</ul>${notes(['These products have titles only in the brief. Send descriptions, prices and photos to turn them into full tour pages.'])}</section>
<section class="cat"><h2 class="rv">Private and tailor-made</h2><p class="rv d1">Want a different route, more time at one stop or a combination of tours? Tell us what you would like to see.</p><a class="btn" href="/contact/">Plan a custom tour</a></section>
</div>`;
  emit('/tours/', head({ title: 'Tours in Mostar & Herzegovina · Mostarly Guide', desc: 'All tours with Mostarly Guide: Mostar city tours, Bosnian coffee and food, Herzegovina day trips to Blagaj, Počitelj and Kravice, and local experiences.', url: '/tours/', ld: [crumbLd(c)] }) + page({ current: '/tours/', body, stickyArgs: ['Not sure which tour?', 'Ask Mirna', '/contact/', 'Hello Mirna, could you help me choose a tour in Mostar?'] }));
}

// TOUR PAGES
for (const t of TOURS) {
  const c = [['/', 'Home'], ['/tours/', 'Tours'], ['/tours/' + t.slug + '/', t.name]];
  const p = priceInfo(t.price);
  const fact = (ic, k, v, wide) => `<div${wide ? ' class="wide"' : ''}><dt>${ic}${k}</dt><dd>${esc(v)}</dd></div>`;
  const tickets = (t.tickets || []).map((id) => S.tickets.find((x) => x.id === id)).filter(Boolean);
  const related = TOURS.filter((x) => x.slug !== t.slug && x.category === t.category).concat(TOURS.filter((x) => x.slug !== t.slug && x.category !== t.category && x.featured)).slice(0, 3);
  const waText = `Hello Mirna, I would like to enquire about: ${t.name}.`;
  const body = `
<div class="thero">${tourImg(t, '', true)}</div>
<div class="band weave" data-band="0" style="--bh:22px" aria-hidden="true"></div>
<div class="wrap tlayout">
<article>
  <div class="ttop">${crumbs(c)}<p class="eyebrow">${mini}${esc(catName(t.category))}</p><h1>${esc(t.name)}</h1><p class="ttag">${esc(t.tagline)}</p>
  <div class="pricebox"><div class="price">${p.html}</div><a class="btn mint" href="#enquire">Enquire about this tour</a></div>
  <dl class="facts">${fact(I.clock, 'Duration', t.duration)}${fact(I.pin, 'Location', t.location)}${fact(I.group, 'Group size', t.groupSize)}${fact(I.walk, 'Walking level', t.level)}${fact(I.lang, 'Language', t.languages)}${fact(I.cal, 'Availability', t.availability)}${fact(I.pin, 'Meeting point', t.meetingPoint, true)}</dl>
  ${notes(t.notes)}</div>
  <section class="tsec"><h2>About this tour</h2><div class="prose"><p>${esc(t.description)}</p></div></section>
  ${t.route ? routeBlock(t) : ''}
  <section class="tsec"><h2>What you do</h2><ol class="steps">${t.itinerary.map((s) => `<li${s.optional ? ' class="opt"' : ''}>${esc(s.text)}${s.optional ? '<span class="tag">Optional</span>' : ''}</li>`).join('')}</ol>
  ${t.itinerary.some((s) => s.optional) ? '<p class="muted" style="font-size:.85rem;margin-top:.4rem">Optional stops depend on the season, opening hours and your preferences.</p>' : ''}</section>
  <section class="tsec"><h2>Price details</h2><div class="incl">
    <div class="yes"><h3>Included</h3><ul>${t.included.map((x) => `<li>${I.yes}${esc(x)}</li>`).join('')}</ul></div>
    <div class="no"><h3>Not included / paid separately</h3><ul>${t.notIncluded.map((x) => `<li>${I.no}${esc(x)}</li>`).join('')}</ul></div>
  </div>
  ${tickets.length ? `<div style="margin-top:1rem" class="incl"><div style="grid-column:1/-1"><h3>Optional entrance tickets</h3><p class="muted" style="font-size:.88rem">Tick the ones you want in the enquiry form and we will include them in your offer.</p><div class="tickets-info">${tickets.map((x) => `<div><span>${esc(x.label)}</span><b>€${x.price} per person${tbc()}</b></div>`).join('')}</div></div></div>` : ''}</section>
  <section class="tsec"><h2>Good to know</h2><div class="prose"><ul>${t.practical.map((x) => `<li>${esc(x)}</li>`).join('')}<li>The Old Town and most sites have uneven surfaces and steps. Tell us about any mobility needs before we confirm.</li></ul></div></section>
  <section class="tsec"><h2>Photos</h2><div class="gallery">${t.image ? `<img src="/img/${esc(t.image)}" alt="${esc(t.imageAlt)}" loading="lazy" style="aspect-ratio:1;object-fit:cover;border-radius:14px">` : ''}${[1, 2, 3, 4, 5].slice(t.image ? 1 : 0).map(() => `<span>${DRAFT ? 'Real tour photo' : ''}</span>`).join('')}</div></section>
  <section class="tsec"><h2>Guest reviews</h2>${reviewsBlock()}</section>
  <section class="tsec" style="margin-bottom:1rem"><a class="btn mint" href="#enquire">Enquire about this tour</a> <a class="btn wa" href="${wa(waText)}" data-tour="${t.slug}" style="margin-top:.5rem">${I.wa} Ask on WhatsApp</a></section>
</article>
<aside class="aside" id="enquire"><div class="enq-card"><p class="eyebrow">${mini}Enquire</p><h2>${esc(t.name.split(' – ')[0])}</h2><p>${esc(p.text)} · ${esc(t.duration)}</p>${enquiryForm(t.slug)}</div></aside>
</div>
<section class="sec related"><div class="wrap"><div class="head-row"><h2 class="rv">You may also like</h2><a class="btn line sm" href="/tours/">All tours ${I.arrow}</a></div><div class="cards three">${related.map(card).join('')}</div></div></section>`;
  const ld = [crumbLd(c), Object.assign({ '@context': 'https://schema.org', '@type': 'TouristTrip', name: t.name, description: t.description, url: BASE + '/tours/' + t.slug + '/', touristType: ['Independent travellers', 'Families', 'Small groups'], provider: { '@id': BASE + '/#business' }, itinerary: { '@type': 'ItemList', itemListElement: t.itinerary.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.text })) } },
    t.image ? { image: BASE + '/img/' + t.image } : {},
    t.price.confirmed && t.price.basis !== 'request' ? { offers: { '@type': 'Offer', price: t.price.amount, priceCurrency: 'EUR', description: priceInfo(t.price).text, url: BASE + '/tours/' + t.slug + '/' } } : {})];
  emit('/tours/' + t.slug + '/', head({ title: t.seoTitle + ' · Mostarly Guide', desc: t.seoDescription, url: '/tours/' + t.slug + '/', image: t.image ? '/img/' + t.image : '/img/hero-d.jpg', ld }) + page({ current: '/tours/', body, tour: t.slug, maps: !!t.route, stickyArgs: [t.name.split(' – ')[0], p.text, '#enquire', waText] }));
}

// ABOUT
{
  const c = [['/', 'Home'], ['/about/', 'About']];
  const body = phead(c, 'Mostar is <em>home</em>', esc(S.about.short)) + `
<section class="sec"><div class="wrap mirna">${arch}
<div class="prose"><h2 class="rv" style="margin-top:0">Hi, I’m <em>Mirna.</em></h2>${S.about.paragraphs.map((p) => `<p class="rv d1">${esc(p)}</p>`).join('')}
<svg class="sigsvg" viewBox="0 0 200 66" aria-label="Mirna"><text x="2" y="52">Mirna</text></svg><p class="signame">${esc(S.about.experience)}${tbc()}</p>${notes(S.about.notes)}</div></div></section>
<section class="sec dark"><div class="wrap"><p class="eyebrow">${mini}How I guide</p><h2>Clear history, <em>everyday life</em></h2>
<div class="why">${S.why.map((w, i) => `<div class="rv"><svg data-sign="${['eye', 'star', 'water', 'amulet', 'eye'][i]}" aria-hidden="true"></svg><b>${esc(w.t)}</b><span>${esc(w.d)}</span></div>`).join('')}</div></div></section>
<section class="sec"><div class="wrap"><h2 class="rv">On tour</h2><div class="gallery">${['Mirna guiding guests', 'At the Old Bridge', 'Coffee time', 'In Kujundžiluk', 'Day trip', 'Licence / association'].map((x) => `<span>${DRAFT ? esc(x) : ''}</span>`).join('')}</div>${notes(['Add real photos: a portrait, Mirna guiding guests, and any verified licence or association details.'])}
<p style="margin-top:2rem"><a class="btn" href="/tours/">See the tours</a> <a class="btn line" href="/contact/" style="margin-top:.5rem">Get in touch</a></p></div></section>`;
  emit('/about/', head({ title: 'About Mirna · Licensed Local Tour Guide in Mostar · Mostarly Guide', desc: 'Meet Mirna, the licensed tour guide behind Mostarly Guide: born and raised in Mostar, guiding visitors through the city and Herzegovina.', url: '/about/', ld: [crumbLd(c), orgLd] }) + page({ current: '/about/', body, stickyArgs: ['Tours with Mirna', 'Licensed local guide', '/contact/', 'Hello Mirna, I would like to ask about a tour in Mostar.'] }));
}

// MOSTAR & HERZEGOVINA
{
  const c = [['/', 'Home'], ['/mostar-herzegovina/', 'Mostar & Herzegovina']];
  const by = (s) => TOURS.find((t) => t.slug === s);
  const dest = (id, title, img, text, link, label) => `<article class="rv" id="${id}"><div class="dimg">${img}</div><div class="dbody"><h3>${title}</h3><p>${text}</p>${link ? `<a class="go" href="${link}">${label} ${I.arrow}</a>` : ''}</div></article>`;
  const body = phead(c, 'Mostar <em>&amp; Herzegovina</em>', 'Useful things to know before you come, and the tours that go with them. This section will grow into a guide with more places and tips.') + `
<section class="sec" style="padding-top:2.4rem"><div class="wrap">
<h2 class="rv" id="stari-most">In Mostar</h2>
<div class="dest">
${dest('bridge', 'Stari Most, the Old Bridge', '<img src="/img/hero-d.jpg" alt="Stari Most over the Neretva" loading="lazy">', 'Built between 1557 and 1566 by the Ottoman architect Mimar Hayruddin, destroyed on 9 November 1993 and rebuilt with original techniques, it reopened on 23 July 2004. Since 2005 the Old Bridge Area of the Old City of Mostar is on the UNESCO World Heritage List. Jumping from the bridge is a tradition recorded since 1664.', '/tours/mostar-old-town-highlights/', 'Old Town Highlights tour')}
${dest('old-town', 'The Old Town and Kujundžiluk', '<img src="/img/panorama.jpg" alt="The Old Town of Mostar" loading="lazy">', 'Kujundžiluk is the old bazaar street, named after the coppersmiths who worked here. Stone houses, workshops and the cobbled street lead down to the bridge. The cobblestones are uneven and polished smooth, so wear good shoes.', '/tours/mostar-city-tour-bosnian-coffee/', 'City tour with Bosnian coffee')}
${dest('crooked-bridge', 'The Crooked Bridge', '<img src="/img/kriva.jpg" alt="Kriva ćuprija, the Crooked Bridge" loading="lazy">', 'Kriva ćuprija is the small stone bridge over the Radobolja stream, a short walk from the Old Bridge. It is one of the stops on the Old Town walks.', '/tours/mostar-old-town-historic-sites/', 'Old Town & Historic Sites')}
${dest('modern', 'Modern Mostar', '<img src="/img/sumrak.jpg" alt="Mostar in the evening" loading="lazy">', 'Beyond the Old Town are 20th-century buildings, squares and the murals of Mostar’s Street Art Festival, as well as visible marks of the recent past and the city’s reconstruction.', '/tours/modern-mostar/', 'Modern Mostar tour')}
</div>
<h2 class="rv" id="herzegovina" style="margin-top:3.4rem">Around Herzegovina</h2>
<div class="dest">
${dest('blagaj', 'Blagaj', `<div style="position:relative;height:100%">${art(by('blagaj-dervish-tekke-buna-spring'))}</div>`, 'The Buna River rises from a karst spring beneath a high rock face. Next to the spring stands the historic Dervish Tekke.', '/tours/blagaj-dervish-tekke-buna-spring/', 'Blagaj tour')}
${dest('pocitelj', 'Počitelj', `<div style="position:relative;height:100%">${art(by('pocitelj-historic-village'))}</div>`, 'A historic stone village rising above the Neretva, with a fortification, old houses and views over the river valley. The paths are steep.', '/tours/pocitelj-historic-village/', 'Počitelj tour')}
${dest('kravice', 'Kravice Waterfalls', `<div style="position:relative;height:100%">${art(by('herzegovina-day-tour'))}</div>`, 'A wide series of waterfalls on the Trebižat River, with paths around the falls. Entrance is paid on site.', '/tours/herzegovina-day-tour/', 'Herzegovina Day Tour')}
</div>
${notes(['Destination texts use facts we verified (Old Bridge dates, UNESCO). Kravice on the Trebižat River: please double-check, and add your own tips for each place.'])}
<h2 class="rv" id="getting-here" style="margin-top:3.4rem">Getting to Mostar</h2>
<div class="prose"><p class="rv">Mostar is about 130 km by road from Sarajevo, about 140 km from Dubrovnik and about 170 km from Split. Many visitors come for a day from the Croatian coast; staying a night lets you see the Old Town in the quiet of the early morning and in the evening, when the bridge is lit.</p>${notes(['Distances are approximate road distances: confirm or adjust, and add your own advice on buses, trains, parking and border crossings.'])}</div>
</div></section>

<section class="sec alt" id="speak"><div class="wrap speak-grid">
  <div class="coffee rv">${coffeeSVG}</div>
  <div><p class="eyebrow rv">${mini}Speak a little Mostar</p><h2 class="rv d1">A few words <em>before you come</em></h2><p class="lead rv d2">Locals will smile when you use them, and you will hear them on every tour.</p><div class="words" id="words"></div><div class="word" id="word" aria-live="polite"></div></div>
</div></section>

<section class="sec dark kilim-sec"><div class="medal big" aria-hidden="true"><svg data-medallion></svg></div><div class="wrap"><p class="eyebrow">${mini}Woven into Bosnia</p><h2>Every ćilim <em>tells a story</em></h2><p class="lead">Bosnian kilims (ćilimi) are read like a language. These are some of the signs you will see in the old shops of Mostar.</p>
<div class="signs">
<div class="sign rv"><svg data-sign="eye" aria-hidden="true"></svg><b>Eye</b><i>oko</i><p>Protection against the evil eye.</p></div>
<div class="sign rv d1"><svg data-sign="amulet" aria-hidden="true"></svg><b>Amulet</b><i>hamajlija</i><p>A wish for protection and good luck.</p></div>
<div class="sign rv d2"><svg data-sign="star" aria-hidden="true"></svg><b>Star</b><i>zvijezda</i><p>Happiness and a guiding light.</p></div>
<div class="sign rv d3"><svg data-sign="water" aria-hidden="true"></svg><b>Running water</b><i>tekuća voda</i><p>Life that keeps flowing, like the Neretva.</p></div>
</div></div></section>`;
  emit('/mostar-herzegovina/', head({ title: 'Mostar & Herzegovina: What to Know Before You Visit · Mostarly Guide', desc: 'Practical information about Mostar and Herzegovina from a local guide: the Old Bridge, the Old Town, Blagaj, Počitelj, Kravice and how to get to Mostar.', url: '/mostar-herzegovina/', ld: [crumbLd(c)] }) + page({ current: '/mostar-herzegovina/', body, stickyArgs: ['Planning a visit?', 'Ask a local guide', '/contact/', 'Hello Mirna, I am planning a visit to Mostar and have a question.'] }));
}

// TRAVEL PROFESSIONALS
{
  const c = [['/', 'Home'], ['/travel-professionals/', 'For travel professionals']];
  const body = phead(c, 'For travel <em>professionals</em>', 'A reliable local partner in Mostar and Herzegovina for travel agencies, tour operators and DMCs: group handling, tailor-made itineraries and direct contact with the guide.') + `
<section class="sec" style="padding-top:2.4rem"><div class="wrap">
<div class="cards three">${S.services.map((s, i) => `<div class="card rv" style="padding:1.3rem"><svg data-sign="${['eye', 'star', 'water', 'amulet'][i % 4]}" data-ink="dark" style="width:40px;height:40px;margin-bottom:.8rem" aria-hidden="true"></svg><h3 style="font-size:1.25rem;margin-bottom:.4rem">${esc(s.t)}</h3><p class="muted" style="font-size:.94rem">${esc(s.d)}</p></div>`).join('')}</div>
${notes(['Section 13 (B2B) in the brief is empty: add group rates, commission terms, languages, capacity, references or a downloadable rate sheet.'])}
<div class="prompt" style="margin-top:3rem;border-radius:28px"><img src="/img/panorama.jpg" alt="" loading="lazy"><div class="wrap" style="padding:3rem 1.6rem"><h2>Work with a <em>local guide</em></h2><p>Send your dates, group size and programme. You get a direct reply from Mirna with availability and a written offer.</p><div class="contact-row"><a class="btn mint" href="mailto:${S.contact.email}?subject=${encodeURIComponent('Agency enquiry')}">${I.mail} Email</a><a class="btn wa" href="${wa('Hello Mirna, I am contacting you from a travel agency about a group programme in Mostar.')}">${I.wa} WhatsApp</a><a class="btn ghost" href="${tel}">${I.phone} ${esc(S.contact.phone)}</a></div></div></div>
</div></section>`;
  emit('/travel-professionals/', head({ title: 'Local Guide in Mostar for Travel Agencies & DMCs · Mostarly Guide', desc: 'Local guiding partner in Mostar and Herzegovina for agencies, tour operators and DMCs: group handling, tailor-made itineraries, day trips and transfers.', url: '/travel-professionals/', ld: [crumbLd(c)] }) + page({ current: '/travel-professionals/', body }));
}

// CONTACT
{
  const c = [['/', 'Home'], ['/contact/', 'Contact']];
  const body = phead(c, 'Send an <em>enquiry</em>', 'Tell us which tour you are interested in, your preferred date and how many of you are coming. Mirna replies personally with availability and the final price.') + `
<section class="sec" style="padding-top:2.4rem"><div class="wrap tlayout">
<div>
  <div class="cgrid">
    <a class="cbox rv" href="${wa('Hello Mirna, I would like to ask about a tour in Mostar.')}"><span class="ci" style="background:#25d366;color:#0f2b1b">${I.wa}</span><span><b>WhatsApp</b><span>${esc(S.contact.phone)}</span></span></a>
    <a class="cbox rv d1" href="${tel}"><span class="ci">${I.phone}</span><span><b>Phone</b><span>${esc(S.contact.phone)}</span></span></a>
    <a class="cbox rv d2" href="mailto:${S.contact.email}"><span class="ci">${I.mail}</span><span><b>Email</b><span>${S.contact.email}</span></span></a>
    <a class="cbox rv d3" href="https://instagram.com/${S.contact.instagram}" rel="noopener"><span class="ci">${I.ig}</span><span><b>Instagram</b><span>@${S.contact.instagram}</span></span></a>
  </div>${notes(S.contact.notes)}
  <div class="tsec"><h2>Meeting point</h2><div class="prose"><p>Most city walks meet at the <b>${esc(S.contact.meetingPoint)}</b>. The exact location is shared in your confirmation message.</p><p><a class="link" href="${S.contact.mapUrl}" rel="noopener">Open the Hamam area on the map →</a></p></div></div>
</div>
<aside class="aside"><div class="enq-card" id="enquire"><p class="eyebrow">${mini}Enquiry</p><h2>Plan your tour</h2><p>Takes a minute. No payment needed.</p>${enquiryForm()}</div></aside>
</div></section>`;
  emit('/contact/', head({ title: 'Contact Mostarly Guide · Tour Enquiries in Mostar', desc: 'Send an enquiry to Mostarly Guide by form, WhatsApp, phone or email. Mirna replies personally with availability and the final price.', url: '/contact/', ld: [crumbLd(c), orgLd] }) + page({ current: '/contact/', body }));
}

// FAQ
{
  const c = [['/', 'Home'], ['/faq/', 'Practical information']];
  const body = phead(c, 'Practical <em>information</em>', 'Meeting points, tickets, clothing, children and more. If your question is not here, just ask.') + `
<section class="sec" style="padding-top:2.4rem"><div class="wrap narrow"><div class="faq">${S.faq.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p>${f.note ? notes([f.note]) : ''}</details>`).join('')}</div>
<p style="margin-top:2rem"><a class="btn" href="/contact/">Ask a question</a></p></div></section>`;
  const ld = [crumbLd(c), { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: S.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }];
  emit('/faq/', head({ title: 'Practical Information & FAQ · Tours in Mostar · Mostarly Guide', desc: 'Meeting points, entrance tickets, accessibility, children, what to wear and bad weather: practical answers for tours in Mostar and Herzegovina.', url: '/faq/', ld }) + page({ current: '/faq/', body }));
}

// LEGAL placeholders
for (const [url, title, intro] of [['/privacy/', 'Privacy policy', 'How Mostarly Guide handles the information you send with an enquiry.'], ['/terms/', 'Terms', 'Terms for tours and services booked with Mostarly Guide.'], ['/cancellation-policy/', 'Cancellation policy', 'What happens if you need to cancel or change a confirmed tour.']]) {
  const c = [['/', 'Home'], [url, title]];
  const privacy = url === '/privacy/' ? '<p>When you send an enquiry, we receive the details you enter (name, email or phone number, dates, number of guests and your message) so we can reply and plan your tour. We do not sell or share these details with third parties for marketing.</p>' : '';
  const body = phead(c, esc(title), esc(intro)) + `<section class="sec" style="padding-top:2.4rem"><div class="wrap narrow prose">${privacy}${notes(['The owner must supply and approve the legal wording for this page before launch.'])}</div></section>`;
  emit(url, head({ title: title + ' · Mostarly Guide', desc: intro, url, noindex: true }) + page({ body }));
}

// 404
emit('/404', head({ title: 'Page not found · Mostarly Guide', desc: 'This page does not exist.', url: '/404', noindex: true }) + page({ body: `<section class="sec"><div class="wrap narrow" style="text-align:center"><p class="eyebrow" style="justify-content:center">${mini}404</p><h1>This street <em>ends here</em></h1><p class="lead" style="margin:1rem auto 2rem">The page you were looking for does not exist. The Old Bridge is still where it was.</p><a class="btn" href="/">Back home</a> <a class="btn line" href="/tours/">See the tours</a></div></section>` }));

/* ---------- write ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const [url, html] of out) {
  const file = url === '/404' ? path.join(DIST, '404.html') : path.join(DIST, url, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html.replace(/\n\s*\n/g, '\n'));
}
fs.writeFileSync(path.join(DIST, 'site.css'), CSS);
fs.writeFileSync(path.join(DIST, 'site.js'), JS);
fs.cpSync(path.join(ROOT, 'src/img'), path.join(DIST, 'img'), { recursive: true });
fs.cpSync(path.join(ROOT, 'src/geo'), path.join(DIST, 'geo'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'maps.js'), MAPJS);
fs.cpSync(path.join(ROOT, 'admin'), path.join(DIST, 'admin'), { recursive: true });
const urls = out.map(([u]) => u).filter((u) => u !== '/404' && !['/privacy/', '/terms/', '/cancellation-policy/'].includes(u));
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${BASE}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), DRAFT ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${BASE}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/img/*\n  Cache-Control: public, max-age=2592000\n/site.*\n  Cache-Control: public, max-age=31536000, immutable\n`);

/* ---------- checks: internal links and banned phrases ---------- */
const have = new Set(out.map(([u]) => u));
const problems = [];
for (const [url, html] of out) {
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const h = m[1];
    if (/\.(css|js|svg|jpg|png|xml|txt)$/.test(h) || h.startsWith('/admin')) continue;
    if (!have.has(h)) problems.push(`${url}: broken link ${h}`);
  }
  const text = html.replace(/<[^>]+>/g, ' ').toLowerCase();
  for (const w of ['embark', 'immerse', 'unforgettable', 'hidden gem']) if (text.includes(w)) problems.push(`${url}: banned phrase "${w}"`);
}
console.log(`Mostarly: ${out.length} pages${DRAFT ? ' (draft)' : ''} -> dist/`);
if (problems.length) { console.log(problems.join('\n')); process.exitCode = 1; }
