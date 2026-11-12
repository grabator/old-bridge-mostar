/* Mostarly Guide: kilim details, day/night hero, enquiry form, tracking. No dependencies. */
(function () {
  'use strict';
  var D = {};
  try { D = JSON.parse(document.getElementById('mly-data').textContent); } catch (e) {}
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- tracking: GA4 when enabled, dataLayer always ---------- */
  window.dataLayer = window.dataLayer || [];
  function track(name, params) {
    params = params || {};
    window.dataLayer.push(Object.assign({ event: name }, params));
    if (typeof window.gtag === 'function') window.gtag('event', name, params);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    var tour = a.getAttribute('data-tour') || document.body.getAttribute('data-tour') || '';
    if (h.indexOf('https://wa.me/') === 0) track('whatsapp_click', { tour: tour });
    else if (h.indexOf('mailto:') === 0) track('email_click', { tour: tour });
    else if (h.indexOf('tel:') === 0) track('phone_click', { tour: tour });
  });

  /* ---------- consent + GA4 (only if an ID is configured) ---------- */
  (function () {
    if (!D.ga4) return;
    var key = 'mly-consent', v = null;
    try { v = localStorage.getItem(key); } catch (e) {}
    function load() {
      var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + D.ga4; document.head.appendChild(s);
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', D.ga4, { anonymize_ip: true });
    }
    if (v === 'yes') return load();
    if (v === 'no') return;
    var box = document.createElement('div'); box.className = 'consent'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Cookies');
    box.innerHTML = '<p>We use analytics cookies to see which tours people are interested in. No advertising cookies. <a href="/privacy/">Privacy policy</a></p><div><button class="btn sm line" data-c="no">No thanks</button><button class="btn sm" data-c="yes">Accept</button></div>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) { var c = e.target.getAttribute('data-c'); if (!c) return; try { localStorage.setItem(key, c); } catch (er) {} box.remove(); if (c === 'yes') load(); });
  })();

  /* ---------- kilim engine: pixel grids -> svg rects ---------- */
  var C = { n: '#272838', c: '#f6f0e6', m: '#48e5c2', k: '#d08a55', r: '#c8423a', y: '#fcec52', e: '#0a8a71' };
  function rects(grid, map, ox, oy) {
    ox = ox || 0; oy = oy || 0; var s = '';
    grid.forEach(function (row, y) { var x = 0; while (x < row.length) { var ch = row[x]; if (ch === '.' || !map[ch]) { x++; continue; } var e = x; while (e < row.length && row[e] === ch) e++; s += '<rect x="' + (x + ox) + '" y="' + (y + oy) + '" width="' + (e - x) + '" height="1" fill="' + map[ch] + '"/>'; x = e; } });
    return s;
  }
  var SIGNS = {
    eye: ['....A....', '...AAA...', '..AA.AA..', '.AA.B.AA.', 'AA.BBB.AA', '.AA.B.AA.', '..AA.AA..', '...AAA...', '....A....'],
    amulet: ['....A....', '...AAA...', '..AA.AA..', '.AA.B.AA.', 'AAAAAAAAA', '.........', 'A.A.A.A.A', 'A.A.A.A.A', '.........'],
    star: ['A...A...A', '.A..A..A.', '..A.A.A..', '...AAA...', 'AAAABAAAA', '...AAA...', '..A.A.A..', '.A..A..A.', 'A...A...A'],
    water: ['A.....A.....A', '.A...A.A...A.', '..A.A...A.A..', '...A.....A...', '.............', 'A.....A.....A', '.A...A.A...A.', '..A.A...A.A..', '...A.....A...']
  };
  function svgGrid(el, grid, map, pad) {
    pad = pad || 0; var w = grid[0].length, h = grid.length;
    el.setAttribute('viewBox', (-pad) + ' ' + (-pad) + ' ' + (w + pad * 2) + ' ' + (h + pad * 2));
    el.setAttribute('shape-rendering', 'crispEdges'); el.innerHTML = rects(grid, map);
  }
  /* Bosnian kilim (ćilim): madder-red field with small stars, black band with leaves,
     cream border with hooked flowers, red sawtooth edges. Palette taken from traditional rugs. */
  var K = { red: '#c8271c', cream: '#f3e7cf', black: '#1b1411', orange: '#e5652a', gold: '#efaa2f', maroon: '#7c1d1b', green: '#2f5b2c', white: '#fffaf0' };
  var FLOWER = ['.AA.......AA.', 'A..A.....A..A', 'A.AAA...AAA.A', '.A..AAAAA..A.', '...ABBBBBA...', '..AABCBCBAA..', '.AAABBCBBAAA.', '..AABCBCBAA..', '...ABBBBBA...', '.A..AAAAA..A.', 'A.AAA...AAA.A', 'A..A.....A..A', '.AA.......AA.'];
  var LEAF = ['....AAA..', '..AAAABA.', '.AAABBCA.', '.AABBCBA.', '.ABCBBAA.', '.ABAAAA..', '..AAA....'];
  var STAR = ['...A...', '..WAW..', '.WAYAW.', 'AAYGYAA', '.WAYAW.', '..WAW..', '...A...'];
  var FLOWER_COLORS = [[K.orange, K.black, K.cream], [K.gold, K.maroon, K.cream], [K.maroon, K.black, K.gold], [K.black, K.red, K.cream], [K.red, K.black, K.gold], [K.green, K.black, K.cream]];
  var LEAF_COLORS = [[K.orange, K.maroon, K.cream], [K.gold, K.red, K.black], [K.white, K.red, K.black], [K.red, K.gold, K.cream], [K.green, K.gold, K.cream], [K.gold, K.green, K.cream]];
  function px(x, y, w, c) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="1" fill="' + c + '"/>'; }
  function saw(W, y, dir, color, period) { // red teeth pointing into the band
    var s = ''; for (var x = 0; x < W; x++) { var p = x % period; if (p < period - 1) s += px(x, y, 1, color); if (p === Math.floor(period / 2) - 1 || (period === 3 && p === 0)) s += px(x, y + dir, 1, color); } return s;
  }
  function bandTile(kind) { // cream border with hooked flowers
    var H = 19, step = 17, count = 6, W = step * count;
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + K.cream + '"/>' + px(0, 0, W, K.red) + px(0, H - 1, W, K.red) + saw(W, 1, 1, K.red, 4) + saw(W, H - 2, -1, K.red, 4);
    for (var i = 0; i < count; i++) { var c = FLOWER_COLORS[(i + kind) % FLOWER_COLORS.length]; s += rects(FLOWER, { A: c[0], B: c[1], C: c[2] }, i * step + 2, 3); s += px(i * step + 16, 9, 1, K.maroon); }
    return { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" shape-rendering="crispEdges">' + s + '</svg>', W: W, H: H };
  }
  function bandSlim() { // black band with leaves
    var H = 11, step = 11, count = 6, W = step * count;
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + K.black + '"/>' + px(0, 0, W, K.red) + px(0, H - 1, W, K.red);
    for (var x = 0; x < W; x += 3) { s += px(x, 1, 1, K.red) + px(x, H - 2, 1, K.red); }
    for (var i = 0; i < count; i++) { var c = LEAF_COLORS[i % LEAF_COLORS.length]; s += rects(LEAF, { A: c[0], B: c[1], C: c[2] }, i * step + 1, 2); }
    return { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" shape-rendering="crispEdges">' + s + '</svg>', W: W, H: H };
  }
  $$('[data-band]').forEach(function (el) {
    var k = +el.getAttribute('data-band'), t = k === 0 ? bandSlim() : bandTile(k);
    var h = el.getBoundingClientRect().height || 40;
    el.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(t.svg) + '")';
    el.style.backgroundSize = (t.W * h / t.H) + 'px ' + h + 'px';
  });
  $$('[data-mini]').forEach(function (el) { svgGrid(el, STAR, { A: K.red, W: K.gold, Y: K.black, G: K.green }); });

  /* tone-on-tone kilim watermark behind the whole page (barely visible, day and night) */
  (function () {
    function tile(tone) {
      var s = rects(FLOWER, { A: tone, B: tone, C: 'none' }, 2, 2) + rects(FLOWER, { A: tone, B: tone, C: 'none' }, 16, 16) +
        rects(STAR, { A: tone, W: 'none', Y: tone, G: tone }, 17, 5) + rects(STAR, { A: tone, W: 'none', Y: tone, G: tone }, 3, 19);
      return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" shape-rendering="crispEdges">' + s + '</svg>') + '")';
    }
    var r = document.documentElement.style;
    r.setProperty('--wm-day', tile('#f0e7d6'));
    r.setProperty('--wm-night', tile('#1c1b27'));
  })();

  /* round kilim medallion: red field with stars and a diamond lattice, black leaf ring, cream flower ring */
  $$('[data-medallion]').forEach(function (el, n) {
    var id = 'md' + n, fl = '', lf = '', st = '';
    for (var i = 0; i < 4; i++) { var c = FLOWER_COLORS[(i * 2 + n) % FLOWER_COLORS.length]; fl += rects(FLOWER, { A: c[0], B: c[1], C: c[2] }, (i % 2) * 15 + 1, Math.floor(i / 2) * 15 + 1); }
    for (var j = 0; j < 4; j++) { var d = LEAF_COLORS[j % LEAF_COLORS.length]; lf += rects(LEAF, { A: d[0], B: d[1], C: d[2] }, (j % 2) * 10 + 1, Math.floor(j / 2) * 8 + 1); }
    st = rects(STAR, { A: K.black, W: K.white, Y: K.gold, G: K.green }, 1, 1) + rects(STAR, { A: K.black, W: K.white, Y: K.gold, G: K.green }, 6, 6);
    function teeth(r1, r2, steps, color) { var p = ''; for (var k = 0; k < steps; k++) { var a = k / steps * Math.PI * 2, b = (k + .5) / steps * Math.PI * 2, e = (k + 1) / steps * Math.PI * 2; p += 'M' + (100 + Math.cos(a) * r1).toFixed(2) + ' ' + (100 + Math.sin(a) * r1).toFixed(2) + 'L' + (100 + Math.cos(b) * r2).toFixed(2) + ' ' + (100 + Math.sin(b) * r2).toFixed(2) + 'L' + (100 + Math.cos(e) * r1).toFixed(2) + ' ' + (100 + Math.sin(e) * r1).toFixed(2) + 'Z'; } return '<path d="' + p + '" fill="' + color + '"/>'; }
    function diamond(r) { return '<path d="M100 ' + (100 - r) + 'L' + (100 + r) + ' 100L100 ' + (100 + r) + 'L' + (100 - r) + ' 100Z" fill="none" stroke="' + K.black + '" stroke-width="1.6"/>'; }
    el.setAttribute('viewBox', '0 0 200 200');
    el.innerHTML = '<defs>' +
      '<pattern id="' + id + 'f" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="scale(.62)"><rect width="30" height="30" fill="' + K.cream + '"/>' + fl + '</pattern>' +
      '<pattern id="' + id + 'l" width="20" height="16" patternUnits="userSpaceOnUse" patternTransform="scale(.6)"><rect width="20" height="16" fill="' + K.black + '"/>' + lf + '</pattern>' +
      '<pattern id="' + id + 's" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="scale(.85)"><rect width="10" height="10" fill="' + K.red + '"/>' + st + '</pattern></defs>' +
      '<g shape-rendering="crispEdges"><circle cx="100" cy="100" r="99" fill="' + K.red + '"/><circle cx="100" cy="100" r="96" fill="url(#' + id + 'f)"/>' +
      '<circle cx="100" cy="100" r="75" fill="url(#' + id + 'l)"/><circle cx="100" cy="100" r="64" fill="url(#' + id + 's)"/></g>' +
      teeth(96.2, 93, 96, K.red) + teeth(75, 77.6, 72, K.red) + teeth(64, 66, 60, K.red) +
      diamond(44) + diamond(30) + '<path d="M100 56V144M56 100H144" stroke="' + K.black + '" stroke-width="1" opacity=".5"/>' +
      '<g transform="translate(91.25 91.25) scale(2.5)" shape-rendering="crispEdges">' + rects(STAR, { A: K.black, W: K.cream, Y: K.gold, G: K.green }) + '</g>';
  });
  $$('[data-sign]').forEach(function (el) { svgGrid(el, SIGNS[el.getAttribute('data-sign')], { A: el.getAttribute('data-ink') === 'dark' ? C.e : C.c, B: el.getAttribute('data-ink') === 'dark' ? C.k : C.m }, .5); });
  $$('.corner').forEach(function (el) { el.innerHTML = '<svg viewBox="0 0 7 7" shape-rendering="crispEdges">' + rects(['AAAA...', 'A......', 'A.BB...', 'A.B....', '.......', '.......', '.......'], { A: K.red, B: K.gold }) + '</svg>'; });

  /* ---------- loader (home, once per visit) ---------- */
  (function () {
    var L = $('#loader');
    if (!L) { document.body.classList.add('ready'); return; }
    var rh = $('[data-rhomb]', L); if (rh) svgGrid(rh, FLOWER, { A: K.cream, B: K.red, C: K.gold });
    var seen = false; try { seen = sessionStorage.getItem('mly-loom') === '1'; } catch (e) {}
    function done() { L.classList.add('done'); document.body.classList.add('ready'); try { sessionStorage.setItem('mly-loom', '1'); } catch (e) {} }
    if (seen || reduce) { L.style.display = 'none'; document.body.classList.add('ready'); } else setTimeout(done, 3000);
    L.addEventListener('click', done);
  })();

  /* ---------- day / night theme: saved choice, otherwise Mostar time (set in <head>) ---------- */
  (function () {
    var M = window.__mly || { choice: '', clock: '' }, sky = $('#sky'), now = $('#now'), meta = $('meta[name=theme-color]');
    if (sky) {
      var st = ''; for (var i = 0; i < 46; i++) { var r = (i * 9301 + 49297) % 233280 / 233280, q = (i * 4096 + 150889) % 714025 / 714025; st += '<b style="left:' + (r * 100).toFixed(1) + '%;top:' + (q * 100).toFixed(1) + '%;animation-delay:' + (r * 3.5).toFixed(2) + 's;opacity:' + (.35 + q * .6).toFixed(2) + '"></b>'; }
      sky.innerHTML = st;
    }
    function set(n, user) {
      var root = document.documentElement;
      if (user) { root.classList.add('theme-anim'); setTimeout(function () { root.classList.remove('theme-anim'); }, 700); }
      root.classList.toggle('is-night', n);
      if (meta) meta.setAttribute('content', n ? '#14131d' : '#272838');
      $$('.tswitch button').forEach(function (b) { b.setAttribute('aria-pressed', String((b.getAttribute('data-t') === 'night') === n)); });
      if (now) {
        $('i', now).textContent = n ? '☾' : '☀';
        $('span', now).textContent = user || M.choice || !M.clock ? (n ? 'Mostar after akšam, the bridge lit' : 'Mostar by day, the emerald Neretva') : 'In Mostar it is ' + M.clock + (n ? ', the bridge is lit' : '');
      }
    }
    set(document.documentElement.classList.contains('is-night'), false);
    $$('.tswitch button').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = b.getAttribute('data-t') === 'night';
        try { localStorage.setItem('mly-theme', n ? 'night' : 'day'); } catch (e) {}
        set(n, true); track('theme_' + (n ? 'night' : 'day'));
      });
    });
    window.__setNight = set;
  })();

  /* ---------- copper catches the light ---------- */
  (function () {
    var gl = $('#glint'), tx = 0, ty = 0, live = false;
    function apply() { if (gl) { gl.setAttribute('cx', (60 + tx * 30).toFixed(1)); gl.setAttribute('cy', (60 + ty * 30).toFixed(1)); } document.documentElement.style.setProperty('--tx', tx.toFixed(3)); }
    addEventListener('deviceorientation', function (e) { if (e.gamma == null) return; live = true; tx = Math.max(-1, Math.min(1, e.gamma / 30)); ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); apply(); }, { passive: true });
    addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse') return; live = true; tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; apply(); }, { passive: true });
    if (reduce) return;
    var t = 0; (function drift() { if (!live) { t += .012; tx = Math.sin(t) * .8; ty = Math.cos(t * .7) * .6; apply(); } requestAnimationFrame(drift); })();
  })();

  /* ---------- copper arabesque on cards ---------- */
  $$('[data-arab]').forEach(function (el, i) {
    el.innerHTML = '<defs><linearGradient id="ag' + i + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f4a26"/><stop offset=".5" stop-color="#eab087"/><stop offset="1" stop-color="#a65a30"/></linearGradient></defs><g fill="none" stroke="url(#ag' + i + ')" stroke-width="1.6" stroke-linecap="round"><path d="M76 4 C 52 6, 34 18, 30 40 C 27 56, 38 66, 50 62 C 60 58, 60 46, 52 43 C 46 41, 42 46, 45 50"/><path d="M76 14 C 60 16, 48 26, 46 38"/><path d="M30 40 C 22 34, 12 36, 10 44 C 8 52, 16 56, 21 52"/><path d="M50 62 C 54 70, 64 74, 72 70"/><circle cx="66" cy="30" r="2.2" fill="url(#ag' + i + ')" stroke="none"/><circle cx="20" cy="66" r="1.6" fill="url(#ag' + i + ')" stroke="none"/></g>';
  });

  /* ---------- rozeta petals ---------- */
  $$('[data-petals]').forEach(function (g) { var s = ''; for (var i = 0; i < 8; i++) { s += '<path transform="rotate(' + (i * 45) + ' 60 60)" d="M60 60 C 65 52, 65 40, 60 33 C 55 40, 55 52, 60 60"/><circle transform="rotate(' + (i * 45 + 22.5) + ' 60 60)" cx="60" cy="36" r="1.4" fill="#e7aa7c" stroke="none"/>'; } g.innerHTML = s; });

  /* ---------- reveal on scroll ---------- */
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .15, rootMargin: '0px 0px -5% 0px' });
  $$('.rv,.shine,.sigsvg,.coffee,.rows,.bridge.signature').forEach(function (el) { io.observe(el); });
  var proxy = new Map();
  var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { proxy.get(e.target).classList.add('in'); io2.unobserve(e.target); } }); }, { threshold: .01 });
  $$('.weave').forEach(function (el) { var w = document.createElement('div'); w.style.position = 'relative'; w.style.zIndex = 3; el.parentNode.insertBefore(w, el); w.appendChild(el); proxy.set(w, el); io2.observe(w); });
  if (reduce) $$('.rv,.weave,.sigsvg,.coffee').forEach(function (el) { el.classList.add('in'); });

  /* ---------- mobile menu ---------- */
  (function () {
    var sheet = $('#sheet'); if (!sheet) return;
    function open(v) { sheet.classList.toggle('open', v); document.body.style.overflow = v ? 'hidden' : ''; $$('[data-menu]').forEach(function (b) { b.setAttribute('aria-expanded', String(v)); }); if (v) $('a', sheet).focus(); }
    $$('[data-menu]').forEach(function (b) { b.addEventListener('click', function () { open(!sheet.classList.contains('open')); }); });
    $$('a', sheet).forEach(function (a) { a.addEventListener('click', function () { open(false); }); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet.classList.contains('open')) open(false); });
  })();

  /* ---------- sticky action (mobile) ---------- */
  (function () {
    var st = $('#sticky'); if (!st) return;
    var hero = $('.hero') || $('.thero'), forms = $$('[data-enq]');
    function upd() {
      var past = hero ? hero.getBoundingClientRect().bottom < 40 : scrollY > 300;
      var atForm = forms.some(function (f) { var r = f.getBoundingClientRect(); return r.top < innerHeight * .85 && r.bottom > 0; });
      st.classList.toggle('off', !past || atForm);
    }
    addEventListener('scroll', upd, { passive: true }); upd();
  })();

  /* ---------- kaldrma rail ---------- */
  (function () {
    var rail = $('#rail'); if (!rail) return;
    var svg = $('svg', rail), N = 34, s = '', gr = ['#9b958b', '#857f75', '#b4ada1', '#6f6a61'];
    for (var i = 0; i < N; i++) s += '<ellipse cx="50%" cy="' + ((i + .5) / N * 100) + '%" rx="' + (3.2 + ((i * 37) % 10) / 10 * 1.4) + '" ry="' + (2 + ((i * 53) % 10) / 10 * .9) + '" fill="' + (i % 9 === 8 ? '#48e5c2' : gr[i % 4]) + '" stroke="#f6f0e6" stroke-width=".8"/>';
    svg.innerHTML = s; var st = $$('ellipse', svg);
    function upd() { var max = document.documentElement.scrollHeight - innerHeight, p = max > 0 ? scrollY / max : 0, k = Math.round(p * N); st.forEach(function (e, i) { e.classList.toggle('on', i < k); }); rail.classList.toggle('show', scrollY > innerHeight * .6); }
    addEventListener('scroll', upd, { passive: true }); upd();
  })();

  /* ---------- speak a little Mostar ---------- */
  (function () {
    var box = $('#words'), card = $('#word'); if (!box || !card) return;
    var W = [['ćejf', 'chayf', 'Slow, deliberate enjoyment. A Bosnian coffee is never rushed: it is a reason to sit, talk and watch the city go by.'],
      ['polahko', 'po-lah-ko', 'Easy, take your time. You will hear it all over Herzegovina, usually with a smile.'],
      ['merak', 'meh-rak', 'The quiet joy of doing something you love, just for the pleasure of it.'],
      ['sevdah', 'sev-dah', 'Love and longing, and the old soulful songs, sevdalinke, sung about it.'],
      ['akšam', 'ak-sham', 'Dusk. The light turns gold over the Neretva and the lamps on the bridge come on.'],
      ['hajde', 'hai-deh', 'Come on, let’s go. The word that starts every walk.']];
    function show(i) { card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap'); card.innerHTML = '<div class="w">' + W[i][0] + '</div><span class="say">say “' + W[i][1] + '”</span><p>' + W[i][2] + '</p>'; $$('button', box).forEach(function (b, j) { b.setAttribute('aria-pressed', String(j === i)); }); }
    box.innerHTML = W.map(function (w) { return '<button type="button">' + w[0] + '</button>'; }).join('');
    $$('button', box).forEach(function (b, i) { b.addEventListener('click', function () { show(i); }); }); show(0);
  })();

  /* ---------- enquiry form ---------- */
  var TOURS = D.tours || [], TICKETS = D.tickets || [];
  function tourBy(slug) { return TOURS.filter(function (t) { return t.slug === slug; })[0]; }
  $$('[data-enq]').forEach(function (wrap) {
    var f = $('form', wrap), sel = $('[name=tour]', f), tk = $('.ticks', f), tkList = $('.tk-list', f);
    var cnt = { adults: 2, children: 0 };
    function renderTickets() {
      var t = tourBy(sel.value), ids = t ? t.tickets : [];
      tk.hidden = !ids.length;
      tkList.innerHTML = ids.map(function (id) { var x = TICKETS.filter(function (k) { return k.id === id; })[0]; return x ? '<label><input type="checkbox" name="tickets" value="' + x.id + '"> ' + x.label + '<span>€' + x.price + ' pp</span></label>' : ''; }).join('');
      $('.ages', f).hidden = cnt.children === 0;
    }
    $$('[data-s]', f).forEach(function (b) {
      b.addEventListener('click', function () { var k = b.getAttribute('data-s'); cnt[k] = Math.max(k === 'adults' ? 1 : 0, Math.min(40, cnt[k] + (+b.getAttribute('data-d')))); $('[data-v=' + k + ']', f).textContent = cnt[k]; $('[name=' + k + ']', f).value = cnt[k]; renderTickets(); });
    });
    sel.addEventListener('change', renderTickets); renderTickets();
    function val(n) { var el = f.elements[n]; return el ? String(el.value || '').trim() : ''; }
    function collect() {
      var t = tourBy(sel.value);
      var tickets = $$('[name=tickets]:checked', f).map(function (c) { var x = TICKETS.filter(function (k) { return k.id === c.value; })[0]; return x.label + ' (€' + x.price + ' pp)'; });
      return { tour: t ? t.name : 'Not sure yet / custom request', tourSlug: sel.value, date: val('date'), adults: cnt.adults, children: cnt.children, ages: val('ages'), name: val('name'), email: val('email'), phone: val('phone'), message: val('message'), tickets: tickets, website: val('website') };
    }
    function check(d) {
      $$('.err', f).forEach(function (e) { e.classList.remove('err'); });
      var bad = [];
      if (!d.name) bad.push('name');
      if (!d.email && !d.phone) bad.push('email', 'phone');
      if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) bad.push('email');
      bad.forEach(function (n) { f.elements[n] && f.elements[n].classList.add('err'); });
      $('.formerr', f).textContent = bad.length ? 'Please add your name and an email address or WhatsApp number.' : '';
      return !bad.length;
    }
    function message(d) {
      var date = d.date ? new Date(d.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'flexible';
      var L = ['Hello Mirna, I would like to enquire about:', '• Tour: ' + d.tour, '• Preferred date: ' + date, '• Guests: ' + d.adults + ' adult' + (d.adults > 1 ? 's' : '') + (d.children ? ', ' + d.children + ' child' + (d.children > 1 ? 'ren' : '') + (d.ages ? ' (ages ' + d.ages + ')' : '') : '')];
      if (d.tickets.length) L.push('• Include tickets: ' + d.tickets.join(', '));
      if (d.message) L.push('• Message: ' + d.message);
      L.push('', d.name + (d.email ? ' · ' + d.email : '') + (d.phone ? ' · ' + d.phone : ''));
      return L.join('\n');
    }
    function finish(how) { wrap.classList.add('sent'); $('.done-how', wrap).textContent = how; wrap.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }
    $('[data-send=wa]', f).addEventListener('click', function () {
      var d = collect(); if (!check(d)) return;
      track('enquiry_whatsapp', { tour: d.tourSlug });
      window.open('https://wa.me/' + D.whatsapp + '?text=' + encodeURIComponent(message(d)), '_blank', 'noopener');
      finish('Your message is ready in WhatsApp. Press send there and Mirna will reply personally.');
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var d = collect(); if (!check(d)) return;
      if (d.website) return; // honeypot
      var btn = $('[type=submit]', f); btn.disabled = true; btn.textContent = 'Sending…';
      fetch('/api/enquiry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function () { track('enquiry_submit', { tour: d.tourSlug }); finish('We have received your enquiry and sent it to ' + D.email + '.'); })
        .catch(function () {
          // no mail service configured yet: open the visitor's email app with the message ready
          track('enquiry_mailto', { tour: d.tourSlug });
          location.href = 'mailto:' + D.email + '?subject=' + encodeURIComponent('Tour enquiry: ' + d.tour) + '&body=' + encodeURIComponent(message(d));
          finish('Your email app opened with the enquiry ready. Press send there and Mirna will reply personally.');
        })
        .then(function () { btn.disabled = false; btn.textContent = 'Send enquiry by email'; });
    });
    $('[data-again]', wrap).addEventListener('click', function () { wrap.classList.remove('sent'); });
  });

  // pre-select a tour from ?tour= on the contact page
  (function () { var p = new URLSearchParams(location.search).get('tour'); var s = $('[data-enq] [name=tour]'); if (p && s && tourBy(p)) { s.value = p; s.dispatchEvent(new Event('change')); } })();
})();
