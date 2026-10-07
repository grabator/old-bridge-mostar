/*
 * Mostar: filmsko skrolanje. Scena je "zalijepljena", a pomak skrola pokreće slojeve.
 * Transformacije se upisuju direktno na svaki sloj (ne preko CSS varijabli na roditelju),
 * da preglednik ne mora pri svakom pomaku preračunavati stotine SVG elemenata.
 */
(function () {
  'use strict';
  var TXT = window.MOSTAR_TEXT, ART = window.MOSTAR_ART;
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var LANGS = ['en', 'bs', 'de'];

  /* ---------------- jezik ---------------- */
  var lang = (function () {
    var q = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1], saved = null;
    try { saved = localStorage.getItem('mostar-lang'); } catch (e) { /* privatni mod */ }
    var nav = (navigator.language || '').slice(0, 2).toLowerCase();
    if (nav === 'hr' || nav === 'sr') nav = 'bs';
    return [q, saved, nav].filter(function (l) { return l && LANGS.indexOf(l) > -1; })[0] || 'en';
  })();
  function get(o, path) { return path.split('.').reduce(function (x, k) { return x == null ? x : x[k]; }, o); }
  function t(key) { var v = get(TXT[lang], key); return v == null ? get(TXT.en, key) : v; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------------- crteži ---------------- */
  document.querySelectorAll('[data-art]').forEach(function (el) { el.innerHTML = ART[el.getAttribute('data-art')](); });
  var $ = function (s) { return document.querySelector(s); };
  var film = $('#film'), stage = $('#stage'), bar = $('#bar');
  var L = {
    sky: $('.sky'), mount: $('.mount'), town: $('.town'), title: $('.title'), bridge: $('.bridge'), river: $('.river'),
    cl: $('.cliff-l'), cr: $('.cliff-r'), veil: $('.veil'), intro: $('.intro'), cue: $('.cue'),
    pBridge: $('.p-bridge'), pRiver: $('.p-river'), pTown: $('.p-town'), places: $('.places'),
    diver: document.getElementById('diver'), splash: document.getElementById('splash')
  };

  /* poglavlja: na kojem pikselu skrola (unutar filma) počinju */
  var AT = { intro: 0, bridge: 1180, river: 1980, town: 2700, places: 3640 };
  var CH = ['intro', 'bridge', 'river', 'town', 'places'];

  /* ---------------- tekstovi ---------------- */
  function renderText() {
    root.lang = lang;
    document.title = t('docTitle');
    var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', t('docDesc'));
    document.querySelector('.skip').textContent = t('skip');
    document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = t(el.getAttribute('data-t')); });
    document.querySelectorAll('[data-t-label]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-t-label'))); });
    document.querySelector('.lang').setAttribute('aria-label', t('lang'));
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    $('[data-list="tags"]').innerHTML = t('tags').map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    $('[data-list="facts"]').innerHTML = t('facts').map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('');
    $('[data-list="plan"]').innerHTML = t('plan').map(function (p) { return '<li class="reveal"><b>' + esc(p[0]) + '</b><span><strong>' + esc(p[1]) + '</strong><span>' + esc(p[2]) + '</span></span></li>'; }).join('');
    $('[data-list="info"]').innerHTML = t('info').map(function (p) { return '<div class="reveal"><dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd></div>'; }).join('');
    var names = { intro: t('nav.intro'), bridge: t('nav.bridge'), river: t('riverS'), town: t('nav.town'), places: t('nav.places') };
    $('.rail').innerHTML = CH.map(function (c) { return '<li><button type="button" data-at="' + c + '"><span>' + esc(names[c]) + '</span><i></i></button></li>'; }).join('');
    buildPlaces();
    reveal();
    activeLinks(true);
  }

  /* ---------------- mjesta: beskonačno listanje ---------------- */
  var track = $('#track'), count = 0, idx = 0;
  function cardHtml(p, i) {
    var maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.q);
    return '<article class="card" data-i="' + i + '" tabindex="0" aria-label="' + esc(p.h) + '">' + ART.icon(p.icon) +
      '<p class="k">' + esc(p.k) + '</p><h3>' + esc(p.h) + '</h3><p>' + esc(p.p) + '</p>' +
      '<a class="go" href="' + esc(maps) + '" target="_blank" rel="noopener" tabindex="-1">' + esc(t('open')) + ' ↗</a></article>';
  }
  function buildPlaces() {
    var list = t('places'); count = list.length;
    var html = '';
    for (var set = 0; set < 3; set++) list.forEach(function (p, i) { html += cardHtml(p, set * count + i); });
    track.innerHTML = html;
    idx = count;
    jump(idx);
  }
  function stepW() { var c = track.children[0]; return c ? c.offsetWidth + parseFloat(getComputedStyle(track).columnGap || 16) : 0; }
  function paint() {
    track.style.transform = 'translate3d(' + (-idx * stepW()).toFixed(1) + 'px,0,0)';
    [].forEach.call(track.children, function (c, i) {
      var on = i === idx;
      c.classList.toggle('on', on);
      var a = c.querySelector('.go'); if (a) a.tabIndex = on ? 0 : -1;
    });
  }
  function jump(i) { track.classList.add('jump'); idx = i; paint(); requestAnimationFrame(function () { requestAnimationFrame(function () { track.classList.remove('jump'); }); }); }
  function go(i) { idx = i; paint(); if (reduced.matches) normalize(); }
  function normalize() { if (idx >= count * 2) jump(idx - count); else if (idx < count) jump(idx + count); }
  track.addEventListener('transitionend', function (e) { if (e.target === track) normalize(); });

  /* ---------------- matematika ---------------- */
  function clamp(v, a, b) { return Math.min(b == null ? 1 : b, Math.max(a == null ? 0 : a, v)); }
  function ss(a, b, v) { var x = clamp((v - a) / (b - a)); return x * x * (3 - 2 * x); }
  function seg(v, a, b, c, d) { var i = ss(a, b, v), o = ss(c, d, v); return { i: i, o: o, on: i * (1 - o) }; }
  function lerp(a, b, k) { return a + (b - a) * k; }

  var target = 0, smooth = 0, mx = 0, my = 0, tmx = 0, tmy = 0, ready = false, pending = false, vh = window.innerHeight, filmTop = 0, filmLen = 1;
  function measure() { vh = window.innerHeight; filmTop = film.getBoundingClientRect().top + window.scrollY; filmLen = Math.max(1, film.offsetHeight - vh); }
  function tf(el, s) { if (el.__t !== s) { el.__t = s; el.style.transform = s; } }
  function op(el, v) { var s = v.toFixed(3); if (el.__o !== s) { el.__o = s; el.style.opacity = s; } }

  function frame() {
    pending = false;
    target = clamp(window.scrollY - filmTop, 0, filmLen);
    if (!ready || reduced.matches) { smooth = target; ready = true; }
    else smooth = lerp(smooth, target, 0.16);
    if (Math.abs(smooth - target) < 0.1) smooth = target;
    var still = reduced.matches;
    mx = still ? 0 : lerp(mx, tmx, 0.1); my = still ? 0 : lerp(my, tmy, 0.1);

    var s = smooth, prog = clamp(s / 3800);
    var introOut = ss(60, 620, s);
    var push = ss(380, 1080, s);
    var dive = ss(1060, 1560, s);
    var pB = seg(s, 760, 1040, 1520, 1760);
    var out = ss(1520, 1820, s);
    var rv = seg(s, 1680, 1960, 2380, 2700);
    var pR = seg(s, 1880, 2060, 2280, 2480);
    var townIn = ss(2380, 2820, s);
    var pT = seg(s, 2560, 2860, 3260, 3480);
    var pl = Math.pow(ss(3380, 3900, s), 1.3);

    var vw = window.innerWidth / 100, vhp = vh / 100;
    tf(L.sky, 'translate3d(' + (mx * -10).toFixed(1) + 'px,' + (prog * -24 + my * -6).toFixed(1) + 'px,0) scale(' + (1.04 + prog * 0.06).toFixed(4) + ')');
    tf(L.mount, 'translate3d(' + (mx * -16).toFixed(1) + 'px,' + (push * 26 - townIn * 20 + my * -5).toFixed(1) + 'px,0) scale(' + (1 + push * 0.08 + townIn * 0.08).toFixed(4) + ')');
    tf(L.town, 'translate3d(' + (mx * -24).toFixed(1) + 'px,' + (push * 18 - townIn * 50 + my * -6).toFixed(1) + 'px,0) scale(' + (1 + push * 0.18 + townIn * 0.34).toFixed(4) + ')');
    tf(L.title, 'translate3d(' + (mx * -14).toFixed(1) + 'px,' + (introOut * -170).toFixed(1) + 'px,0) scale(' + (1 - introOut * 0.07).toFixed(4) + ')');
    op(L.title, 1 - introOut);
    tf(L.bridge, 'translate3d(' + (mx * 20).toFixed(1) + 'px,' + (my * 8 - out * 100 * vhp).toFixed(1) + 'px,0) scale(' + (0.74 + push * 0.66 + out * 0.5).toFixed(4) + ')');
    op(L.bridge, 1 - ss(0.4, 0.85, out));
    var part = Math.pow(push, 1.35);
    tf(L.cl, 'translate3d(' + (-(16 + part * 44) * vw + mx * 28).toFixed(1) + 'px,' + (my * 10 - part * 8 * vhp).toFixed(1) + 'px,0) scale(' + (0.92 + push * 0.6).toFixed(4) + ')');
    tf(L.cr, 'translate3d(' + ((16 + part * 44) * vw + mx * 28).toFixed(1) + 'px,' + (my * 10 - part * 8 * vhp).toFixed(1) + 'px,0) scale(' + (0.92 + push * 0.6).toFixed(4) + ')');
    op(L.river, rv.on);
    tf(L.river, 'translate3d(' + (mx * 12).toFixed(1) + 'px,' + (my * 8 - rv.o * 120).toFixed(1) + 'px,0) scale(' + (1.12 - rv.i * 0.08 + rv.o * 0.06).toFixed(4) + ')');
    op(L.veil, Math.max(pB.on * 0.6, pR.on * 0.3, pT.on * 0.55, pl * 0.5));
    tf(L.intro, 'translate3d(0,' + (introOut * 80).toFixed(1) + 'px,0)'); op(L.intro, 1 - introOut);
    op(L.cue, 0.8 * (1 - ss(20, 220, s)));

    panel(L.pBridge, pB); panel(L.pRiver, pR); panel(L.pTown, pT);

    /* skakač sa mosta: mali odraz, pa salto u Neretvu */
    if (L.diver) {
      var hop = Math.sin(Math.PI * clamp(dive * 5)) * -18, fall = Math.pow(clamp((dive - 0.12) / 0.88), 2) * 455;
      L.diver.setAttribute('transform', 'translate(0 ' + (hop + fall).toFixed(1) + ') rotate(' + (ss(0.1, 0.9, dive) * 180).toFixed(1) + ' 800 315)');
      L.diver.style.opacity = dive > 0.96 ? '0' : '1';
      var splash = ss(0.92, 0.98, dive) * (1 - ss(1600, 1760, s));
      L.splash.setAttribute('opacity', splash.toFixed(2));
      L.splash.setAttribute('transform', 'translate(800 790) scale(' + (0.4 + ss(0.92, 1, dive) * 0.8 + ss(1560, 1760, s) * 0.5).toFixed(3) + ')');
    }

    /* mjesta */
    L.places.style.visibility = pl > 0.01 ? 'visible' : 'hidden';
    op(L.places, clamp(pl * 1.4));
    tf(L.places, 'translate3d(' + ((1 - pl) * 60 * vw).toFixed(1) + 'px,0,0)');
    L.places.classList.toggle('live', pl > 0.9);

    activeLinks();
    var moving = Math.abs(smooth - target) > 0.1 || Math.abs(mx - tmx) > 0.001 || Math.abs(my - tmy) > 0.001;
    if (moving) tick();
  }
  function panel(el, sg) {
    op(el, sg.on);
    tf(el, 'translate3d(-50%, calc(-50% + ' + (-sg.o * 80 + (1 - sg.i) * 60).toFixed(1) + 'px), 0)');
    el.classList.toggle('live', sg.on > 0.6);
  }
  function tick() { if (!pending) { pending = true; requestAnimationFrame(frame); } }

  /* aktivni link u traci i na šini */
  var lastCh = null;
  function activeLinks(force) {
    var y = window.scrollY - filmTop, ch = 'intro';
    CH.forEach(function (c) { if (y >= AT[c] - 200) ch = c; });
    var plan = document.getElementById('plan');
    if (plan.getBoundingClientRect().top < vh * 0.5) ch = 'plan';
    if (ch === lastCh && !force) return;
    lastCh = ch;
    document.querySelectorAll('.links a').forEach(function (a) {
      var at = a.getAttribute('data-at') || 'plan';
      a.classList.toggle('on', at === ch || (ch === 'river' && at === 'bridge'));
    });
    document.querySelectorAll('.rail button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-at') === ch); });
    bar.classList.toggle('solid', ch === 'plan' || window.scrollY > filmTop + filmLen - 10);
  }

  function goTo(at) {
    var y = at === '0' || at === 'intro' ? filmTop : filmTop + (AT[at] || 0);
    window.scrollTo({ top: y, behavior: reduced.matches ? 'auto' : 'smooth' });
  }

  /* ---------------- pojavljivanje u planu dana ---------------- */
  var obs = null;
  function reveal() {
    var els = document.querySelectorAll('.reveal');
    if (reduced.matches || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    if (obs) obs.disconnect();
    obs = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); obs.unobserve(x.target); } }); }, { threshold: 0.15 });
    els.forEach(function (e, i) { e.style.transitionDelay = (i % 5) * 70 + 'ms'; obs.observe(e); });
  }

  /* ---------------- događaji ---------------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (b) {
      lang = b.getAttribute('data-lang');
      try { localStorage.setItem('mostar-lang', lang); } catch (x) { /* privatni mod */ }
      renderText(); measure(); tick();
      return;
    }
    var a = e.target.closest('[data-at]');
    if (a) { e.preventDefault(); goTo(a.getAttribute('data-at')); return; }
    var st = e.target.closest('[data-step]');
    if (st) { go(idx + Number(st.getAttribute('data-step'))); return; }
    var c = e.target.closest('.card');
    if (c && !e.target.closest('.go')) { go(Number(c.getAttribute('data-i'))); }
  });
  document.addEventListener('keydown', function (e) {
    var c = e.target.closest && e.target.closest('.card');
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(Number(c.getAttribute('data-i'))); }
    if (L.places.classList.contains('live') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
      go(idx + (e.key === 'ArrowRight' ? 1 : -1));
    }
  });
  /* prevlačenje prstom po karticama */
  var x0 = null;
  track.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', function (e) {
    if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
  }, { passive: true });

  window.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('resize', function () { measure(); paint(); tick(); });
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', function (e) { tmx = e.clientX / window.innerWidth - 0.5; tmy = e.clientY / window.innerHeight - 0.5; tick(); }, { passive: true });
  }

  renderText();
  measure();
  tick();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); paint(); tick(); });
})();
