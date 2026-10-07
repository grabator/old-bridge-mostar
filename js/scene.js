/*
 * Ilustracije Mostara (SVG), slojevi za filmsko skrolanje.
 * Sve je nacrtano ovdje, bez slika sa interneta. Boje: zlatni sat (sumrak) nad Neretvom.
 */
(function () {
  'use strict';

  /* stabilni "slučajni" brojevi: ista slika pri svakom učitavanju */
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function svg(w, h, par, defs, body, cls) {
    return '<svg class="art ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="' + par + '" aria-hidden="true" focusable="false">' +
      (defs ? '<defs>' + defs + '</defs>' : '') + body + '</svg>';
  }

  /* ---------- nebo ---------- */
  function sky() {
    var r = rng(7), stars = '';
    for (var i = 0; i < 70; i++) {
      stars += '<circle cx="' + (r() * 1600).toFixed(0) + '" cy="' + (r() * 330).toFixed(0) + '" r="' + (0.6 + r() * 1.3).toFixed(1) + '" opacity="' + (0.25 + r() * 0.6).toFixed(2) + '"/>';
    }
    var clouds = '';
    [[260, 420, 260, 16], [620, 470, 340, 14], [1180, 400, 300, 18], [1420, 500, 220, 12], [900, 540, 420, 10]].forEach(function (c) {
      clouds += '<ellipse cx="' + c[0] + '" cy="' + c[1] + '" rx="' + c[2] + '" ry="' + c[3] + '"/>';
    });
    return svg(1600, 1000, 'xMidYMid slice',
      '<linearGradient id="sk" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#1c2444"/><stop offset=".38" stop-color="#4f4a7c"/><stop offset=".62" stop-color="#b9748a"/>' +
      '<stop offset=".8" stop-color="#ef9e7a"/><stop offset=".93" stop-color="#f8c992"/><stop offset="1" stop-color="#fbe0b3"/></linearGradient>' +
      '<radialGradient id="sun"><stop offset="0" stop-color="#fff1c9"/><stop offset=".25" stop-color="#ffd896" stop-opacity=".9"/><stop offset="1" stop-color="#ffb877" stop-opacity="0"/></radialGradient>',
      '<rect width="1600" height="1000" fill="url(#sk)"/>' +
      '<g fill="#fff7e6">' + stars + '</g>' +
      '<circle cx="1110" cy="700" r="330" fill="url(#sun)" opacity=".75"/>' +
      '<circle cx="1110" cy="700" r="62" fill="#fff0c6"/>' +
      '<g fill="#ffd9b8" opacity=".28">' + clouds + '</g>');
  }

  /* ---------- planine (Velež i Hum) ---------- */
  function mountains() {
    return svg(1600, 620, 'xMidYMax slice', '',
      '<path d="M0 330 L110 288 L230 318 L360 250 L470 286 L590 228 L720 276 L840 214 L990 262 L1120 206 L1260 258 L1390 228 L1500 270 L1600 246 V620 H0 Z" fill="#6c6190" opacity=".85"/>' +
      '<path d="M0 410 Q140 350 290 392 T560 370 T860 400 T1150 352 T1440 386 T1600 368 V620 H0 Z" fill="#4c4472"/>' +
      '<path d="M0 470 Q180 420 340 462 T680 448 T1000 474 T1320 430 T1600 456 V620 H0 Z" fill="#383156"/>');
  }

  /* ---------- stari grad: kuće, munare, čempresi ---------- */
  function house(r, x, y) {
    var w = 38 + r() * 34, h = 30 + r() * 26, rh = 16 + r() * 10;
    var wall = pick(r, ['#e8d4b4', '#dfc7a3', '#d3b994', '#cbb08c', '#e2cfb2']);
    var roof = pick(r, ['#7c7470', '#8a817a', '#6e6762', '#958c84']);
    var out = '<rect x="' + x.toFixed(1) + '" y="' + (y - h).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (h + 40).toFixed(1) + '" fill="' + wall + '"/>' +
      '<path d="M' + (x - 5).toFixed(1) + ' ' + (y - h).toFixed(1) + ' L' + (x + w * 0.5).toFixed(1) + ' ' + (y - h - rh).toFixed(1) + ' L' + (x + w + 5).toFixed(1) + ' ' + (y - h).toFixed(1) + ' Z" fill="' + roof + '"/>';
    var nw = 1 + Math.floor(r() * 3);
    for (var i = 0; i < nw; i++) {
      var lit = r() < 0.45;
      out += '<rect x="' + (x + 7 + i * (w - 14) / Math.max(1, nw)).toFixed(1) + '" y="' + (y - h + 9).toFixed(1) + '" width="6" height="9" rx="1" fill="' + (lit ? '#ffd07a' : '#5b4c40') + '"' + (lit ? ' class="lit"' : '') + '/>';
    }
    return out;
  }
  function minaret(x, base, h) {
    return '<g class="minaret">' +
      '<rect x="' + (x - 7) + '" y="' + (base - h) + '" width="14" height="' + h + '" fill="#efe5d4"/>' +
      '<rect x="' + (x - 11) + '" y="' + (base - h * 0.72) + '" width="22" height="5" fill="#d8ccb8"/>' +
      '<path d="M' + (x - 8) + ' ' + (base - h) + ' L' + x + ' ' + (base - h - 34) + ' L' + (x + 8) + ' ' + (base - h) + ' Z" fill="#8b827b"/>' +
      '<line x1="' + x + '" y1="' + (base - h - 34) + '" x2="' + x + '" y2="' + (base - h - 44) + '" stroke="#e8c27a" stroke-width="2"/></g>';
  }
  function dome(x, base, r0) {
    return '<rect x="' + (x - r0 - 6) + '" y="' + (base - 34) + '" width="' + (r0 * 2 + 12) + '" height="60" fill="#ded2bf"/>' +
      '<path d="M' + (x - r0) + ' ' + (base - 34) + ' A' + r0 + ' ' + r0 + ' 0 0 1 ' + (x + r0) + ' ' + (base - 34) + ' Z" fill="#9a918a"/>';
  }
  function cypress(x, base, h) {
    return '<ellipse cx="' + x + '" cy="' + (base - h / 2) + '" rx="' + (h * 0.13).toFixed(1) + '" ry="' + (h / 2) + '" fill="#2b3a2f"/>';
  }
  function town() {
    var r = rng(41), items = [];
    function leftY(x) { return 330 + (x / 640) * 290; }
    function rightY(x) { return 620 - ((x - 960) / 640) * 300; }
    for (var x = -10; x < 600; x += 30 + r() * 22) items.push({ y: leftY(x) + r() * 26, s: house(r, x, leftY(x) + r() * 26) });
    for (var x2 = 980; x2 < 1610; x2 += 30 + r() * 22) items.push({ y: rightY(x2) + r() * 26, s: house(r, x2, rightY(x2) + r() * 26) });
    for (var c = 0; c < 14; c++) {
      var cx = r() < 0.5 ? r() * 600 : 980 + r() * 620, base = (cx < 800 ? leftY(cx) : rightY(cx)) + 30;
      items.push({ y: base - 1, s: cypress(cx.toFixed(0), base, 70 + r() * 50) });
    }
    items.push({ y: leftY(250) + 10, s: dome(210, leftY(250) + 12, 30) + minaret(270, leftY(270) + 6, 150) });
    items.push({ y: rightY(1240) + 10, s: dome(1290, rightY(1290) + 12, 34) + minaret(1230, rightY(1230) + 6, 170) });
    items.push({ y: rightY(1480) + 6, s: minaret(1480, rightY(1480) + 4, 120) });
    items.sort(function (a, b) { return a.y - b.y; });
    return svg(1600, 700, 'xMidYMax slice',
      '<linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6c5a4f"/><stop offset="1" stop-color="#3b3029"/></linearGradient>',
      '<path d="M0 320 Q330 380 640 620 L960 620 Q1270 370 1600 300 V700 H0 Z" fill="url(#hill)"/>' +
      items.map(function (i) { return i.s; }).join('') +
      '<path d="M600 640 Q800 610 1000 640 L1040 700 H560 Z" fill="#15605a"/><path d="M640 660 h80 M780 672 h120" stroke="#9fe3d2" stroke-opacity=".3" stroke-width="2"/>');
  }

  /* ---------- Stari most, kule i kanjon ---------- */
  function bankHouses() {
    var r = rng(77), out = '', bush = '';
    [[20, 372], [96, 380], [168, 386], [240, 392], [1300, 384], [1376, 376], [1452, 368], [1528, 360]].forEach(function (p) { out += house(r, p[0], p[1] + 8); });
    for (var i = 0; i < 26; i++) {
      var left = i < 13, x = left ? 300 + r() * 220 : 1080 + r() * 230, y = left ? 400 + (x - 300) * 0.3 + r() * 20 : 404 - (x - 1080) * 0.1 + r() * 20;
      bush += '<ellipse cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" rx="' + (12 + r() * 14).toFixed(0) + '" ry="' + (8 + r() * 8).toFixed(0) + '" fill="' + pick(r, ['#3a4a2c', '#46593a', '#2f3d26']) + '"/>';
    }
    return out + bush;
  }
  function tower(x, y, w, h, roof, id) {
    var lines = '';
    for (var yy = y + 18; yy < y + h; yy += 16) lines += '<path d="M' + x + ' ' + yy + ' h' + w + '"/>';
    var cx = x + w / 2;
    return '<g class="tower">' +
      '<linearGradient id="tw' + id + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#efe0c2"/><stop offset=".65" stop-color="#dcc8a5"/><stop offset="1" stop-color="#b9a382"/></linearGradient>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#tw' + id + ')"/>' +
      '<g stroke="#8c7758" stroke-opacity=".22" stroke-width="1.5">' + lines + '</g>' +
      '<path d="M' + (x - 10) + ' ' + y + ' L' + cx + ' ' + (y - roof) + ' L' + cx + ' ' + y + ' Z" fill="#7d746d"/>' +
      '<path d="M' + cx + ' ' + (y - roof) + ' L' + (x + w + 10) + ' ' + y + ' L' + cx + ' ' + y + ' Z" fill="#5f5751"/>' +
      '<rect x="' + (x - 10) + '" y="' + y + '" width="' + (w + 20) + '" height="6" fill="#6a625c"/>' +
      '<path d="M' + (cx - 22) + ' ' + (y + 60) + ' v-14 a6 6 0 0 1 12 0 v14 Z M' + (cx + 10) + ' ' + (y + 60) + ' v-14 a6 6 0 0 1 12 0 v14 Z" fill="#3a2f27"/>' +
      '<path d="M' + (cx - 6) + ' ' + (y + 128) + ' v-16 a6 6 0 0 1 12 0 v16 Z" fill="#ffd27c" class="lit"/>' +
      '</g>';
  }
  function bridge() {
    var courses = '';
    for (var y = 470; y < 900; y += 26) {
      courses += '<path d="M0 ' + y + ' H540 M1060 ' + y + ' H1600" />';
    }
    return svg(1600, 900, 'xMidYMax slice',
      '<linearGradient id="rockL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9a07c"/><stop offset=".55" stop-color="#7a6350"/><stop offset="1" stop-color="#3e3230"/></linearGradient>' +
      '<linearGradient id="rockR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a98f6c"/><stop offset=".55" stop-color="#6c5746"/><stop offset="1" stop-color="#352a29"/></linearGradient>' +
      '<linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6ead3"/><stop offset="1" stop-color="#d4c09e"/></linearGradient>' +
      '<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fa595"/><stop offset="1" stop-color="#0f5650"/></linearGradient>',
      '<rect x="0" y="740" width="1600" height="160" fill="url(#water)"/>' +
      '<g stroke="#bff3e6" stroke-width="2" stroke-linecap="round" opacity=".35"><path d="M600 790 h70 M760 812 h110 M930 786 h60 M640 846 h90 M860 858 h120"/></g>' +
      '<path d="M552 742 Q800 1130 1048 742" fill="none" stroke="#f3e2c1" stroke-width="10" opacity=".22"/>' +
      '<path d="M0 360 L280 388 L440 420 L520 470 L548 760 L548 900 H0 Z" fill="url(#rockL)"/>' +
      '<path d="M1600 350 L1320 380 L1160 416 L1080 470 L1052 760 L1052 900 H1600 Z" fill="url(#rockR)"/>' +
      '<g stroke="#000" stroke-opacity=".07" stroke-width="2">' + courses + '</g>' +
      bankHouses() +
      /* Halebija (lijevo) i Tara (desno) */
      tower(360, 246, 112, 214, 58, 'halebija') + tower(1118, 236, 136, 228, 68, 'tara') +
      /* most */
      '<path class="arch" d="M470 450 Q800 210 1130 450 L1130 760 L1048 760 Q800 -50 552 760 L470 760 Z" fill="url(#stone)"/>' +
      '<path d="M552 760 Q800 -50 1048 760" fill="none" stroke="#b9a37e" stroke-width="9"/>' +
      '<g fill="none" stroke="#a8916b" stroke-opacity=".35" stroke-width="1.5"><path d="M500 470 Q800 245 1100 470"/><path d="M520 520 Q800 262 1080 520"/></g>' +
      '<g fill="#ffd690"><circle cx="560" cy="398" r="4" class="lit"/><circle cx="1040" cy="398" r="4" class="lit"/></g>' +
      '<path d="M470 450 Q800 210 1130 450" fill="none" stroke="#fff6e3" stroke-width="5" stroke-linecap="round"/>' +
      /* skakač */
      '<g id="diver"><g class="diver-fig" transform="translate(800 330)">' +
      '<circle cx="0" cy="-30" r="5.5" fill="#1d1612"/><path d="M0 -24 V-4 M0 -4 L-5 10 M0 -4 L5 10 M0 -20 L-9 -34 M0 -20 L9 -34" stroke="#1d1612" stroke-width="3.4" stroke-linecap="round" fill="none"/></g></g>' +
      '<g id="splash" opacity="0" transform="translate(800 790)"><ellipse rx="34" ry="7" fill="none" stroke="#e9fff8" stroke-width="3"/><ellipse rx="58" ry="11" fill="none" stroke="#e9fff8" stroke-width="2" opacity=".6"/>' +
      '<path d="M-10 -4 L-16 -26 M0 -6 L0 -34 M10 -4 L16 -26" stroke="#e9fff8" stroke-width="3" stroke-linecap="round"/></g>');
  }

  /* ---------- prednji plan: stijene i grane (razdvajaju se lijevo i desno) ---------- */
  function cliff(side) {
    var r = rng(side === 'left' ? 11 : 29), leaves = '';
    /* grmlje uz rub stijene: gusti mali listovi, tamni pa svjetliji */
    var edge = [[0, 150], [120, 200], [210, 290], [260, 390], [330, 480], [400, 560], [450, 640], [500, 720], [560, 820]];
    edge.forEach(function (p, k) {
      for (var n = 0; n < 7; n++) {
        var x = p[0] + (r() - 0.3) * 70, y = p[1] + (r() - 0.5) * 60, rr = 10 + r() * 16;
        leaves += '<ellipse cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" rx="' + (rr * 1.3).toFixed(0) + '" ry="' + rr.toFixed(0) + '" transform="rotate(' + (r() * 60 - 30).toFixed(0) + ' ' + x.toFixed(0) + ' ' + y.toFixed(0) + ')" fill="' + pick(r, ['#1f2a1f', '#26331f', '#2e3d26', '#37492b']) + '"/>';
      }
      if (k % 2 === 0) leaves += '<ellipse cx="' + (p[0] + 10) + '" cy="' + (p[1] - 8) + '" rx="12" ry="7" fill="#4a5f36" opacity=".7"/>';
    });
    var body = '<defs><linearGradient id="cg' + side + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2d2636"/><stop offset="1" stop-color="#15121c"/></linearGradient></defs>' +
      '<path d="M0 1000 V150 C110 200 190 290 240 380 C310 480 380 540 430 620 C480 700 560 800 640 1000 Z" fill="url(#cg' + side + ')"/>' +
      '<path d="M0 1000 V420 C120 470 220 560 300 680 C350 760 400 860 430 1000 Z" fill="#110e16" opacity=".8"/>' +
      '<path d="M40 330 C110 400 150 480 165 570 M190 500 C240 580 290 670 320 780" stroke="#000" stroke-opacity=".3" stroke-width="3" fill="none"/>' +
      '<path d="M-20 205 C90 230 190 215 300 268 C330 282 352 300 368 322" stroke="#1a1410" stroke-width="10" fill="none" stroke-linecap="round"/>' +
      '<g>' + leaves + '</g>';
    if (side === 'right') body = '<g transform="translate(1600 0) scale(-1 1)">' + body.replace(/id="cgright"/, 'id="cgright"') + '</g>';
    return svg(1600, 1000, 'xMidYMax slice', '', body);
  }

  /* ---------- Neretva izbliza ---------- */
  function river() {
    var r = rng(5), glints = '';
    for (var i = 0; i < 34; i++) {
      glints += '<ellipse cx="' + (r() * 1600).toFixed(0) + '" cy="' + (120 + r() * 820).toFixed(0) + '" rx="' + (30 + r() * 120).toFixed(0) + '" ry="' + (2 + r() * 4).toFixed(1) + '" opacity="' + (0.08 + r() * 0.22).toFixed(2) + '"/>';
    }
    return svg(1600, 1000, 'xMidYMid slice',
      '<linearGradient id="deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#36b3a1"/><stop offset=".55" stop-color="#1a7c71"/><stop offset="1" stop-color="#0b4743"/></linearGradient>' +
      '<radialGradient id="caus" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="#bff5e6" stop-opacity=".35"/><stop offset="1" stop-color="#bff5e6" stop-opacity="0"/></radialGradient>',
      '<rect width="1600" height="1000" fill="url(#deep)"/><rect width="1600" height="1000" fill="url(#caus)"/>' +
      '<path d="M380 0 Q800 520 1220 0" fill="none" stroke="#f6e7c9" stroke-width="26" opacity=".14"/>' +
      '<g fill="#e8fff8">' + glints + '</g>' +
      '<g fill="#5e5c52"><ellipse cx="90" cy="980" rx="190" ry="90"/><ellipse cx="300" cy="1010" rx="150" ry="70" fill="#4c4a42"/><ellipse cx="1510" cy="990" rx="200" ry="96"/><ellipse cx="1300" cy="1020" rx="160" ry="70" fill="#4c4a42"/></g>');
  }

  /* ---------- ikonice za kartice ---------- */
  var ICON = {
    bridge: '<path d="M4 34 Q24 8 44 34"/><path d="M10 34 Q24 16 38 34"/><path d="M2 34 H46 M6 34 v8 M42 34 v8"/>',
    copper: '<path d="M16 18 h16 l-2 20 a6 6 0 0 1-6 5 h0 a6 6 0 0 1-6-5 Z"/><path d="M32 22 c6 0 8 3 8 7 s-3 6-8 6"/><path d="M14 18 h20 M24 18 v-6 M20 12 h8"/>',
    minaret: '<path d="M24 4 L20 14 H28 Z"/><path d="M21 14 V44 H27 V14"/><path d="M18 24 H30"/><path d="M8 44 v-10 a8 8 0 0 1 16 0 M24 44 h18 v-8 a9 9 0 0 0-18 0"/>',
    house: '<path d="M6 22 L24 8 L42 22"/><path d="M10 20 V42 H38 V20"/><path d="M14 26 h7 v7 h-7 Z M27 26 h7 v7 h-7 Z M21 42 v-7 h6 v7"/>',
    spring: '<path d="M24 6 C18 16 14 21 14 27 a10 10 0 0 0 20 0 c0-6-4-11-10-21Z"/><path d="M6 44 c6-4 10-4 18 0 s12 4 18 0"/>',
    falls: '<path d="M6 10 H42"/><path d="M12 10 c0 10 2 18 0 28 M20 10 c0 10 2 18 0 28 M28 10 c0 10 2 18 0 28 M36 10 c0 10 2 18 0 28"/><path d="M4 42 c6 3 12 3 20 0 s14-3 20 0"/>'
  };
  function icon(name) {
    return '<svg class="pin" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICON[name] || ICON.bridge) + '</svg>';
  }

  window.MOSTAR_ART = { sky: sky, mountains: mountains, town: town, bridge: bridge, cliffLeft: function () { return cliff('left'); }, cliffRight: function () { return cliff('right'); }, river: river, icon: icon };
})();
