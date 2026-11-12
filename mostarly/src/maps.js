/* Mostarly Guide maps: a small globe that flies down to Bosnia and Herzegovina, a map of Herzegovina
   with the places Mirna visits, and an illustrated map of Mostar's Old Town. Route lines depend on the
   tour: river-stone "kaldrma" for walks, a dashed road with a moving car for drives. No libraries. */
(function () {
  'use strict';
  var D = {}; try { D = JSON.parse(document.getElementById('mly-data').textContent); } catch (e) {}
  var PLACES = {}; (D.places || []).forEach(function (p) { PLACES[p.id] = p; });
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var night = function () { return document.documentElement.classList.contains('is-night'); };
  var geoCache = {};
  function geo(name) { return geoCache[name] || (geoCache[name] = fetch('/geo/' + name + '.json').then(function (r) { return r.json(); })); }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function tween(ms, fn, done) { if (reduce || ms <= 0) { fn(1); if (done) done(); return; } var t0 = performance.now(); (function f(now) { var t = Math.min(1, (now - t0) / ms); fn(ease(t)); if (t < 1) requestAnimationFrame(f); else if (done) done(); })(t0); }

  /* ---------- projections ---------- */
  var REGION = { lon0: 17.9, lat0: 43.4, s: 600 };   // 1° latitude = 600 units
  var OLDTOWN = { lon0: 17.815, lat0: 43.3375, s: 60000 };
  function P(view) { var c = Math.cos(view.lat0 * Math.PI / 180); return function (lon, lat) { return [(lon - view.lon0) * c * view.s, (view.lat0 - lat) * view.s]; }; }
  var pr = P(REGION), po = P(OLDTOWN);
  function pathFrom(flat, proj, close) { var d = ''; for (var i = 0; i < flat.length; i += 2) { var p = proj(flat[i], flat[i + 1]); d += (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); } return d + (close ? 'Z' : ''); }
  function smooth(pts) { // Catmull-Rom through points -> cubic path
    if (pts.length < 3) return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L');
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) { var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2; d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ',' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ',' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1); }
    return d;
  }
  // rivers drawn as an illustration through known points on their course
  var NERETVA = [[17.76, 43.66], [17.79, 43.6], [17.84, 43.53], [17.86, 43.47], [17.835, 43.4], [17.812, 43.36], [17.8148, 43.3385], [17.815, 43.3369], [17.817, 43.32], [17.83, 43.27], [17.83, 43.24], [17.8, 43.2], [17.77, 43.16], [17.735, 43.13], [17.7, 43.11], [17.66, 43.07], [17.62, 43.04], [17.55, 43.03], [17.45, 43.02]];
  var BUNA = [[17.9036, 43.2573], [17.87, 43.25], [17.83, 43.245]];
  var TREBIZAT = [[17.5, 43.22], [17.56, 43.18], [17.6037, 43.1541], [17.65, 43.125], [17.7, 43.105]];
  var OT_RIVER = [[17.8151, 43.3405], [17.8147, 43.3388], [17.8146, 43.3378], [17.8149, 43.3369], [17.8154, 43.3355], [17.8158, 43.3345]];
  var OT_RADOBOLJA = [[17.8095, 43.3389], [17.8117, 43.3385], [17.8131, 43.3381], [17.8141, 43.3379], [17.8146, 43.3378]];
  var OT_STREETS = [
    [[17.8125, 43.3402], [17.8133, 43.3392], [17.8139, 43.338], [17.8143, 43.3372], [17.8146, 43.3362]],
    [[17.8155, 43.3369], [17.8159, 43.3374], [17.8161, 43.3381], [17.8163, 43.3392], [17.8165, 43.3402]],
    [[17.8175, 43.3345], [17.8176, 43.336], [17.8178, 43.3378], [17.818, 43.3405]],
    [[17.8105, 43.3352], [17.8112, 43.3368], [17.8118, 43.3385], [17.8124, 43.3404]],
    [[17.8159, 43.3374], [17.8168, 43.3373], [17.8177, 43.3372]]
  ];

  /* ---------- the map ---------- */
  function MapView(host, opt) {
    this.host = host; this.opt = opt; this.view = opt.view; this.sel = null;
    this.svg = el('svg', { class: 'mly-map ' + opt.view, role: 'img', 'aria-label': opt.label || 'Map', preserveAspectRatio: 'xMidYMid meet' }, host);
    this.gBase = el('g', { class: 'base' }, this.svg); this.gRoute = el('g', { class: 'route' }, this.svg); this.gPins = el('g', { class: 'pins' }, this.svg);
  }
  MapView.prototype.k = function () { var vb = this.vb || [0, 0, 1000, 700]; return vb[2] / 600; }; // pin scale follows zoom
  MapView.prototype.setVB = function (vb) { this.vb = vb; this.svg.setAttribute('viewBox', vb.map(function (n) { return n.toFixed(1); }).join(' ')); this.svg.style.setProperty('--k', this.k()); };
  MapView.prototype.fit = function (ids, pad, aspect) {
    var proj = this.view === 'oldtown' ? po : pr, xs = [], ys = [];
    ids.forEach(function (id) { var p = PLACES[id]; if (!p) return; var q = proj(p.lon, p.lat); xs.push(q[0]); ys.push(q[1]); });
    var x0 = Math.min.apply(0, xs), x1 = Math.max.apply(0, xs), y0 = Math.min.apply(0, ys), y1 = Math.max.apply(0, ys);
    var w = Math.max(x1 - x0, 1) , h = Math.max(y1 - y0, 1); pad = pad || .25; aspect = aspect || (this.host.clientWidth / Math.max(this.host.clientHeight, 1)) || 1.4;
    w *= 1 + pad * 2; h *= 1 + pad * 2; var minW = this.view === 'oldtown' ? 330 : 60; if (w < minW) w = minW;
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
  };
  MapView.prototype.zoom = function (to, ms, done) { var from = (this.vb || to).slice(), self = this; tween(ms, function (t) { self.setVB(from.map(function (v, i) { return v + (to[i] - v) * t; })); }, done); };
  MapView.prototype.drawBase = function (region) {
    var g = this.gBase, s;
    if (this.view === 'region') {
      el('rect', { x: -2000, y: -2000, width: 4000, height: 4000, class: 'sea' }, g);
      region.land.forEach(function (r) { el('path', { d: pathFrom(r, pr, true), class: 'land' }, g); });
      region.bih.forEach(function (r) { el('path', { d: pathFrom(r, pr, true), class: 'bih' }, g); });
      region.borders.forEach(function (r) { el('path', { d: pathFrom(r, pr, false), class: 'border' }, g); });
      [[NERETVA, 'river big'], [BUNA, 'river'], [TREBIZAT, 'river']].forEach(function (r) { el('path', { d: smooth(r[0].map(function (p) { return pr(p[0], p[1]); })), class: r[1] }, g); });
      s = pr(17.775, 43.5); var t = el('text', { x: s[0], y: s[1], class: 'rlabel', transform: 'rotate(-62 ' + s[0] + ' ' + s[1] + ')' }, g); t.textContent = 'Neretva';
      s = pr(17.35, 42.92); t = el('text', { x: s[0], y: s[1], class: 'sealabel' }, g); t.textContent = 'Adriatic Sea';
      s = pr(18.05, 43.62); t = el('text', { x: s[0], y: s[1], class: 'clabel' }, g); t.textContent = 'BOSNIA AND HERZEGOVINA';
    } else {
      el('rect', { x: -2000, y: -2000, width: 4000, height: 4000, class: 'ground' }, g);
      OT_STREETS.forEach(function (st) { el('path', { d: smooth(st.map(function (p) { return po(p[0], p[1]); })), class: 'street' }, g); });
      el('path', { d: smooth(OT_RIVER.map(function (p) { return po(p[0], p[1]); })), class: 'otriver' }, g);
      el('path', { d: smooth(OT_RIVER.map(function (p) { return po(p[0], p[1]); })), class: 'otriver-flow' }, g);
      el('path', { d: smooth(OT_RADOBOLJA.map(function (p) { return po(p[0], p[1]); })), class: 'otstream' }, g);
      var b = po(17.815, 43.3369), b2 = po(17.8154, 43.3369); // the Old Bridge across the river
      el('path', { d: 'M' + (b[0] - 22) + ' ' + b[1] + 'Q' + ((b[0] + b2[0]) / 2) + ' ' + (b[1] - 10) + ' ' + (b2[0] + 22) + ' ' + b[1], class: 'otbridge' }, g);
      s = po(17.8143, 43.3398); var t2 = el('text', { x: s[0], y: s[1], class: 'rlabel', transform: 'rotate(-80 ' + s[0] + ' ' + s[1] + ')' }, g); t2.textContent = 'Neretva';
      s = po(17.8098, 43.3393); t2 = el('text', { x: s[0], y: s[1], class: 'rlabel small' }, g); t2.textContent = 'Radobolja';
    }
  };
  MapView.prototype.pins = function (ids, numbered) {
    var proj = this.view === 'oldtown' ? po : pr, self = this; this.gPins.innerHTML = '';
    ids.forEach(function (id, i) {
      var p = PLACES[id]; if (!p) return; var q = proj(p.lon, p.lat);
      var g = el('g', { class: 'pin ' + (p.kind || '') + (numbered ? ' num' : ''), 'data-id': id, tabindex: 0, role: 'button', 'aria-label': p.name, transform: 'translate(' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ')' }, self.gPins);
      var inner = el('g', { class: 'pin-in', style: '--i:' + i }, g);
      el('circle', { r: 14, class: 'halo' }, inner);
      el('circle', { r: p.kind === 'hub' ? 7.5 : 6, class: 'dot' }, inner);
      if (numbered) { var tn = el('text', { y: 3.2, class: 'n' }, inner); tn.textContent = i + 1; }
      else if (p.kind === 'hub') el('circle', { r: 2.6, class: 'core' }, inner);
      var lab = el('text', p.label === 'l' ? { x: -11, y: 4, class: 'plabel', 'text-anchor': 'end' } : { x: 11, y: 4, class: 'plabel' }, inner); lab.textContent = p.name;
      g.addEventListener('click', function () { self.select(id, true); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.select(id, true); } });
    });
  };
  MapView.prototype.select = function (id, user) {
    this.sel = id; $$('.pin', this.svg).forEach(function (g) { g.classList.toggle('on', g.getAttribute('data-id') === id); });
    if (this.opt.onSelect) this.opt.onSelect(id, user);
  };
  /* route: walk = river stones (kaldrma), drive = dashed road + car, hub = lines from Mostar to every place */
  MapView.prototype.route = function (ids, mode, ms) {
    var proj = this.view === 'oldtown' ? po : pr, g = this.gRoute, self = this; g.innerHTML = '';
    var pts = ids.map(function (id) { var p = PLACES[id]; return proj(p.lon, p.lat); });
    if (mode === 'hub') {
      var hub = pts[0];
      pts.slice(1).forEach(function (q, i) {
        var mx = (hub[0] + q[0]) / 2, my = (hub[1] + q[1]) / 2, dx = q[0] - hub[0], dy = q[1] - hub[1], L = Math.hypot(dx, dy) || 1, bend = Math.min(L * .12, 30);
        var path = el('path', { d: 'M' + hub[0] + ' ' + hub[1] + 'Q' + (mx - dy / L * bend) + ' ' + (my + dx / L * bend) + ' ' + q[0] + ' ' + q[1], class: 'spoke', pathLength: 1, style: '--i:' + i }, g);
        path.setAttribute('data-to', ids[i + 1]);
      });
      return;
    }
    var d = smooth(pts);
    if (mode === 'walk') {
      var guide = el('path', { d: d, class: 'guide' }, g), L = guide.getTotalLength(), n = 0, greys = ['#9b958b', '#857f75', '#b4ada1', '#6f6a61', '#a8a196'];
      var step = 9 * (this.k ? this.k() : 1), stones = [];
      for (var l = 0; l < L; l += step) {
        var a = guide.getPointAtLength(l), b = guide.getPointAtLength(Math.min(L, l + 1)), ang = Math.atan2(b.y - a.y, b.x - a.x) * 57.3 + (Math.sin(n * 7.1) * 18);
        var rx = (3.4 + (n * 37 % 10) / 10 * 1.4) * (step / 9), ry = (2.4 + (n * 53 % 10) / 10 * .9) * (step / 9);
        stones.push(el('ellipse', { cx: a.x.toFixed(1), cy: a.y.toFixed(1), rx: rx.toFixed(2), ry: ry.toFixed(2), transform: 'rotate(' + ang.toFixed(0) + ' ' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ')', fill: greys[n % greys.length], class: 'stone' }, g)); n++;
      }
      guide.remove();
      stones.forEach(function (s, i) { if (reduce) s.classList.add('on'); else setTimeout(function () { s.classList.add('on'); }, i * ((ms || 2400) / stones.length)); });
    } else {
      var road = el('path', { d: d, class: 'road', pathLength: 1 }, g);
      var dash = el('path', { d: d, class: 'road-dash' }, g);
      var car = el('g', { class: 'car' }, g); el('circle', { r: 6.5, class: 'car-halo' }, car); el('circle', { r: 3.8, class: 'car-dot' }, car);
      var len = dash.getTotalLength();

      tween(ms || 3200, function (t) {
        road.style.strokeDashoffset = 1 - t;
        var p = dash.getPointAtLength(len * t); car.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
      }, function () { car.classList.add('park'); });
    }
  };

  /* ---------- small orthographic globe on canvas ---------- */
  function Globe(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
  }
  Globe.prototype.draw = function (world, bih, lon0, lat0, scale) {
    var c = this.c, dpr = Math.min(window.devicePixelRatio || 1, 2), w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    var g = this.ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    var R = Math.min(w, h) * .42 * scale, cx = w / 2, cy = h / 2, l0 = lon0 * Math.PI / 180, p0 = lat0 * Math.PI / 180, sp0 = Math.sin(p0), cp0 = Math.cos(p0);
    var nt = night(), col = nt ? { sea: '#1f2536', land: '#353449', edge: '#4b4a63', bih: '#48e5c2' } : { sea: '#d4ebe5', land: '#efe6d6', edge: '#cdbfa6', bih: '#48e5c2' };
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = col.sea; g.fill();
    function ring(flat, fill, stroke) {
      g.beginPath(); var pen = false;
      for (var i = 0; i < flat.length; i += 2) {
        var l = flat[i] * Math.PI / 180 - l0, p = flat[i + 1] * Math.PI / 180, cp = Math.cos(p), sp = Math.sin(p);
        var cosc = sp0 * sp + cp0 * cp * Math.cos(l), dx = cp * Math.sin(l), dy = cp0 * sp - sp0 * cp * Math.cos(l);
        if (cosc < 0) { var m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m; } // far side: pin to the rim so fills stay closed
        var x = cx + R * dx, y = cy - R * dy;
        if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; }
      }
      if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
    }
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    world.land.forEach(function (r) { var vis = false; for (var i = 1; i < r.length; i += 2) if (r[i] < -60) return; ring(r, col.land, col.edge); });
    bih.forEach(function (r) { ring(r, col.bih, null); }); g.restore();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.strokeStyle = col.edge; g.lineWidth = 1.2; g.stroke();
  };
  Globe.prototype.fly = function (world, bih, ms, done) {
    var self = this, from = [-25, 18, 1], to = [17.8, 43.6, 9];
    tween(ms, function (t) { var z = Math.pow(to[2] / from[2], Math.max(0, (t - .45) / .55)); self.draw(world, bih, from[0] + (to[0] - from[0]) * Math.min(1, t * 1.4), from[1] + (to[1] - from[1]) * Math.min(1, t * 1.4), from[2] * z); }, done);
  };

  /* ---------- place card ---------- */
  function placeImg(p) {
    if (p.image) return '<img src="/img/' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">';
    if (p.photo) return '<img src="/img/places/' + esc(p.photo) + '" alt="' + esc(p.name) + '" loading="lazy">';
    return '<span class="pc-art" aria-hidden="true"></span>';
  }
  function credit(p) { return p.credit ? '<small class="pc-credit">Photo: ' + esc(p.credit) + '</small>' : ''; }
  function tourLinks(p) {
    var t = (p.tours || []).map(function (s) { var x = (D.tours || []).filter(function (q) { return q.slug === s; })[0]; return x ? '<a href="/tours/' + s + '/">' + esc(x.name.split(' – ')[0]) + ' →</a>' : ''; }).join('');
    return t || '<a href="https://wa.me/' + D.whatsapp + '?text=' + encodeURIComponent('Hello Mirna, could we visit ' + p.name + '?') + '">Ask Mirna about ' + esc(p.name) + ' →</a>';
  }
  function dist(p) { return p.km ? '<span class="pc-dist">≈ ' + p.km + ' km · ' + (p.min >= 60 ? Math.floor(p.min / 60) + ' h ' + (p.min % 60 ? p.min % 60 + ' min' : '') : p.min + ' min') + ' from Mostar</span>' : ''; }

  /* ---------- home: "Where we go" ---------- */
  function initExplore(sec) {
    var stage = $('.ex-stage', sec), canvas = $('canvas', sec), card = $('.ex-card', sec), chips = $('.ex-chips', sec), back = $('.ex-back', sec);
    var regionIds = (D.places || []).filter(function (p) { return p.area === 'region'; }).map(function (p) { return p.id; });
    var oldIds = ['hamam', 'kriva', 'stari-most', 'kujundziluk', 'koski'];
    var mv = null, ov = null, started = false;
    function showCard(id) {
      var p = PLACES[id]; if (!p) return;
      card.innerHTML = '<div class="pc-img">' + placeImg(p) + '</div><div class="pc-body"><b>' + esc(p.name) + '</b>' + dist(p) + '<p>' + esc(p.text) + '</p><div class="pc-links">' + (id === 'mostar' ? '<button type="button" class="pc-zoom">Zoom into the Old Town ↘</button>' : '') + tourLinks(p) + '</div>' + credit(p) + '</div>';
      card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
      $$('button', chips).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-id') === id)); });
      var z = $('.pc-zoom', card); if (z) z.addEventListener('click', toOld);
      if (mv) { $$('.spoke', mv.svg).forEach(function (s) { s.classList.toggle('hot', s.getAttribute('data-to') === id); }); }
    }
    chips.innerHTML = regionIds.map(function (id) { return '<button type="button" data-id="' + id + '">' + esc(PLACES[id].name) + '</button>'; }).join('');
    $$('button', chips).forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-id'); if (ov && stage.classList.contains('old')) toRegion(); mv.select(id, true); }); });
    function toOld() {
      if (!ov) { ov = new MapView(stage, { view: 'oldtown', label: 'Map of the Old Town of Mostar', onSelect: function (id) { var p = PLACES[id]; card.innerHTML = '<div class="pc-img">' + placeImg(p) + '</div><div class="pc-body"><b>' + esc(p.name) + '</b><p>' + esc(p.text) + '</p><div class="pc-links"><a href="/tours/mostar-old-town-highlights/">Old Town Highlights →</a></div>' + credit(p) + '</div>'; } }); ov.svg.classList.add('layer'); ov.drawBase(); }
      stage.classList.add('old'); back.hidden = false;
      ov.setVB(ov.fit(oldIds, .35)); ov.pins(oldIds, true); ov.route(oldIds, 'walk', 2200); ov.select('hamam');
    }
    function toRegion() { stage.classList.remove('old'); back.hidden = true; mv.select('mostar', true); }
    back.addEventListener('click', toRegion);
    function start() {
      if (started) return; started = true;
      Promise.all([geo('world'), geo('region')]).then(function (r) {
        var world = r[0], region = r[1];
        mv = new MapView(stage, { view: 'region', label: 'Map of Herzegovina with the places Mirna visits', onSelect: function (id) { showCard(id); } });
        mv.drawBase(region);
        var all = mv.fit(regionIds, .12), wide = mv.fit(['sarajevo', 'kravice', 'stolac', 'jablanica', 'mostar'], 1.1);
        mv.setVB(wide);
        showCard('mostar');
        var g = new Globe(canvas);
        stage.classList.add('globe');
        g.fly(world, region.bih, 2600, function () {
          stage.classList.remove('globe'); stage.classList.add('mapon');
          mv.zoom(all, 1400, function () { mv.route(['mostar'].concat(regionIds.slice(1)), 'hub'); mv.pins(regionIds, false); stage.classList.add('drawn'); mv.select('mostar'); });
        });
      });
    }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { start(); io.disconnect(); } }, { threshold: .35 });
    io.observe(stage);
  }

  /* ---------- tour page: "The route" ---------- */
  function initRoute(sec) {
    var r = JSON.parse(sec.getAttribute('data-route')), stage = $('.rt-stage', sec), list = $$('.rt-step', sec), started = false;
    function start() {
      if (started) return; started = true;
      (r.map === 'region' ? geo('region') : Promise.resolve(null)).then(function (region) {
        var mv = new MapView(stage, { view: r.map, label: 'Route map', onSelect: function (id, user) { list.forEach(function (li) { li.classList.toggle('on', li.getAttribute('data-id') === id); }); if (user) { var li = $('.rt-step[data-id="' + id + '"]', sec); if (li && innerWidth < 1000) li.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } } });
        mv.drawBase(region); mv.setVB(mv.fit(r.stops, r.map === 'oldtown' ? .35 : .3));
        mv.pins(r.stops, true); mv.route(r.stops, r.mode, r.map === 'oldtown' ? 2400 : 3200); mv.select(r.stops[0]);
        list.forEach(function (li) { li.addEventListener('click', function () { mv.select(li.getAttribute('data-id'), false); }); });
      });
    }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { start(); io.disconnect(); } }, { threshold: .3 });
    io.observe(stage);
  }

  $$('[data-explore]').forEach(initExplore);
  $$('[data-route]').forEach(initRoute);
})();
