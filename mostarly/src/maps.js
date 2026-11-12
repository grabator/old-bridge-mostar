/* Mostarly Guide maps: a journey player. The camera flies from stop to stop, a card opens for every
   stop and the route grows behind you: river-stone "kaldrma" for walks, a red road with a car for
   drives, lines from Mostar on the home page (after a small globe dives into Herzegovina). No libraries. */
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
  // Web Mercator (the projection of the satellite tiles), scaled so 1° of latitude near lat0 = s units
  function merc(lat) { return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI; }
  function P(view) { var c = Math.cos(view.lat0 * Math.PI / 180), m0 = merc(view.lat0); return function (lon, lat) { return [(lon - view.lon0) * c * view.s, (m0 - merc(lat)) * c * view.s]; }; }
  var pr = P(REGION), po = P(OLDTOWN);
  function pathFrom(flat, proj, close) { var d = ''; for (var i = 0; i < flat.length; i += 2) { var p = proj(flat[i], flat[i + 1]); d += (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); } return d + (close ? 'Z' : ''); }
  function smooth(pts) { // Catmull-Rom through points -> cubic path
    if (pts.length < 3) return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L');
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) { var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2; d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ',' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ',' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1); }
    return d;
  }
  // towns for orientation (labels only, not stops): name, lat, lon, bigger
  var TOWNS = [['Konjic', 43.6519, 17.9611], ['Čapljina', 43.1214, 17.6847], ['Ljubuški', 43.1969, 17.545], ['Široki Brijeg', 43.3833, 17.5939], ['Međugorje', 43.1886, 17.6775], ['Neum', 42.9233, 17.6156], ['Trebinje', 42.7119, 18.3436], ['Dubrovnik', 42.6507, 18.0944, 1], ['Makarska', 43.2969, 17.0178], ['Posušje', 43.4717, 17.3292], ['Nevesinje', 43.2586, 18.1131], ['Prozor-Rama', 43.8217, 17.6097], ['Split', 43.5081, 16.4402, 1]];
  var SAT = null;
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
  MapView.prototype.setVB = function (vb) {
    this.vb = vb; this.svg.setAttribute('viewBox', vb.map(function (n) { return n.toFixed(1); }).join(' '));
    var k = this.k(); if (Math.abs(k - (this.lastK || 0)) > .004) { this.svg.style.setProperty('--k', k.toFixed(4)); this.lastK = k; }
    if (this.sat) { var sc = this.host.clientWidth / vb[2]; this.sat.forEach(function (t) { t.el.style.transform = 'translate3d(' + ((t.x - vb[0]) * sc).toFixed(2) + 'px,' + ((t.y - vb[1]) * sc).toFixed(2) + 'px,0) scale(' + sc.toFixed(5) + ')'; }); }
  };
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
      if (SAT) { // satellite photos as plain <img> layers moved by the GPU: nothing is redrawn while the camera flies
        var layer = document.createElement('div'), self = this; layer.className = 'jr-satlayer'; layer.setAttribute('aria-hidden', 'true');
        this.host.insertBefore(layer, this.svg); this.sat = [];
        SAT.layers.forEach(function (L, i) {
          var a = pr(L.bbox[0], L.bbox[3]), b = pr(L.bbox[2], L.bbox[1]), im = new Image();
          im.alt = ''; im.decoding = 'async'; im.draggable = false; im.style.width = (b[0] - a[0]).toFixed(2) + 'px'; im.style.height = (b[1] - a[1]).toFixed(2) + 'px';
          if (!i) im.src = '/geo/' + L.file; else setTimeout(function () { im.src = '/geo/' + L.file; }, 1200); // sharper layers after the first view
          layer.appendChild(im); self.sat.push({ el: im, x: a[0], y: a[1] });
        });
      }
      region.bih.forEach(function (r) { el('path', { d: pathFrom(r, pr, true), class: 'bih-line' }, g); });
      [[NERETVA, 'river big'], [BUNA, 'river'], [TREBIZAT, 'river']].forEach(function (r) { el('path', { d: smooth(r[0].map(function (p) { return pr(p[0], p[1]); })), class: r[1] }, g); });
      s = pr(17.775, 43.5); var t = el('text', { x: s[0], y: s[1], class: 'rlabel', transform: 'rotate(-62 ' + s[0] + ' ' + s[1] + ')' }, g); t.textContent = 'Neretva';
      s = pr(17.35, 42.92); t = el('text', { x: s[0], y: s[1], class: 'sealabel' }, g); t.textContent = 'Adriatic Sea';
      s = pr(18.05, 43.62); t = el('text', { x: s[0], y: s[1], class: 'clabel' }, g); t.textContent = 'BOSNIA AND HERZEGOVINA';
      [['CROATIA', 17.05, 43.05], ['MONTENEGRO', 18.75, 42.62]].forEach(function (c) { var q = pr(c[1], c[2]), tc = el('text', { x: q[0], y: q[1], class: 'clabel other' }, g); tc.textContent = c[0]; });
      var gt = el('g', { class: 'towns' }, g);
      TOWNS.forEach(function (tw) {
        var q = pr(tw[2], tw[1]), gg = el('g', { class: 'town' + (tw[3] ? ' big' : ''), transform: 'translate(' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ')' }, gt), ii = el('g', { class: 'town-in' }, gg);
        el('circle', { r: tw[3] ? 2.6 : 2 }, ii); var tt = el('text', { x: 5, y: 3 }, ii); tt.textContent = tw[0];
      });
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

  /* ---------- small orthographic globe on canvas ---------- */
  function Globe(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
  }
  Globe.prototype.draw = function (world, bih, lon0, lat0, scale) {
    var c = this.c, dpr = Math.min(window.devicePixelRatio || 1, 2), w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    var g = this.ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    var bx = this.box ? this.box(w, h) : [0, 0, w, h], R = Math.min(bx[2], bx[3]) * .42 * scale, cx = bx[0] + bx[2] / 2, cy = bx[1] + bx[3] / 2, l0 = lon0 * Math.PI / 180, p0 = lat0 * Math.PI / 180, sp0 = Math.sin(p0), cp0 = Math.cos(p0);
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
  Globe.prototype.fly = function (world, bih, from, ms, done) {
    var self = this, to = [17.8, 43.6, 9];
    tween(ms, function (t) { var z = Math.pow(to[2] / from[2], Math.max(0, (t - .4) / .6)), m = Math.min(1, t * 1.5); self.draw(world, bih, from[0] + (to[0] - from[0]) * m, from[1] + (to[1] - from[1]) * m, from[2] * z); }, done);
  };

  /* ---------- pins ---------- */
  MapView.prototype.pins = function (ids, numbered, onPick) {
    var proj = this.view === 'oldtown' ? po : pr, self = this; this.gPins.innerHTML = '';
    ids.forEach(function (id, i) {
      var p = PLACES[id]; if (!p) return; var q = proj(p.lon, p.lat);
      var g = el('g', { class: 'pin ' + (p.kind || '') + (numbered ? ' num' : ''), 'data-id': id, 'data-i': i, transform: 'translate(' + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ')' }, self.gPins);
      var inner = el('g', { class: 'pin-in', style: '--i:' + i }, g);
      el('circle', { r: 16, class: 'halo' }, inner);
      el('circle', { r: 18, class: 'hit' }, inner);
      el('circle', { r: p.kind === 'hub' && !numbered ? 7.5 : 6.5, class: 'dot' }, inner);
      if (numbered) { var tn = el('text', { y: 3.2, class: 'n' }, inner); tn.textContent = i + 1; }
      else if (p.kind === 'hub') el('circle', { r: 2.6, class: 'core' }, inner);
      var lab = el('text', p.label === 'l' ? { x: -12, y: 4, class: 'plabel', 'text-anchor': 'end' } : { x: 12, y: 4, class: 'plabel' }, inner); lab.textContent = p.name;
      g.addEventListener('click', function (e) { e.stopPropagation(); if (onPick) onPick(i); });
    });
  };
  MapView.prototype.mark = function (i) { $$('.pin', this.svg).forEach(function (g) { var k = +g.getAttribute('data-i'); g.classList.toggle('on', k === i); g.classList.toggle('past', k < i); }); };

  /* ---------- the route, one piece per leg ----------
     walk = river stones (kaldrma) laid down as you go, drive = a red road with a car,
     hub = a line from Mostar to the place you are looking at */
  function legPaths(pts) { // the same Catmull-Rom curve as smooth(), cut at every stop
    return pts.slice(0, -1).map(function (p1, i) {
      var p0 = pts[i - 1] || p1, p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      return 'M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ',' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ',' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    });
  }
  function Route(mv, ids, mode) {
    var proj = mv.view === 'oldtown' ? po : pr, g = mv.gRoute, self = this; g.innerHTML = '';
    this.mode = mode; this.legs = [];
    var pts = ids.map(function (id) { var p = PLACES[id]; return proj(p.lon, p.lat); });
    if (mode === 'hub') {
      var hub = pts[0];
      pts.forEach(function (q, i) {
        if (!i) { self.legs.push(null); return; }
        var mx = (hub[0] + q[0]) / 2, my = (hub[1] + q[1]) / 2, dx = q[0] - hub[0], dy = q[1] - hub[1], L = Math.hypot(dx, dy) || 1, bend = Math.min(L * .12, 30);
        var d = 'M' + hub[0] + ' ' + hub[1] + 'Q' + (mx - dy / L * bend) + ' ' + (my + dx / L * bend) + ' ' + q[0] + ' ' + q[1];
        el('path', { d: d, class: 'ghost hubline' }, g);
        self.legs.push({ path: el('path', { d: d, class: 'spoke', pathLength: 1 }, g) });
      });
      return;
    }
    legPaths(pts).forEach(function (d) {
      if (mode === 'walk') {
        el('path', { d: d, class: 'ghost walkline' }, g);
        var guide = el('path', { d: d }, g), L = guide.getTotalLength(), step = 7, stones = [], n = self.legs.length * 13;
        var greys = ['#9b958b', '#857f75', '#b4ada1', '#6f6a61', '#a8a196'];
        for (var l = step / 2; l < L; l += step) {
          var a = guide.getPointAtLength(l), b = guide.getPointAtLength(Math.min(L, l + 1)), ang = Math.atan2(b.y - a.y, b.x - a.x) * 57.3 + Math.sin(n * 7.1) * 18;
          stones.push(el('ellipse', { cx: a.x.toFixed(1), cy: a.y.toFixed(1), rx: (2.6 + (n * 37 % 10) / 10).toFixed(2), ry: (1.8 + (n * 53 % 10) / 14).toFixed(2), transform: 'rotate(' + ang.toFixed(0) + ' ' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ')', fill: greys[n % 5], class: 'stone' }, g)); n++;
        }
        self.legs.push({ guide: guide, len: L, stones: stones }); guide.setAttribute('class', 'guide');
      } else {
        el('path', { d: d, class: 'ghost roadline' }, g);
        var road = el('path', { d: d, class: 'road', pathLength: 1 }, g);
        self.legs.push({ path: road, guide: road, len: road.getTotalLength() });
      }
    });
    this.mover = el('g', { class: 'mover ' + mode }, g); el('circle', { r: 9, class: 'mv-halo' }, this.mover); el('circle', { r: 4.6, class: 'mv-dot' }, this.mover);
  }
  // x = how much of the route is done: 2.5 = legs 0 and 1 finished, leg 2 half way
  Route.prototype.show = function (x, target) {
    if (this.mode === 'hub') {
      this.legs.forEach(function (lg, i) { if (!lg) return; var on = i === target; lg.path.style.strokeDashoffset = on ? (1 - Math.max(0, Math.min(1, x))) : 1; lg.path.classList.toggle('hot', on); });
      return;
    }
    var mover = this.mover, placed = false;
    this.legs.forEach(function (lg, i) {
      var f = Math.max(0, Math.min(1, x - i));
      if (lg.stones) { var k = Math.round(f * lg.stones.length); lg.stones.forEach(function (s, j) { s.classList.toggle('on', j < k); }); }
      else lg.path.style.strokeDashoffset = 1 - f;
      if (!placed && (f < 1 || i === this.legs.length - 1)) { var p = lg.guide.getPointAtLength(lg.len * f); mover.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')'); placed = true; }
    }, this);
    mover.style.opacity = x <= 0 ? 0 : 1;
  };

  /* ---------- the journey player (home and every tour page) ---------- */
  var DWELL = 5200;
  function initJourney(root) {
    var cfg = JSON.parse(root.getAttribute('data-journey')), ids = cfg.stops.filter(function (id) { return PLACES[id]; }), N = ids.length;
    var stage = $('.jr-stage', root), canvas = $('.jr-globe', root), cards = $$('.jr-st', root), dots = $$('.jr-dot', root), fill = $('.jr-fill', root);
    var placeEl = $('.jr-place b', root), countEl = $('.jr-count', root), playBtn = $('[data-play]', root), prev = $('[data-step="-1"]', root), next = $('[data-step="1"]', root), live = $('.jr-live', root);
    var proj = cfg.map === 'oldtown' ? po : pr, P = ids.map(function (id) { var p = PLACES[id]; return proj(p.lon, p.lat); });
    root.classList.add('js');
    var mv = null, route = null, world = null, region = null, W = 0, H = 0, wide = false;
    var idx = -1, mode = 'start', state = null, flying = null, rev = 0, playing = false, dwellT = 0, inView = false, spin = 0, spinRaf = 0, globe = null;

    function overview() {
      var vb = mv.fit(ids, cfg.map === 'oldtown' ? .3 : .16, W / H);
      var a = wide ? [.4, .5] : [.5, .4]; // keep the route clear of the card
      var w = vb[2] * (wide ? 1.45 : 1), h = w * H / W; if (!wide) { h = vb[3] * 1.7; w = Math.max(w, h * W / H); }
      return { x: vb[0] + vb[2] / 2, y: vb[1] + vb[3] / 2, w: w, a: a };
    }
    function stationW(i) {
      if (cfg.map === 'oldtown') return Math.max(380, overview().w * .62);
      var near = 0; P.forEach(function (q, k) { if (k !== i && Math.abs(k - i) <= 1) near = Math.max(near, Math.hypot(q[0] - P[i][0], q[1] - P[i][1])); });
      return Math.max(wide ? 210 : 170, Math.min(near * (wide ? 2.6 : 2.3), 420));
    }
    function target(i) {
      if (i < 0 || i >= N) return overview();
      return { x: P[i][0], y: P[i][1], w: stationW(i), a: wide ? (hasView(i) ? [.55, .56] : [.36, .52]) : [.5, .3] };
    }
    function hasView(i) { var p = PLACES[ids[i]]; return !!(p && p.view && p.view.photos); }
    function apply(s) { var h = s.w * H / W; mv.setVB([s.x - s.a[0] * s.w, s.y - s.a[1] * h, s.w, h]); mv.svg.classList.toggle('far', s.w > 520); } // small towns only when close
    function lerp(a, b, t) { return a + (b - a) * t; }
    function between(a, b, t) {
      var d = Math.hypot(b.x - a.x, b.y - a.y), far = Math.max(a.w, b.w, d * 1.5), dip = Math.max(0, Math.log(far / Math.max(a.w, b.w))) * Math.sin(Math.PI * t);
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: Math.exp(lerp(Math.log(a.w), Math.log(b.w), t) + dip * .8), a: [lerp(a.a[0], b.a[0], t), lerp(a.a[1], b.a[1], t)] };
    }

    function setCard(i) {
      cards.forEach(function (c, k) { c.classList.toggle('on', k === i); if (k === i) c.scrollTop = 0; });
      dots.forEach(function (d, k) { d.classList.toggle('now', k === i); d.classList.toggle('past', k < i); d.setAttribute('aria-current', k === i ? 'step' : 'false'); });
      var j = Math.max(0, Math.min(i, N - 1));
      fill.style.transform = 'scaleX(' + (N > 1 ? Math.max(0, Math.min(1, i / (N - 1))) : 1) + ')';
      placeEl.textContent = i >= N ? root.getAttribute('data-end') : i < 0 ? root.getAttribute('data-title') : PLACES[ids[j]].name;
      countEl.textContent = (i < 0 ? 0 : Math.min(i + 1, N)) + ' / ' + N;
      prev.disabled = i <= 0; next.disabled = i >= N;
    }
    function go(j) {
      j = Math.max(0, Math.min(N, j));
      if (j === idx && !flying) return;
      if (mode === 'start' && globe) { fromGlobe(j); return; }
      var from = state || target(idx), to = target(j), d = Math.hypot(to.x - from.x, to.y - from.y) / Math.max(from.w, to.w);
      var ms = Math.max(1100, Math.min(2600, 900 + d * 1100)), r0 = rev, r1 = cfg.mode === 'hub' ? 1 : Math.min(j, N - 1), t0 = performance.now();
      if (cfg.mode !== 'hub' && r1 < r0) r0 = r1; // going back: the route shrinks at once
      clearTimeout(dwellT); playBtn.classList.remove('timing');
      root.classList.remove('is-start', 'is-end', 'is-landed', 'tilt'); root.classList.add('is-flying'); closeView();
      mode = 'fly'; setCard(-2); setHud(j);
      var tok = flying = {};
      if (reduce) { state = to; apply(to); rev = r1; route.show(cfg.mode === 'hub' ? 1 : r1, j); return land(j); }
      (function f(now) {
        if (flying !== tok) return;
        var t = Math.min(1, (now - t0) / ms), e = ease(t);
        state = between(from, to, e); apply(state);
        rev = lerp(r0, r1, Math.max(0, Math.min(1, (e - .1) / .8)));
        route.show(cfg.mode === 'hub' ? Math.max(0, (e - .3) / .7) : rev, j);
        if (t < 1) requestAnimationFrame(f); else land(j);
      })(t0);
    }
    function setHud(j) { // the HUD shows where you are going while you fly
      var i = Math.min(j, N - 1);
      dots.forEach(function (d, k) { d.classList.toggle('now', k === j); d.classList.toggle('past', k < j); });
      fill.style.transform = 'scaleX(' + (N > 1 ? Math.min(1, j / (N - 1)) : 1) + ')';
      placeEl.textContent = j >= N ? root.getAttribute('data-end') : PLACES[ids[i]].name;
      countEl.textContent = Math.min(j + 1, N) + ' / ' + N; prev.disabled = j <= 0; next.disabled = j >= N;
    }
    function land(j) {
      flying = null; idx = j; state = target(j);
      root.classList.remove('is-flying');
      mv.mark(j < N ? j : -1);
      if (j >= N) { mode = 'end'; root.classList.add('is-end'); setPlaying(false); setCard(N); live.textContent = root.getAttribute('data-end'); return; }
      mode = 'station'; root.classList.add('is-landed'); setCard(j);
      // the camera tips forward over the place, like looking out of a plane
      var an = state.a; root.style.setProperty('--ox', (an[0] * 100).toFixed(1) + '%'); root.style.setProperty('--oy', (an[1] * 100).toFixed(1) + '%');
      if (!reduce) requestAnimationFrame(function () { root.classList.add('tilt'); });
      if (wide && hasView(j)) setTimeout(function () { if (idx === j && mode === 'station') openView(j); }, 650);
      live.textContent = 'Stop ' + (j + 1) + ' of ' + N + ': ' + PLACES[ids[j]].name;
      if (playing) dwell();
    }
    function dwell() {
      clearTimeout(dwellT); playBtn.style.setProperty('--dwell', DWELL + 'ms');
      playBtn.classList.remove('timing'); void playBtn.offsetWidth; playBtn.classList.add('timing');
      dwellT = setTimeout(function () { if (playing) go(idx + 1); }, DWELL);
    }
    function setPlaying(on) {
      playing = on; playBtn.setAttribute('aria-pressed', String(on)); $('span', playBtn).textContent = on ? 'Pause' : 'Play';
      if (!on) { clearTimeout(dwellT); playBtn.classList.remove('timing'); }
    }
    function step(dir) { if (flying) { go(idx + dir < 0 ? 0 : (dir > 0 ? Math.max(idx, 0) + 1 : idx - 1)); return; } go(idx < 0 ? 0 : idx + dir); }

    /* globe (home page only): spins behind the start card, then dives into Herzegovina */
    function spinGlobe() {
      if (!globe || mode !== 'start') return;
      spin += .12; globe.draw(world, region.bih, -10 + spin, 22, 1);
      if (inView && !reduce) spinRaf = requestAnimationFrame(spinGlobe);
    }
    function fromGlobe(j) {
      mode = 'fly'; cancelAnimationFrame(spinRaf); root.classList.remove('is-start'); root.classList.add('is-flying');
      setHud(0);
      var g = globe; globe = null;
      g.fly(world, region.bih, [-10 + spin, 22, 1], 2300, function () {
        root.classList.remove('globe-on');
        state = target(-1); var s = target(-1); s.w *= .55; s.x = P[0][0]; s.y = P[0][1]; state = s; apply(s);
        mode = 'station'; idx = -1; go(j);
      });
    }

    /* "Look around": a photo you drag with a finger or the mouse (a 360° photo turns all the way round) */
    var view = $('.jr-view', root), vpic = view && $('.jr-view-pic', view), vimg = view && $('img', view), vx = 0, vy = 0, vdrag = null, vraf = 0, vdir = 1, vloop = false, vtouched = false;
    function vbounds() { var W2 = vpic.clientWidth, H2 = vpic.clientHeight, iw = vimg.offsetWidth, ih = vimg.offsetHeight; return [Math.min(0, W2 - iw), Math.min(0, H2 - ih)]; }
    function vset() { var b = vbounds(); if (!vloop) vx = Math.max(b[0], Math.min(0, vx)); vy = Math.max(b[1], Math.min(0, vy)); vimg.style.transform = 'translate3d(' + vx.toFixed(1) + 'px,' + vy.toFixed(1) + 'px,0)'; }
    function vdrift() { // slow pan until someone touches it
      if (!view || view.hidden || vtouched || reduce) return;
      var b = vbounds(); vx += vdir * .25; if (vx > 0 || vx < b[0]) { vdir = -vdir; } vset(); vraf = requestAnimationFrame(vdrift);
    }
    function showPhoto(p, k) {
      var ph = p.view.photos[k]; vtouched = false; cancelAnimationFrame(vraf);
      $$('.jr-view-tabs button', view).forEach(function (b, n) { b.setAttribute('aria-pressed', String(n === k)); });
      $('.jr-view-top b', view).textContent = ph.title || p.name; vimg.alt = ph.title || p.name; vloop = !!ph.pano;
      vimg.onload = function () { var b = vbounds(); vx = b[0] / 2; vy = b[1] / 2; vset(); vraf = requestAnimationFrame(vdrift); };
      vimg.src = '/img/' + ph.src; if (vimg.complete) vimg.onload();
    }
    function openView(i) {
      var p = PLACES[ids[i]]; if (!view || !p || !p.view) return;
      var tabs = $('.jr-view-tabs', view); tabs.innerHTML = '';
      p.view.photos.forEach(function (ph, k) { var b = document.createElement('button'); b.type = 'button'; b.textContent = ph.title; b.addEventListener('click', function () { showPhoto(p, k); }); tabs.appendChild(b); });
      var sv = p.view.sv || [p.lat, p.lon]; $('.jr-view-bar .jr-svbtn', view).href = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + sv[0] + ',' + sv[1];
      view.hidden = false; requestAnimationFrame(function () { root.classList.add('view-on'); }); showPhoto(p, 0);
    }
    function closeView() { if (!view || view.hidden) return; root.classList.remove('view-on'); cancelAnimationFrame(vraf); setTimeout(function () { if (!root.classList.contains('view-on')) view.hidden = true; }, 350); }
    if (view) {
      vpic.addEventListener('pointerdown', function (e) { vtouched = true; cancelAnimationFrame(vraf); vdrag = { x: e.clientX - vx, y: e.clientY - vy }; vpic.setPointerCapture(e.pointerId); vpic.classList.add('grab'); root.classList.add('view-touched'); });
      vpic.addEventListener('pointermove', function (e) { if (!vdrag) return; vx = e.clientX - vdrag.x; vy = e.clientY - vdrag.y; vset(); });
      ['pointerup', 'pointercancel'].forEach(function (ev) { vpic.addEventListener(ev, function () { vdrag = null; vpic.classList.remove('grab'); }); });
      addEventListener('resize', function () { if (!view.hidden) vset(); });
    }

    /* input */
    root.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((b = t.closest('[data-go]'))) { setPlaying(false); go(+b.getAttribute('data-go')); return; }
      if (t.closest('[data-begin]')) { go(0); return; }
      if (t.closest('[data-autoplay]')) { setPlaying(true); go(0); return; }
      if (t.closest('[data-restart]')) { setPlaying(true); go(0); return; }
      if (t.closest('[data-play]')) { if (playing) setPlaying(false); else { setPlaying(true); if (mode === 'start' || mode === 'end') go(0); else if (!flying) go(idx + 1); } return; }
      if ((b = t.closest('[data-step]'))) { setPlaying(false); step(+b.getAttribute('data-step')); }
      if (t.closest('[data-view]')) { setPlaying(false); openView(idx); return; }
      if (t.closest('[data-view-close]')) { closeView(); return; }
      if ((b = t.closest('[data-sat]'))) { var on = !root.classList.contains('sat'); root.classList.toggle('sat', on); b.setAttribute('aria-pressed', String(on)); }
    });
    var down = null;
    stage.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; }, { passive: true });
    stage.addEventListener('pointerup', function (e) {
      if (!down) return; var dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) { setPlaying(false); if (mode === 'start') { if (dx < 0) go(0); } else step(dx < 0 ? 1 : -1); }
    }, { passive: true });
    document.addEventListener('keydown', function (e) {
      if (!inView || e.altKey || e.ctrlKey || e.metaKey || /input|textarea|select/i.test((document.activeElement || {}).tagName || '')) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var r = root.getBoundingClientRect(); if (r.top > innerHeight * .5 || r.bottom < innerHeight * .5) return;
      e.preventDefault(); setPlaying(false); if (mode === 'start') { if (e.key === 'ArrowRight') go(0); } else step(e.key === 'ArrowRight' ? 1 : -1);
    });

    function measure() {
      W = stage.clientWidth; H = stage.clientHeight; wide = root.clientWidth >= 900;
      root.classList.toggle('is-wide', wide);
      if (mv && !flying) { state = target(idx); apply(state); }
      if (globe && mode === 'start') globe.draw(world, region.bih, -10 + spin, 22, 1);
    }
    var started = false;
    function boot() {
      if (started) return; started = true;
      Promise.all([cfg.map === 'region' ? geo('region') : Promise.resolve(null), cfg.globe ? geo('world') : Promise.resolve(null), cfg.map === 'region' ? geo('sat').catch(function () { return null; }) : Promise.resolve(null)]).then(function (r) {
        region = r[0]; world = r[1]; SAT = r[2];
        if (SAT) { root.classList.add('has-sat', 'sat'); var cr = document.createElement('small'); cr.className = 'jr-credit'; cr.innerHTML = 'Satellite: <a href="https://cloudless.eox.at" rel="noopener">EOxCloudless 2016</a> by EOX, Copernicus Sentinel data, CC BY 4.0'; root.appendChild(cr); }
        mv = new MapView(stage, { view: cfg.map, label: root.getAttribute('data-label') || 'Route map' });
        stage.insertBefore(mv.svg, stage.firstChild);
        mv.drawBase(region); measure();
        route = new Route(mv, ids, cfg.mode); route.show(0, -1);
        mv.pins(ids, cfg.mode !== 'hub', function (i) { setPlaying(false); go(i); });
        state = target(-1); apply(state); setCard(-1);
        root.classList.add('is-start', 'ready');
        if (cfg.globe && world && canvas) { globe = new Globe(canvas); var sp = $('.jr-start .jr-panel', root); globe.box = function (w, h) { return wide ? [0, 70, w * .64, h - 70] : [0, 96, w, Math.max(140, h - 96 - (sp ? sp.offsetHeight + 24 : h * .4))]; }; root.classList.add('globe-on'); spinGlobe(); }
      });
    }
    var io = new IntersectionObserver(function (es) {
      inView = es[0].isIntersecting;
      if (inView) { boot(); if (globe && mode === 'start') spinGlobe(); }
      else if (playing) setPlaying(false);
    }, { threshold: .2 });
    io.observe(root);
    var rt = 0; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(measure, 120); });
  }

  $$('[data-journey]').forEach(initJourney);
})();
