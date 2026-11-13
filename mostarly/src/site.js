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
  $$('.rv,.shine,.sigsvg,.rows,.bridge.signature').forEach(function (el) { io.observe(el); });
  var proxy = new Map();
  var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { proxy.get(e.target).classList.add('in'); io2.unobserve(e.target); } }); }, { threshold: .01 });
  $$('.weave').forEach(function (el) { var w = document.createElement('div'); w.style.position = 'relative'; w.style.zIndex = 3; el.parentNode.insertBefore(w, el); w.appendChild(el); proxy.set(w, el); io2.observe(w); });
  if (reduce) $$('.rv,.weave,.sigsvg').forEach(function (el) { el.classList.add('in'); });

  /* ---------- mobile menu ---------- */
  (function () {
    // header: over the hero it is transparent; once you scroll it becomes a glass bar that stays on top
    var navEl = $('.nav');
    if (navEl && !navEl.classList.contains('solid')) {
      var stuckNow = false, ticking = false;
      var onNav = function () { ticking = false; var v = scrollY > 40; if (v !== stuckNow) { stuckNow = v; navEl.classList.toggle('stuck', v); } };
      addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onNav); } }, { passive: true }); onNav();
    }
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


  /* ---------- form widgets: dropdown, calendar ---------- */
  function closeAllPops(except) { $$('.dd-pop:not([hidden]),.dp-pop:not([hidden])').forEach(function (p) { if (p !== except) { p.hidden = true; var b = p.parentNode.querySelector('.dd-btn'); if (b) b.setAttribute('aria-expanded', 'false'); p.parentNode.classList.remove('open'); } }); }
  document.addEventListener('click', function (e) { if (e.target.isConnected && !e.target.closest('.dd,.dp')) closeAllPops(); }); // a re-drawn calendar button is no longer in the page: not an outside click
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var o = $('.dd.open .dd-btn,.dp.open .dd-btn'); closeAllPops(); if (o) o.focus(); } });
  $$('[data-dd]').forEach(function (dd) {
    var sel = $('select', dd), btn = $('.dd-btn', dd), pop = $('.dd-pop', dd), label = $('span', btn);
    function build() {
      var html = '';
      Array.prototype.forEach.call(sel.children, function (n) {
        if (n.tagName === 'OPTGROUP') { html += '<div class="dd-g">' + n.label + '</div>'; Array.prototype.forEach.call(n.children, function (o) { html += opt(o); }); }
        else html += opt(n);
      });
      pop.innerHTML = html;
    }
    function opt(o) { return '<div class="dd-o" role="option" tabindex="-1" data-v="' + o.value + '" aria-selected="' + (o.selected ? 'true' : 'false') + '">' + o.textContent + '</div>'; }
    function sync() { var o = sel.options[sel.selectedIndex]; label.textContent = o ? o.textContent : ''; dd.classList.toggle('has', !!sel.value); $$('.dd-o', pop).forEach(function (x) { x.setAttribute('aria-selected', String(x.getAttribute('data-v') === sel.value)); }); }
    function open() { closeAllPops(pop); build(); pop.hidden = false; dd.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); var cur = $('.dd-o[aria-selected=true]', pop) || $('.dd-o', pop); if (cur) { cur.focus(); cur.scrollIntoView({ block: 'nearest' }); } }
    function pick(v) { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); closeAllPops(); btn.focus(); }
    btn.addEventListener('click', function () { if (pop.hidden) open(); else closeAllPops(); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    pop.addEventListener('click', function (e) { var o = e.target.closest('.dd-o'); if (o) pick(o.getAttribute('data-v')); });
    pop.addEventListener('keydown', function (e) {
      var list = $$('.dd-o', pop), i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (list[i - 1] || list[list.length - 1]).focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (list[i]) pick(list[i].getAttribute('data-v')); }
      else if (e.key === 'Tab') closeAllPops();
    });
    sel.addEventListener('change', sync); sync();
  });
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // days Mirna marked as busy in the admin cannot be chosen
  var BUSY = {};
  if ($('[data-dp]') && window.fetch) fetch('/api/blocked').then(function (r) { return r.ok ? r.json() : { dates: [] }; }).then(function (j) { (j.dates || []).forEach(function (d) { BUSY[d] = 1; }); $$('[data-dp]').forEach(function (dp) { if (dp._render) dp._render(); }); }).catch(function () {});
  $$('[data-dp]').forEach(function (dp) {
    var inp = $('input', dp), btn = $('.dd-btn', dp), pop = $('.dp-pop', dp), label = $('span', btn);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var view = new Date(today.getFullYear(), today.getMonth(), 1);
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function render() {
      var y = view.getFullYear(), m = view.getMonth(), first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
      var canPrev = new Date(y, m, 1) > new Date(today.getFullYear(), today.getMonth(), 1);
      var h = '<div class="dp-head"><button type="button" class="dp-nav" data-m="-1" aria-label="Previous month"' + (canPrev ? '' : ' disabled') + '>‹</button><b>' + MONTHS[m] + ' ' + y + '</b><button type="button" class="dp-nav" data-m="1" aria-label="Next month">›</button></div><div class="dp-grid" role="grid">';
      ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach(function (d) { h += '<span class="dp-dow">' + d + '</span>'; });
      for (var i = 0; i < first; i++) h += '<span></span>';
      for (var d = 1; d <= days; d++) {
        var dt = new Date(y, m, d), v = iso(dt), past = dt < today, busy = !past && BUSY[v];
        h += '<button type="button" class="dp-day' + (v === iso(today) ? ' today' : '') + (v === inp.value ? ' on' : '') + (busy ? ' busy' : '') + '" data-d="' + v + '"' + (past || busy ? ' disabled' : '') + ' aria-label="' + d + ' ' + MONTHS[m] + ' ' + y + (busy ? ', fully booked' : '') + '"' + (busy ? ' title="Fully booked"' : '') + '>' + d + '</button>';
      }
      h += '</div><div class="dp-foot"><button type="button" class="dp-flex">Flexible / not sure</button></div>';
      pop.innerHTML = h;
    }
    dp._render = function () { if (!pop.hidden) render(); };
    dp._set = function (v) { set(v); };
    function set(v) {
      inp.value = v; dp.classList.toggle('has', !!v);
      label.textContent = v ? new Date(v + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : 'Choose a date';
    }
    btn.addEventListener('click', function () {
      if (!pop.hidden) { closeAllPops(); return; }
      closeAllPops(pop); if (inp.value) { var c = new Date(inp.value + 'T12:00'); view = new Date(c.getFullYear(), c.getMonth(), 1); }
      render(); pop.hidden = false; dp.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
      var f = $('.dp-day.on', pop) || $('.dp-day.today:not([disabled])', pop) || $('.dp-day:not([disabled])', pop); if (f) f.focus();
    });
    pop.addEventListener('click', function (e) {
      var n = e.target.closest('[data-m]'), d = e.target.closest('[data-d]');
      if (n) { view = new Date(view.getFullYear(), view.getMonth() + (+n.getAttribute('data-m')), 1); render(); return; }
      if (d) { set(d.getAttribute('data-d')); closeAllPops(); btn.focus(); return; }
      if (e.target.closest('.dp-flex')) { set(''); closeAllPops(); btn.focus(); }
    });
    pop.addEventListener('keydown', function (e) {
      var days = $$('.dp-day:not([disabled])', pop), i = days.indexOf(document.activeElement), k = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
      if (k && i > -1) { e.preventDefault(); var t = days[i + k]; if (t) t.focus(); }
    });
  });


  /* ---------- reviews: a slow row that moves by itself, stops when you touch it ---------- */
  $$('[data-revs]').forEach(function (box) {
    var vp = $('.revs-vp', box), track = $('.revs-track', box), pauseBtn = $('[data-rv-pause]', box);
    var orig = $$('.rev', track); if (!orig.length) return;

    orig.forEach(function (c) { var k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); k.classList.add('clone'); track.appendChild(k); });
    var userPaused = reduce, hold = false, last = 0, inView = false, resume = 0, pos = 0;
    function half() { return track.scrollWidth / 2; }
    function setPaused(p) { userPaused = p; pauseBtn.setAttribute('aria-pressed', String(p)); $('span', pauseBtn).textContent = p ? 'Play' : 'Pause'; box.classList.toggle('paused', p); }
    setPaused(reduce);
    function tick(now) {
      var dt = last ? Math.min(64, now - last) : 16; last = now;
      if (!userPaused && !hold && inView) { pos = vp.scrollLeft + dt * 0.022; if (pos >= half()) pos -= half(); vp.scrollLeft = pos; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    function holdFor(ms) { hold = true; clearTimeout(resume); resume = setTimeout(function () { hold = false; }, ms); }
    ['pointerenter', 'focusin', 'touchstart', 'wheel'].forEach(function (ev) { vp.addEventListener(ev, function () { hold = true; clearTimeout(resume); }, { passive: true }); });
    ['pointerleave', 'focusout', 'touchend'].forEach(function (ev) { vp.addEventListener(ev, function () { holdFor(2500); }, { passive: true }); });
    vp.addEventListener('scroll', function () { if (vp.scrollLeft >= half()) vp.scrollLeft -= half(); }, { passive: true });
    $$('[data-rv]', box).forEach(function (b) { b.addEventListener('click', function () { holdFor(4000); var w = orig[0].getBoundingClientRect().width + 20; vp.scrollBy({ left: w * (+b.getAttribute('data-rv')), behavior: reduce ? 'auto' : 'smooth' }); }); });
    pauseBtn.addEventListener('click', function () { setPaused(!userPaused); });
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }).observe(box);
  });

  /* ---------- phones: long lists (tour cards, places, reasons...) become a swipe row with a progress bar ---------- */
  $$('.cards, .dest, .why, .tiles, .signs').forEach(function (el) {
    if (el.children.length < 3 || el.closest('.jr')) return;
    el.classList.add('hs');
    var bar = document.createElement('div'); bar.className = 'hs-bar'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<i></i><span></span>';
    el.parentNode.insertBefore(bar, el.nextSibling);
    var fill = $('i', bar), num = $('span', bar), n = el.children.length, raf = 0;
    function upd() {
      raf = 0; var max = el.scrollWidth - el.clientWidth; if (max <= 2) { bar.style.display = 'none'; return; } bar.style.display = '';
      var vis = el.clientWidth / el.scrollWidth, pos = el.scrollLeft / max;
      fill.style.setProperty('--w', (vis * 100).toFixed(1) + '%'); fill.style.setProperty('--x', (pos * (1 / vis - 1) * 100).toFixed(1) + '%');
      var k = Math.min(n, Math.round(pos * (n - 1)) + 1); num.textContent = k + ' / ' + n;
    }
    el.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    addEventListener('resize', upd); upd();
  });

  /* ---------- tours: the category bar lights up the section you are reading ---------- */
  $$('[data-spy]').forEach(function (bar) {
    var links = $$('a', bar), secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    function onScroll() {
      var y = innerHeight * .35, cur = -1;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < y) cur = i; });
      links.forEach(function (a, i) { var on = i === cur; if (on !== a.classList.contains('on')) { a.classList.toggle('on', on); if (on && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' }); } });
      bar.parentNode.classList.toggle('stuck', bar.getBoundingClientRect().top <= 80);
    }
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  });

  /* ---------- carved copper beside "Featured tours": cut in as you scroll down, gone when you leave ---------- */
  $$('[data-carve]').forEach(function (sec) {
    var paths = $$('.carve .eg', sec), dots = $$('.carve .dot', sec), raf = 0;
    var ys = paths.map(function (p) { try { var b = p.getBBox(); return (b.y + b.height / 2) / 820; } catch (e) { return .5; } });
    function upd() {
      raf = 0;
      var r = sec.getBoundingClientRect(), vh = innerHeight;
      var enter = Math.max(0, Math.min(1, (vh - r.top) / (vh * .85))), leave = Math.max(0, Math.min(1, r.bottom / (vh * .85)));
      var a = reduce ? 1 : Math.min(enter, leave);
      sec.style.setProperty('--carve', a.toFixed(3));
      paths.forEach(function (p, i) { var k = Math.max(0, Math.min(1, (a - ys[i] * .45) / .55)); p.style.strokeDashoffset = (1 - k).toFixed(3); });
      dots.forEach(function (d) { var y = +d.style.getPropertyValue('--y') || .5; d.style.opacity = a > y * .45 + .4 ? 1 : 0; });
    }
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    addEventListener('resize', upd); upd();
  });


  /* ---------- Bosnian coffee: tap and the džezva tips forward and pours into the fildžan ---------- */
  $$('[data-coffee]').forEach(function (box) {
    var dz = $('.cf-dz', box), sh = $('.cf-dzsh', box), stream = $('.cf-stream', box), lvl = $('.cf-lvl', box), surf = $('.cf-surf', box), bub = $('.cf-bub', box), btn = $('[data-pour]', box), lbl = $('.cf-lbl', btn);
    var TIP = [43, -99], CUP = 303, REST = { x: 150, y: 276, a: 0 }, LIFT = { x: 172, y: 214, a: 8 }, busy = false, level = 0;
    function rot(p, a) { var r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
    var POUR = (function () { var a = 58, t = rot(TIP, a); return { x: 297 - t[0], y: 158 - t[1], a: a }; })();
    function mix(A, B, t) { return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, a: A.a + (B.a - A.a) * t }; }
    function ez(t) { t = Math.max(0, Math.min(1, t)); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function place(s, lift) { dz.setAttribute('transform', 'translate(' + s.x.toFixed(2) + ' ' + s.y.toFixed(2) + ') rotate(' + s.a.toFixed(2) + ')'); sh.style.opacity = Math.max(0, 1 - lift * 3); }
    function setLevel(v) { level = v; lvl.setAttribute('transform', 'translate(0 ' + (5.5 * (1 - v)).toFixed(2) + ')'); lvl.style.opacity = Math.min(1, v * 5); surf.style.opacity = Math.max(0, Math.min(1, (v - .35) * 2)); bub.style.opacity = Math.max(0, Math.min(1, (v - .6) * 2.5)); }
    function drawStream(s, head, tail, now) {
      if (head <= tail) { stream.style.opacity = 0; return; }
      var t = rot(TIP, s.a), x0 = s.x + t[0], y0 = s.y + t[1], y1 = 230 - level * 5;
      stream.setAttribute('d', 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' Q' + (x0 + 15).toFixed(1) + ' ' + (y0 + 5).toFixed(1) + ' ' + (CUP - 1) + ' ' + y1.toFixed(1));
      var L = stream.getTotalLength();
      stream.style.strokeDasharray = ((head - tail) * L).toFixed(1) + ' ' + (L * 2).toFixed(1);
      stream.style.strokeDashoffset = (-tail * L).toFixed(1);
      stream.style.strokeWidth = (3.8 + Math.sin(now / 70) * .45).toFixed(2);
      stream.style.opacity = 1;
    }
    place(REST, 0); setLevel(0);
    function pour() {
      if (busy) return; busy = true; btn.disabled = true; lbl.textContent = 'Pouring…'; box.classList.remove('full'); box.classList.add('pouring');
      if (reduce) { setLevel(1); done(); return; }
      var start = level, t0 = performance.now();
      // the last cup is drunk first
      if (start > 0) { var e0 = performance.now(); (function drain(now) { var k = Math.min(1, (now - e0) / 500); setLevel(start * (1 - k)); if (k < 1) requestAnimationFrame(drain); else { t0 = performance.now(); requestAnimationFrame(frame); } })(e0); }
      else requestAnimationFrame(frame);
      function frame(now) {
        var t = now - t0, s, lift;
        if (t < 800) { s = mix(REST, LIFT, ez(t / 800)); lift = t / 800; }
        else if (t < 1500) { s = mix(LIFT, POUR, ez((t - 800) / 700)); lift = 1; }
        else if (t < 3900) { s = { x: POUR.x, y: POUR.y, a: POUR.a + 8 * ez((t - 1500) / 2400) }; lift = 1; }
        else if (t < 4450) { var k = ez((t - 3900) / 550); s = mix({ x: POUR.x, y: POUR.y, a: POUR.a + 8 }, LIFT, k); lift = 1; }
        else { s = mix(LIFT, REST, ez((t - 4450) / 900)); lift = 1 - Math.min(1, (t - 4450) / 900); }
        place(s, lift);
        // the stream: the head runs down from the spout, the tail follows when the džezva lifts back
        var head = Math.max(0, Math.min(1, (t - 1250) / 260)), tail = Math.max(0, Math.min(1, (t - 3930) / 320));
        if (t > 1400) setLevel(Math.min(1, ez((t - 1400) / 2550)));
        drawStream(s, head, tail, now);
        if (t < 5350) requestAnimationFrame(frame); else done();
      }
    }
    function done() { busy = false; btn.disabled = false; lbl.textContent = 'Pour another'; box.classList.remove('pouring'); box.classList.add('full'); stream.style.opacity = 0; place(REST, 0); }
    btn.addEventListener('click', pour);
    $('svg', box).addEventListener('click', pour);
  });

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
    tk.addEventListener('change', function () { var n = $$('[name=tickets]:checked', f).length; $('.tk-n', f).textContent = n ? n + ' added' : ''; });
    // two steps: tour and date first, then tickets and contact details
    function goStep(n) {
      $$('.fstep', f).forEach(function (st) { st.hidden = st.getAttribute('data-fstep') !== String(n); });
      $$('.fsteps li', f).forEach(function (li) { var k = +li.getAttribute('data-goto'); li.classList.toggle('on', k === n); li.classList.toggle('ok', k < n); });
      if (n === 2) {
        var t = tourBy(sel.value), dv = val('date'), tm = val('time');
        $('.fsum-txt', f).textContent = (t ? t.name.split(' – ')[0] : 'Custom request') + ' · ' + (dv ? new Date(dv + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'date flexible') + (tm ? ', ' + tm.toLowerCase() : '') + ' · ' + cnt.adults + ' adult' + (cnt.adults > 1 ? 's' : '') + (cnt.children ? ', ' + cnt.children + ' child' + (cnt.children > 1 ? 'ren' : '') : '');
        var nm = f.elements.name; if (nm && !nm.value && innerWidth > 900) nm.focus({ preventScroll: true });
      }
      var card = wrap.closest('.enq-card') || wrap; var r = card.getBoundingClientRect(); if (r.top < 70 || r.top > innerHeight * .6) card.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      fitAside();
    }
    $$('[data-next]', f).forEach(function (b) { b.addEventListener('click', function () { goStep(2); }); });
    $$('[data-back]', f).forEach(function (b) { b.addEventListener('click', function () { goStep(1); }); });
    $$('.fsteps li', f).forEach(function (li) { li.addEventListener('click', function () { goStep(+li.getAttribute('data-goto')); }); });
    // a sticky form must fit on the screen, otherwise it scrolls with the page
    function fitAside() { var a = wrap.closest('.aside'); if (!a) return; a.classList.toggle('tall', (a.firstElementChild || a).offsetHeight > innerHeight - 110); }
    addEventListener('resize', fitAside); setTimeout(fitAside, 300);
    wrap._goStep = goStep;
    function val(n) { var el = f.elements[n]; return el ? String(el.value || '').trim() : ''; }
    function collect() {
      var t = tourBy(sel.value);
      var tickets = $$('[name=tickets]:checked', f).map(function (c) { var x = TICKETS.filter(function (k) { return k.id === c.value; })[0]; return x.label + ' (€' + x.price + ' pp)'; });
      return { tour: t ? t.name : 'Not sure yet / custom request', tourSlug: sel.value, date: val('date'), time: val('time'), adults: cnt.adults, children: cnt.children, ages: val('ages'), name: val('name'), email: val('email'), phone: val('phone'), message: val('message'), tickets: tickets, website: val('website') };
    }
    function check(d) {
      $$('.err', f).forEach(function (e) { e.classList.remove('err'); });
      var bad = [];
      if (!d.name) bad.push('name');
      if (!d.email && !d.phone) bad.push('email', 'phone');
      if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) bad.push('email');
      bad.forEach(function (n) { f.elements[n] && f.elements[n].classList.add('err'); });
      $('.formerr', f).textContent = bad.length ? 'Please add your name and an email address or WhatsApp number.' : '';
      if (bad.length && wrap._goStep) wrap._goStep(2);
      return !bad.length;
    }
    function message(d) {
      var date = d.date ? new Date(d.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'flexible';
      var L = ['Hello Mirna, I would like to enquire about:', '• Tour: ' + d.tour, '• Preferred date: ' + date + (d.time ? ', ' + d.time.toLowerCase() : ''), '• Guests: ' + d.adults + ' adult' + (d.adults > 1 ? 's' : '') + (d.children ? ', ' + d.children + ' child' + (d.children > 1 ? 'ren' : '') + (d.ages ? ' (ages ' + d.ages + ')' : '') : '')];
      if (d.tickets.length) L.push('• Include tickets: ' + d.tickets.join(', '));
      if (d.message) L.push('• Message: ' + d.message);
      L.push('', d.name + (d.email ? ' · ' + d.email : '') + (d.phone ? ' · ' + d.phone : ''));
      return L.join('\n');
    }
    function finish(how) { wrap.classList.add('sent'); $('.done-how', wrap).textContent = how; wrap.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }
    $('[data-send=wa]', f).addEventListener('click', function () {
      var d = collect(); if (!check(d)) return;
      track('enquiry_whatsapp', { tour: d.tourSlug });
      try { fetch('/api/enquiry', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ channel: 'whatsapp' }, d)) }).catch(function () {}); } catch (e) {} // a copy for Mirna's planner
      window.open('https://wa.me/' + D.whatsapp + '?text=' + encodeURIComponent(message(d)), '_blank', 'noopener');
      finish('Your message is ready in WhatsApp. Press send there and Mirna will reply personally.');
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var d = collect(); if (!check(d)) return;
      if (d.website) return; // honeypot
      var btn = $('[type=submit]', f); btn.disabled = true; btn.textContent = 'Sending…';
      fetch('/api/enquiry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ channel: 'email' }, d)) })
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
    $('[data-again]', wrap).addEventListener('click', function () { wrap.classList.remove('sent'); goStep(1); });
  });

  // pre-select a tour from ?tour= on the contact page
  (function () { var p = new URLSearchParams(location.search).get('tour'); var s = $('[data-enq] [name=tour]'); if (p && s && tourBy(p)) { s.value = p; s.dispatchEvent(new Event('change')); } })();
  /* ---------- /pay/: online payment (Monri). The server signs the amount; card details only on Monri's page. ---------- */
  (function () {
    var box = $('[data-pay]'); if (!box) return;
    var form = $('.pay-form', box), err = $('.formerr', box), btn = $('.pay-btn', box), btnTxt = $('.pay-btn span', box), amt = $('[name=amount]', box);
    var testBox = $('.pay-test', box), res = $('.pay-res', box), modeBox = $('.pay-mode', box), tsBox = $('.ts', box);
    var C = { mode: 'off', currency: 'EUR', symbol: '€', min: 10, max: 1000 }, busy = false, tsToken = '';
    var q = new URLSearchParams(location.search);
    function money(n) { n = Number(n) || 0; var t = n % 1 ? n.toFixed(2) : String(n); return C.currency === 'EUR' ? '€' + t : t + ' KM'; }
    function val() { var v = String(amt.value || '').replace(/[^\d.,]/g, '').replace(',', '.'); var n = parseFloat(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
    function label() { var n = val(); btnTxt.textContent = n ? 'Pay ' + money(n) + ' securely' : 'Pay securely'; }
    function show(el) { [form, testBox, res].forEach(function (x) { x.hidden = x !== el; }); box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
    function keyFor(o) { try { return sessionStorage.getItem('mly-pay-' + o) || ''; } catch (e) { return ''; } }
    function result(kind, title, text, again) {
      res.className = 'pay-res ' + kind;
      res.innerHTML = '<div class="pr-ic">' + (kind === 'ok' ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' : kind === 'wait' ? '<span class="spin"></span>' : '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>') + '</div><h3></h3><p class="pr-t"></p>' + (again ? '<p><button type="button" class="btn line" data-again>Try again</button></p>' : '') + '<p class="pr-help">Questions? <a href="https://wa.me/' + (D.whatsapp || '') + '">WhatsApp Mirna</a></p>';
      $('h3', res).textContent = title; $('.pr-t', res).textContent = text;
      var a = $('[data-again]', res); if (a) a.addEventListener('click', function () { history.replaceState(null, '', location.pathname); show(form); });
      show(res);
    }
    // after Monri sends the guest back: the server decides, from Monri's signed callback, whether it is paid
    function poll(order, tries) {
      var k = keyFor(order);
      if (!k) { result('wait', 'Thank you', 'If your payment went through, you will get a receipt by email and Mirna will see it straight away.'); return; }
      fetch('/api/pay/status?o=' + encodeURIComponent(order) + '&k=' + encodeURIComponent(k)).then(function (r) { return r.json(); }).then(function (j) {
        if (j.status === 'paid') { track('payment_done', { value: j.amount, currency: j.currency }); result('ok', 'Thank you' + (j.name ? ', ' + j.name.split(' ')[0] : '') + '!', money(j.amount) + ' received' + (j.tour ? ' for ' + j.tour : '') + (j.date ? ', ' + new Date(j.date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '') + '. A receipt is on its way to your email and Mirna will be in touch.'); }
        else if (j.status === 'failed') result('bad', 'The payment did not go through', 'No money was taken. You can try again or use another card.', true);
        else if (tries > 0) { result('wait', 'Confirming your payment…', 'This takes a few seconds. Please keep this page open.'); setTimeout(function () { poll(order, tries - 1); }, 2500); }
        else result('wait', 'Payment received, confirmation pending', 'Your bank has not confirmed it yet. You will get a receipt by email, and Mirna will confirm your tour. No need to pay again.');
      }).catch(function () { result('wait', 'Thank you', 'If your payment went through, you will get a receipt by email.'); });
    }
    fetch('/api/pay/config').then(function (r) { return r.json(); }).catch(function () { return C; }).then(function (c) {
      C = c || C; $$('[data-sym]', box).forEach(function (x) { x.textContent = C.symbol; });
      $('.amt-hint', box).textContent = 'Between ' + money(C.min) + ' and ' + money(C.max) + '.';
      if (C.mode === 'off') { modeBox.hidden = false; modeBox.className = 'pay-mode off'; modeBox.textContent = 'Online payment is being set up. Until then, Mirna will tell you how to pay.'; btn.disabled = true; }
      if (C.mode === 'test') { modeBox.hidden = false; modeBox.className = 'pay-mode test'; modeBox.textContent = 'Test mode: no real card is charged.'; }
      if (C.turnstile && C.mode !== 'off') {
        tsBox.hidden = false; window.mlyTs = function () { window.turnstile.render(tsBox, { sitekey: C.turnstile, callback: function (t) { tsToken = t; }, 'expired-callback': function () { tsToken = ''; } }); };
        var s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=mlyTs&render=explicit'; s.async = true; document.head.appendChild(s);
      }
      if (q.get('done')) poll(q.get('done'), 8);
      else if (q.get('cancel')) result('bad', 'Payment cancelled', 'No money was taken. You can try again whenever you are ready.', true);
    });
    // prefill from the link Mirna sends (?amount=25&tour=slug&date=2026-11-16)
    if (q.get('amount')) amt.value = String(q.get('amount')).replace(/[^\d.,]/g, '').slice(0, 8);
    if (q.get('tour')) { var ts = $('[name=tour]', box); if (ts && ts.querySelector('option[value="' + q.get('tour').replace(/[^a-z0-9-]/g, '') + '"]')) { ts.value = q.get('tour'); ts.dispatchEvent(new Event('change')); } }
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('date') || '')) { var dp = $('[data-dp]', box); if (dp && dp._set) dp._set(q.get('date')); }
    label();
    amt.addEventListener('input', function () { var c = amt.value.replace(/[^\d.,]/g, ''); if (c !== amt.value) amt.value = c; label(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); if (busy || C.mode === 'off') return;
      var f = form.elements, n = val(), email = String(f.email.value).trim();
      var problem = !n || n < C.min || n > C.max ? 'Please enter an amount between ' + money(C.min) + ' and ' + money(C.max) + '.' : String(f.name.value).trim().length < 2 ? 'Please enter your name.' : !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) ? 'Please enter a valid email address.' : !f.agree.checked ? 'Please accept the booking and cancellation terms.' : C.turnstile && !tsToken ? 'Please confirm you are not a robot.' : '';
      if (problem) { err.textContent = problem; return; }
      err.textContent = ''; busy = true; btn.disabled = true; btnTxt.textContent = 'One moment…';
      var sel = f.tour, tName = sel.value ? sel.options[sel.selectedIndex].textContent : '';
      fetch('/api/pay/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amount: n, name: f.name.value, email: email, tourSlug: sel.value, tour: tName, date: f.date.value, agree: true, website: f.website.value, turnstile: tsToken }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.'); return j; }); })
        .then(function (j) {
          try { sessionStorage.setItem('mly-pay-' + j.order, j.key); } catch (er) {}
          track('payment_start', { value: n, currency: C.currency });
          if (j.mode === 'test') { testBox.dataset.order = j.order; testBox.dataset.key = j.key; $('.pt-sum', testBox).textContent = money(n) + (tName ? ' · ' + tName : '') + ' · ' + f.name.value; show(testBox); busy = false; btn.disabled = false; label(); return; }
          // live: post the signed form to Monri
          var mf = document.createElement('form'); mf.method = 'POST'; mf.action = j.form.action; mf.style.display = 'none';
          Object.keys(j.form.fields).forEach(function (k) { var i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = j.form.fields[k]; mf.appendChild(i); });
          document.body.appendChild(mf); mf.submit();
        })
        .catch(function (er) { err.textContent = er.message; busy = false; btn.disabled = false; label(); if (window.turnstile && C.turnstile) { try { window.turnstile.reset(tsBox); tsToken = ''; } catch (x) {} } });
    });
    $$('[data-pt]', testBox).forEach(function (b) { b.addEventListener('click', function () {
      var ok = b.getAttribute('data-pt') === '1', o = testBox.dataset.order; b.disabled = true;
      fetch('/api/pay/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order: o, key: testBox.dataset.key, ok: ok }) }).then(function () {
        b.disabled = false; history.replaceState(null, '', location.pathname + (ok ? '?done=' : '?cancel=') + o); if (ok) poll(o, 3); else result('bad', 'Payment declined (test)', 'No money was taken. You can try again.', true);
      });
    }); });
  })();
})();
