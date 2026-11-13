/* Mostarly admin: planner (enquiries, calendar, plan), tours, prices, photos and reviews. Changes to tours
   and reviews are published to the site at once. */
(function () {
  'use strict';
  var app = document.getElementById('app'), toastEl = document.getElementById('toast');
  var S = null;            // everything from /api/admin/state
  var draft = null;        // the tour or review being edited (a copy)
  var dirty = false, saving = false;

  var BASIS = { person: 'po osobi', group: 'po grupi', request: 'cijena na upit' };
  var BASIS_EN = { person: 'per person', group: 'per group' };
  var SOURCES = ['Tripadvisor', 'Google', 'GetYourGuide', 'Viator', 'Airbnb', 'Email / poruka', 'Drugo'];

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function get(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function set(o, p, v) { var ks = p.split('.'), last = ks.pop(); var t = ks.reduce(function (a, k) { if (a[k] == null || typeof a[k] !== 'object') a[k] = /^\d+$/.test(k) ? [] : {}; return a[k]; }, o); t[last] = v; }
  function imgUrl(s) { return !s ? '' : /^(\/|https?:)/.test(s) ? s : '/img/' + s; }
  function toast(msg, err) { toastEl.textContent = msg; toastEl.className = 'on' + (err ? ' err' : ''); clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.className = ''; }, err ? 5000 : 2600); }
  function api(method, path, body, raw) {
    var o = { method: method, headers: { 'x-mly-admin': '1' }, credentials: 'same-origin' };
    if (raw) { o.body = raw.body; o.headers['content-type'] = raw.type; }
    else if (body !== undefined) { o.body = JSON.stringify(body); o.headers['content-type'] = 'application/json'; }
    return fetch('/api/admin' + path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('Greška ' + r.status)); e.data = j; e.status = r.status; throw e; } return j; });
    });
  }
  function priceText(p) {
    if (!p || p.basis === 'request') return 'Price on request';
    return (p.from ? 'from ' : '') + '€' + (p.amount || 0) + ' ' + (BASIS_EN[p.basis] || '');
  }
  function catName(id) { var c = (S.categories || []).filter(function (x) { return x.id === id; })[0]; return c ? c.name : ''; }
  function setDirty(v) { dirty = v; var b = $('.savebar'); if (b && !b.classList.contains('new')) b.classList.toggle('show', !!v); }
  function load() { return api('GET', '/state').then(function (j) { S = j; }); }

  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  var lastHash = location.hash;
  window.addEventListener('hashchange', function () {
    if (dirty && !confirm('Imate nesačuvane izmjene. Želite li izaći bez snimanja?')) { history.replaceState(null, '', lastHash); return; }
    setDirty(false); route();
  });

  /* ---------- layout ---------- */
  function shell(tab, inner) {
    if (typeof OPEN !== 'undefined') document.querySelectorAll('details[data-sec]').forEach(function (d) { OPEN[(location.hash.split('?')[0]) + '|' + d.getAttribute('data-sec')] = d.open; });
    var t = S.tours.length, r = S.reviews.length, m = S.media.length, n = (typeof newCount === 'function') ? newCount() : 0;
    var tabs = [['planer', 'Planer', n ? '<i class="dot">' + n + '</i>' : ''], ['ture', 'Ture', '<span>' + t + '</span>'], ['recenzije', 'Recenzije', '<span>' + r + '</span>'], ['slike', 'Slike', '<span>' + m + '</span>'], ['vise', 'Više', '']];
    var icons = { planer: 'cal', ture: 'tours', recenzije: 'star', slike: 'photo', vise: 'more' };
    var editing = /^#\/(planer|ture|recenzije|vise)\/.+/.test(location.hash);
    app.innerHTML = '<header class="top"><a class="brand" href="#/planer" aria-label="Mostarly admin, početna"><img src="/img/logo-light.png" alt="Mostarly Guide" width="137" height="28"><small>Admin</small></a>' +
      '<nav class="tabs" aria-label="Dijelovi">' + tabs.map(function (x) { return '<a href="#/' + x[0] + '"' + (tab === x[0] ? ' class="on"' : '') + '>' + x[1] + x[2] + '</a>'; }).join('') + '</nav>' +
      '<div class="who"><span class="em">' + esc(S.email) + '</span><button type="button" class="tbtn round" data-theme-toggle aria-label="Svijetla ili tamna tema" title="Svijetla ili tamna tema">' + IC.moon + IC.sun + '</button><a class="tbtn" href="/" target="_blank" rel="noopener" title="Otvori sajt">' + IC.ext + '<span class="lbl">Sajt</span></a></div></header><main class="v-' + tab + '">' + inner + '</main>' +
      (editing ? '' : '<nav class="bnav" aria-label="Dijelovi">' + tabs.map(function (x) { return '<a href="#/' + x[0] + '"' + (tab === x[0] ? ' class="on" aria-current="page"' : '') + '>' + IC[icons[x[0]]] + '<span>' + x[1] + '</span>' + (x[0] === 'planer' && n ? '<i>' + n + '</i>' : '') + '</a>'; }).join('') + '</nav>');
    document.body.classList.toggle('has-bnav', !editing);
    document.documentElement.classList.remove('locked');
    enhanceSelects();
  }
  // a section of a form that opens and closes; it remembers what was open while you edit
  var OPEN = {};
  function sec(id, title, summary, open) {
    var k = (location.hash.split('?')[0]) + '|' + id; if (k in OPEN) open = OPEN[k];
    return '<details class="card sec" data-sec="' + id + '"' + (open ? ' open' : '') + '><summary><span class="sh"><h2>' + title + '</h2><small>' + summary + '</small></span><span class="sx">' + IC.chevd + '</span></summary><div class="sb">';
  }
  document.addEventListener('toggle', function (e) { var d = e.target; if (d.matches && d.matches('details[data-sec]')) OPEN[(location.hash.split('?')[0]) + '|' + d.getAttribute('data-sec')] = d.open; }, true);
  // save bar: for something new it is always there (Odustani / Dodaj); for an existing item it slides up only after a change (Otkaži / Sačuvaj)
  function savebar(isNew, label) {
    return '<div class="savebar' + (isNew || dirty ? ' show' : '') + (isNew ? ' new' : '') + '"><div class="in"><span class="st">' + (isNew ? '' : 'Nesačuvane izmjene') + '</span><span class="spacer"></span><button type="button" class="btn line" data-cancel>' + (isNew ? 'Odustani' : 'Otkaži') + '</button><button type="button" class="btn mint" data-save>' + label + '</button></div></div>';
  }
  function phead(title, sub, action) { return '<div class="phead"><h1>' + title + '</h1>' + (action || '') + '<p class="sub">' + sub + '</p></div>'; }
  function ehead(href, label, title, extra) { return '<div class="ehead"><a class="back" href="' + href + '" aria-label="' + esc(label) + '" title="' + esc(label) + '">' + IC.back + '</a><h1>' + title + '</h1>' + (extra || '') + '</div>'; }
  function reorder(i, n, a, b) { return '<div class="ord"><button type="button" ' + a + '="' + i + '" aria-label="Pomjeri gore"' + (i === 0 ? ' disabled' : '') + '>' + IC.up + '</button><button type="button" ' + b + '="' + i + '" aria-label="Pomjeri dole"' + (i === n - 1 ? ' disabled' : '') + '>' + IC.down + '</button></div>'; }

  /* ---------- bottom sheet: one component for photos and dropdowns. The page behind it does not scroll. ---------- */
  function sheet(title, body) {
    var wrap = document.createElement('div'); wrap.className = 'modal'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', title);
    wrap.innerHTML = '<div class="box"><div class="mh"><h2>' + esc(title) + '</h2><button type="button" class="icon" data-close aria-label="Zatvori">' + IC.x + '</button></div><div class="mb">' + body + '</div></div>';
    document.body.appendChild(wrap); document.documentElement.classList.add('locked');
    function close() { wrap.remove(); if (!$('.modal')) document.documentElement.classList.remove('locked'); document.removeEventListener('keydown', esc_); }
    function esc_(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc_);
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
    // touches on the dark backdrop must not scroll the page (iOS)
    wrap.addEventListener('touchmove', function (e) { if (!e.target.closest('.mb')) e.preventDefault(); }, { passive: false });
    var f = $('[data-close]', wrap); if (f) f.focus({ preventScroll: true });
    return { el: wrap, close: close };
  }
  // every <select> in a form becomes a button that opens a clear list from the bottom
  function enhanceSelects() {
    $$('#ed select').forEach(function (sel) {
      if (sel.classList.contains('dd-native')) return;
      sel.classList.add('dd-native');
      var b = document.createElement('button'); b.type = 'button'; b.className = 'dd';
      var lab = sel.closest('.f'), title = lab && lab.querySelector('span') ? lab.querySelector('span').textContent : 'Izaberite';
      var show = function () { var o = sel.options[sel.selectedIndex]; b.innerHTML = '<span>' + esc(o ? o.text : '') + '</span>' + IC.chevd; };
      show(); sel.after(b);
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var sh = sheet(title, '<div class="opts">' + Array.prototype.map.call(sel.options, function (o, i) { return '<button type="button" data-i="' + i + '" class="' + (i === sel.selectedIndex ? 'on' : '') + '"><span>' + esc(o.text) + '</span>' + IC.check + '</button>'; }).join('') + '</div>');
        sh.el.addEventListener('click', function (ev) {
          var x = ev.target.closest('[data-i]'); if (!x) return;
          sel.selectedIndex = +x.getAttribute('data-i'); show(); sh.close();
          sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    });
  }
  // light or dark theme, remembered on this device
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-theme-toggle]')) return;
    var root = document.documentElement, cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next); try { localStorage.setItem('mly-admin-theme', next); } catch (er) {}
  });

  /* ---------- tours list ---------- */
  function toursList() {
    var rows = S.tours.map(function (t, i) {
      var d = t.data;
      var badges = (t.hidden ? '<span class="badge">Skrivena</span>' : '') + (d.featured ? '<span class="badge ok">Na početnoj</span>' : '') + (d.price && !d.price.confirmed ? '<span class="badge warn">Potvrdi cijenu</span>' : '') +
        ((d.notes || []).length ? '<span class="badge warn">' + d.notes.length + ' napomen' + (d.notes.length === 1 ? 'a' : 'e') + '</span>' : '');
      return '<div class="item' + (t.hidden ? ' hid' : '') + '" data-slug="' + esc(t.slug) + '"><a class="ilink" href="#/ture/' + esc(t.slug) + '">' +
        '<div class="th">' + (d.image ? '<img src="' + esc(imgUrl(d.image)) + '" alt="" loading="lazy">' : esc((d.name || '?').charAt(0))) + '</div>' +
        '<div class="ib"><b>' + esc(d.name) + '</b><div class="meta"><span>' + esc(catName(d.category)) + '</span><span>·</span><span>' + esc(priceText(d.price)) + '</span></div>' + (badges ? '<div class="badges">' + badges + '</div>' : '') + '</div>' +
        '<span class="chev">' + IC.chev + '</span></a>' + reorder(i, S.tours.length, 'data-up', 'data-down') + '</div>';
    }).join('');
    shell('ture', phead('Ture', 'Dodirnite turu da je uredite. Strelicama mijenjate redoslijed na sajtu.', '<a class="btn mint sm" href="#/ture/nova">' + IC.plus + 'Nova tura</a>') +
      '<div class="list">' + (rows || '<p class="empty">' + IC.tours + 'Još nema tura.</p>') + '</div>');
    $$('[data-up],[data-down]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +(b.getAttribute('data-up') || b.getAttribute('data-down')), j = b.hasAttribute('data-up') ? i - 1 : i + 1;
        var a = S.tours.slice(); var x = a[i]; a[i] = a[j]; a[j] = x; S.tours = a; toursList();
        api('POST', '/tours/order', { slugs: a.map(function (t) { return t.slug; }) }).then(function () { toast('Redoslijed sačuvan'); }).catch(function (e) { toast(e.message, true); });
      });
    });
  }

  /* ---------- form pieces ---------- */
  function field(label, path, o) {
    o = o || {};
    var v = get(draft, path); v = v == null ? '' : v;
    var count = o.max ? '<i data-count="' + path + '">' + String(v).length + ' / ' + o.max + '</i>' : '';
    var input = o.area ? '<textarea data-path="' + path + '" rows="' + (o.rows || 4) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '>' + esc(v) + '</textarea>'
      : '<input type="' + (o.num ? 'number' : 'text') + '"' + (o.num ? ' inputmode="decimal" min="0" step="1"' : '') + ' data-path="' + path + '"' + (o.num ? ' data-num' : '') + ' value="' + esc(v) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '>';
    return '<label class="f"><span>' + esc(label) + count + '</span>' + input + (o.hint ? '<small>' + esc(o.hint) + '</small>' : '') + '</label>';
  }
  function toggle(label, path, hint, invert) {
    var v = !!get(draft, path); if (invert) v = !v;
    return '<label class="tog"><input type="checkbox" data-path="' + path + '" data-bool' + (invert ? ' data-invert' : '') + (v ? ' checked' : '') + '><span class="sw"></span><span>' + esc(label) + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</span></label>';
  }
  function listEditor(title, path, ph, withOptional) {
    var arr = get(draft, path) || [];
    var rows = arr.map(function (it, i) {
      var text = withOptional ? it.text : it;
      return '<div class="li"><span class="n">' + (i + 1) + '</span><textarea data-path="' + path + '.' + i + (withOptional ? '.text' : '') + '" rows="1" placeholder="' + esc(ph) + '" aria-label="' + esc(title) + ' ' + (i + 1) + '">' + esc(text) + '</textarea>' +
        '<div class="ctl">' + (withOptional ? '<label class="opt"><input type="checkbox" data-path="' + path + '.' + i + '.optional" data-bool' + (it.optional ? ' checked' : '') + '><span>Opcionalno</span></label>' : '') + '<span class="spacer"></span>' +
        '<button type="button" class="icon" data-lmove="' + path + '|' + i + '|-1" aria-label="Pomjeri gore"' + (i === 0 ? ' disabled' : '') + '>' + IC.up + '</button><button type="button" class="icon" data-lmove="' + path + '|' + i + '|1" aria-label="Pomjeri dole"' + (i === arr.length - 1 ? ' disabled' : '') + '>' + IC.down + '</button><button type="button" class="icon del" data-ldel="' + path + '|' + i + '" aria-label="Obriši">' + IC.trash + '</button></div></div>';
    }).join('');
    return '<div class="f"><span>' + esc(title) + '</span><div class="le" data-list="' + path + '">' + rows + '<button type="button" class="add" data-ladd="' + path + '|' + (withOptional ? 1 : 0) + '">' + IC.plus + 'Dodaj</button></div></div>';
  }

  /* ---------- tour editor ---------- */
  function emptyTour() {
    return { name: '', category: (S.categories[0] || {}).id, featured: false, tagline: '', description: '', image: '', imageAlt: '', gallery: [], price: { amount: 0, basis: 'person', from: false, confirmed: true }, duration: '', location: 'Mostar', groupSize: '', level: '', languages: 'English', meetingPoint: '', availability: 'By prior arrangement', itinerary: [], included: ['Licensed local guide'], notIncluded: [], practical: [], tickets: [], notes: [], seoTitle: '', seoDescription: '' };
  }
  function tourEditor(slug) {
    var isNew = slug === 'nova', t = isNew ? null : S.tours.filter(function (x) { return x.slug === slug; })[0];
    if (!isNew && !t) { location.hash = '#/ture'; return; }
    draft = isNew ? { data: emptyTour(), hidden: false } : { data: clone(t.data), hidden: t.hidden };
    if (!draft.data.price) draft.data.price = { basis: 'request' };
    renderTour(isNew, slug);
  }
  function renderTour(isNew, slug) {
    var d = draft.data, p = d.price;
    var cats = S.categories.map(function (c) { return '<option value="' + esc(c.id) + '"' + (d.category === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
    var notes = (d.notes || []).length ? sec('notes', d.notes.length + (d.notes.length === 1 ? ' napomena' : ' napomene') + ' za provjeru', 'Dodirnite da vidite šta treba potvrditi', false).replace('card sec', 'card sec notes') + '<ul>' + d.notes.map(function (n, i) { return '<li><span>' + esc(n) + '</span><button type="button" class="btn sm line" data-note="' + i + '">Riješeno ✓</button></li>'; }).join('') + '</ul><small>Kad nešto riješite, kliknite "Riješeno" pa sačuvajte. Žuta napomena tada nestaje i sa sajta.</small></div></details>' : '';
    var tickets = S.tickets.map(function (k) { return '<label><input type="checkbox" data-ticket="' + esc(k.id) + '"' + ((d.tickets || []).indexOf(k.id) > -1 ? ' checked' : '') + '>' + esc(k.label) + '<em>€' + k.price + '</em></label>'; }).join('');
    var gal = (d.gallery || []).map(function (g, i) { return '<div class="g"><img src="' + esc(imgUrl(g.src)) + '" alt=""><button type="button" class="mv" data-gmain="' + i + '" title="Postavi kao glavnu" aria-label="Postavi kao glavnu">' + IC.star + '</button><button type="button" data-gdel="' + i + '" aria-label="Ukloni">' + IC.x + '</button></div>'; }).join('');
    shell('ture', ehead('#/ture', 'Nazad na sve ture', isNew ? 'Nova tura' : esc(d.name), isNew ? '' : '<a class="back" href="/tours/' + esc(slug) + '/" target="_blank" rel="noopener" aria-label="Pogledaj turu na sajtu" title="Pogledaj na sajtu">' + IC.ext + '</a>') + '<p class="sub esub">' + (isNew ? 'Popunite osnovno i sačuvajte. Ostalo možete dodati kasnije.' : 'Tekst na sajtu pišite na engleskom. Nakon snimanja, promjena je odmah na sajtu.') + '</p>' + notes +
      '<form id="ed" autocomplete="off" novalidate>' +
      sec('osnovno', 'Osnovno', esc(catName(d.category) || 'Bez kategorije'), isNew) + '' + field('Naziv ture', 'data.name', { max: 160, ph: 'e.g. Mostar City Tour – Highlights of the Old Town' }) +
      '<label class="f"><span>Kategorija</span><select data-path="data.category">' + cats + '</select></label>' +
      field('Kratki opis (ispod naslova i na kartici)', 'data.tagline', { area: true, rows: 2, max: 400 }) + field('Opis ture', 'data.description', { area: true, rows: 6, max: 5000 }) + '' + '</div></details>' +
      sec('cijena', 'Cijena', esc(priceText(p)) + (p.confirmed === false ? ' · za potvrdu' : ''), isNew) + '<p class="help">Svaka cijena mora reći da li je po osobi ili po grupi.</p>' +
      '<div class="f"><span>Kako se plaća</span><div class="seg">' + ['person', 'group', 'request'].map(function (b) { return '<label><input type="radio" name="basis" value="' + b + '"' + (p.basis === b ? ' checked' : '') + '><span>' + BASIS[b] + '</span></label>'; }).join('') + '</div></div>' +
      (p.basis !== 'request' ? '<div class="two">' + field('Iznos u eurima', 'data.price.amount', { num: true }) + '<div>' + toggle('Prikaži kao "od"', 'data.price.from', 'npr. "from €40 per person"') + '</div></div>' : '') +
      toggle('Cijena je potvrđena', 'data.price.confirmed', 'Dok nije, na sajtu stoji oznaka "to confirm".') +
      '<div class="preview" id="pprev">Na sajtu: <b>' + esc(priceText(p)) + '</b></div>' + '</div></details>' +
      sec('slike', 'Slike', (d.image ? 'Glavna slika' : 'Bez glavne slike') + ' · ' + (d.gallery || []).length + ' u galeriji', false) + '<div class="photo"><div class="pv">' + (d.image ? '<img src="' + esc(imgUrl(d.image)) + '" alt="">' : 'Nema glavne slike<br>(prikazuje se ćilim šara)') + '</div><div>' +
      '<div class="row"><button type="button" class="btn sm" data-pickmain>' + (d.image ? 'Promijeni glavnu sliku' : 'Dodaj glavnu sliku') + '</button>' + (d.image ? '<button type="button" class="btn sm line" data-nomain>Ukloni</button>' : '') + '</div>' +
      field('Opis slike (za slijepe i za Google)', 'data.imageAlt', { ph: 'e.g. The Old Bridge at sunset', max: 200 }) + '</div></div>' +
      '<div class="f" style="margin-top:1.1rem"><span>Galerija na stranici ture</span><div class="gal">' + gal + '<button type="button" class="addg" data-pickgal>' + IC.plus + 'Dodaj slike</button></div><small>Zvjezdica na slici je postavlja kao glavnu.</small></div>' + '</div></details>' +
      sec('detalji', 'Detalji', esc([d.duration, d.location].filter(Boolean).join(' · ') || 'Nije popunjeno'), false) + '<div class="two">' + field('Trajanje', 'data.duration', { ph: 'About 2 hours' }) + field('Lokacija', 'data.location', { ph: 'Old Town, Mostar' }) + field('Veličina grupe', 'data.groupSize', { ph: '2–20 people' }) + field('Jezici', 'data.languages', { ph: 'English' }) + '</div>' +
      field('Težina hodanja', 'data.level', { ph: 'Easy: uneven cobblestones and some steps' }) + field('Dostupnost', 'data.availability', { ph: 'Daily, by prior arrangement' }) + field('Mjesto sastanka', 'data.meetingPoint', { ph: 'In front of the Hamam, Old Town' }) + '' + '</div></details>' +
      sec('program', 'Program ture', (d.itinerary || []).length + ' stanica', false) + '<p class="help">Redom kako gosti obilaze. "opc." znači da stanica ovisi o sezoni ili željama.</p>' + listEditor('Stanice', 'data.itinerary', 'e.g. Meet in front of the Hamam.', true) + '' + '</div></details>' +
      sec('ukljuceno', 'Šta je uključeno', (d.included || []).length + ' uključeno · ' + (d.notIncluded || []).length + ' posebno · ' + (d.practical || []).length + ' savjeta', false) + '' + listEditor('Uključeno', 'data.included', 'e.g. Licensed local guide') + listEditor('Nije uključeno / plaća se posebno', 'data.notIncluded', 'e.g. Entrance tickets') + listEditor('Dobro je znati', 'data.practical', 'e.g. Wear comfortable shoes.') + '' + '</div></details>' +
      sec('ulaznice', 'Ulaznice u formi za upit', (d.tickets || []).length + ' izabrano', false) + '<p class="help">Gosti ih mogu označiti kad šalju upit za ovu turu.</p><div class="ticks">' + tickets + '</div>' + '</div></details>' +
      sec('prikaz', 'Prikaz', (draft.hidden ? 'Sakrivena' : 'Vidljiva na sajtu') + (d.featured ? ' · na početnoj' : ''), false) + '' + toggle('Prikaži turu na sajtu', 'hidden', 'Isključeno: tura je sakrivena, ali ostaje ovdje sačuvana.', true) + toggle('Istakni na početnoj stranici', 'data.featured', 'Među "Featured tours" na vrhu početne.') + '' + '</div></details>' +
      sec('google', 'Za Google', d.seoTitle || d.seoDescription ? 'Naslov i opis su upisani' : 'Nije popunjeno: koristi se naziv ture', false) + '<p class="help">Kako tura izgleda u Google pretrazi.</p>' + field('Naslov u Googleu', 'data.seoTitle', { max: 65, hint: 'Do 60 znakova. Ako je prazno, koristi se naziv ture.' }) + field('Opis u Googleu', 'data.seoDescription', { area: true, rows: 3, max: 160, hint: 'Do 155 znakova: šta gost dobije, gdje i koliko traje.' }) + '</div></details>' +
      (isNew ? '' : sec('brisanje', 'Brisanje', 'Trajno brisanje ture', false) + '<p class="help">Ako turu samo želite skloniti sa sajta, isključite "Prikaži turu na sajtu". Brisanje se ne može vratiti.</p><button type="button" class="btn danger" data-deltour>' + IC.trash + 'Obriši turu</button>' + '</div></details>') +
      '</form>' + savebar(isNew, isNew ? 'Objavi' : 'Sačuvaj'));
    bindForm(function () { renderTour(isNew, slug); }, function () { return saveTour(isNew, slug); });
    $$('[name=basis]').forEach(function (r) { r.addEventListener('change', function () { draft.data.price.basis = r.value; if (r.value !== 'request' && draft.data.price.amount == null) draft.data.price.amount = 0; setDirty(true); renderTour(isNew, slug); setDirty(true); }); });
    $$('[data-ticket]').forEach(function (c) { c.addEventListener('change', function () { var id = c.getAttribute('data-ticket'), a = (draft.data.tickets || []).filter(function (x) { return x !== id; }); if (c.checked) a.push(id); draft.data.tickets = a; setDirty(true); }); });
    $$('[data-note]').forEach(function (b) { b.addEventListener('click', function () { draft.data.notes.splice(+b.getAttribute('data-note'), 1); renderTour(isNew, slug); setDirty(true); }); });
    var pm = $('[data-pickmain]'); if (pm) pm.addEventListener('click', function () { picker(false, function (srcs) { draft.data.image = srcs[0]; renderTour(isNew, slug); setDirty(true); }); });
    var nm = $('[data-nomain]'); if (nm) nm.addEventListener('click', function () { draft.data.image = ''; renderTour(isNew, slug); setDirty(true); });
    $('[data-pickgal]').addEventListener('click', function () { picker(true, function (srcs) { draft.data.gallery = (draft.data.gallery || []).concat(srcs.map(function (s) { return { src: s, alt: '' }; })); renderTour(isNew, slug); setDirty(true); }); });
    $$('[data-gdel]').forEach(function (b) { b.addEventListener('click', function () { draft.data.gallery.splice(+b.getAttribute('data-gdel'), 1); renderTour(isNew, slug); setDirty(true); }); });
    $$('[data-gmain]').forEach(function (b) { b.addEventListener('click', function () { var i = +b.getAttribute('data-gmain'), g = draft.data.gallery[i], old = draft.data.image; draft.data.image = g.src; if (old) draft.data.gallery[i] = { src: old, alt: draft.data.imageAlt || '' }; else draft.data.gallery.splice(i, 1); renderTour(isNew, slug); setDirty(true); }); });
    var dt = $('[data-deltour]'); if (dt) dt.addEventListener('click', function () {
      if (!confirm('Obrisati turu "' + draft.data.name + '"? Ovo se ne može vratiti.')) return;
      api('DELETE', '/tours/' + slug).then(function () { setDirty(false); toast('Tura obrisana'); return load(); }).then(function () { location.hash = '#/ture'; }).catch(function (e) { toast(e.message, true); });
    });
  }
  function saveTour(isNew, slug) {
    if (!String(draft.data.name || '').trim()) { toast('Upišite naziv ture.', true); var n = $('[data-path="data.name"]'); if (n) n.focus(); return Promise.resolve(); }
    var req = isNew ? api('POST', '/tours', draft) : api('PUT', '/tours/' + slug, draft);
    return req.then(function (j) {
      setDirty(false); toast('Sačuvano i objavljeno na sajtu ✓');
      return load().then(function () { if (isNew) location.hash = '#/ture/' + j.slug; else tourEditor(slug); });
    });
  }

  /* ---------- shared form binding ---------- */
  function bindForm(rerender, save) {
    var form = $('#ed');
    form.addEventListener('input', function (e) {
      var el = e.target, p = el.getAttribute('data-path'); if (!p) return;
      var v = el.hasAttribute('data-bool') ? (el.hasAttribute('data-invert') ? !el.checked : el.checked) : el.hasAttribute('data-num') ? (el.value === '' ? (p === 'data.price' ? null : 0) : Number(el.value)) : el.value;
      set(draft, p, v); setDirty(true);
      var c = $('[data-count="' + p + '"]'); if (c) { var mx = +c.textContent.split('/ ')[1]; c.textContent = String(el.value).length + ' / ' + mx; c.classList.toggle('over', String(el.value).length > mx); }
      if (p.indexOf('data.price') === 0) { var pp = $('#pprev b'); if (pp) pp.textContent = priceText(draft.data.price); }
      if (el.tagName === 'TEXTAREA' && el.closest('.le')) autoGrow(el);
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    $$('.le textarea').forEach(autoGrow);
    $$('[data-ladd]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-ladd').split('|'), arr = get(draft, a[0]) || []; arr.push(a[1] === '1' ? { text: '', optional: false } : /^obj:/.test(a[1]) ? a[1].slice(4).split(',').reduce(function (o, k) { o[k] = ''; return o; }, {}) : ''); set(draft, a[0], arr); rerender(); setDirty(true); var all = $$('[data-list="' + a[0] + '"] .li'); if (all.length) { var f = all[all.length - 1].querySelector('input[type=text],textarea'); if (f) f.focus(); } }); });
    $$('[data-ldel]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-ldel').split('|'); get(draft, a[0]).splice(+a[1], 1); rerender(); setDirty(true); }); });
    $$('[data-lmove]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-lmove').split('|'), arr = get(draft, a[0]), i = +a[1], j = i + (+a[2]); var x = arr[i]; arr[i] = arr[j]; arr[j] = x; rerender(); setDirty(true); }); });
    var cb = $('[data-cancel]');
    if (cb) cb.addEventListener('click', function () {
      var bar = $('.savebar'), back = $('.ehead .back');
      if (bar && bar.classList.contains('new')) { setDirty(false); location.hash = back ? back.getAttribute('href') : '#/planer'; return; }
      var y = scrollY; setDirty(false); route(); window.scrollTo(0, y); toast('Izmjene otkazane');
    });
    var sb = $('[data-save]'), sbLabel = sb.textContent;
    sb.addEventListener('click', function () {
      if (saving) return; saving = true; sb.disabled = true; sb.textContent = 'Snimam…';
      Promise.resolve(save()).catch(function (e) { toast(e.message, true); }).then(function () { saving = false; var b = $('[data-save]'); if (b) { b.disabled = false; b.textContent = sbLabel; } });
    });
  }
  // checkboxes fire "change", not always "input": treat them the same
  document.addEventListener('change', function (e) {
    var el = e.target; if (!el.matches || !el.matches('#ed input[type=checkbox][data-path]')) return;
    set(draft, el.getAttribute('data-path'), el.hasAttribute('data-invert') ? !el.checked : el.checked); setDirty(true);
    if (el.getAttribute('data-path').indexOf('data.price') === 0) { var pp = $('#pprev b'); if (pp) pp.textContent = priceText(draft.data.price); }
  }, true);
  function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.max(46, el.scrollHeight + 2) + 'px'; }

  /* ---------- photo picker and upload (photos are made smaller in the browser before upload) ---------- */
  function shrink(file) {
    var MAX = 2000;
    return (window.createImageBitmap ? createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(file); }) : Promise.reject(new Error('no bitmap'))).then(function (bmp) {
      var k = Math.min(1, MAX / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
      var c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      return new Promise(function (res) { c.toBlob(function (b) { if (b && b.type === 'image/webp') return res({ blob: b, w: w, h: h }); c.toBlob(function (j) { res({ blob: j, w: w, h: h }); }, 'image/jpeg', 0.85); }, 'image/webp', 0.84); });
    }).catch(function () { return { blob: file, w: 0, h: 0 }; });
  }
  function upload(file) {
    return shrink(file).then(function (r) {
      var q = '?name=' + encodeURIComponent(file.name || 'slika') + '&w=' + r.w + '&h=' + r.h;
      return api('PUT', '/media' + q, undefined, { body: r.blob, type: r.blob.type || file.type });
    });
  }
  function picker(multi, done) {
    var lib = S.media.map(function (m) { return '/media/' + m.key; }).concat(S.bundledImages || []);
    var sh = sheet(multi ? 'Dodaj slike' : 'Izaberi sliku',
      (S.mediaReady ? '<label class="upl"><input type="file" accept="image/*"' + (multi ? ' multiple' : '') + '>' + IC.camera + '<span>Učitaj ' + (multi ? 'slike' : 'sliku') + ' sa telefona</span></label>' : '<p class="empty">Učitavanje slika još nije uključeno (R2). Izaberite jednu od postojećih.</p>') +
      '<p class="mlabel">Ili izaberite postojeću</p><div class="pick">' + lib.map(function (s) { return '<button type="button" data-src="' + esc(s) + '"><img src="' + esc(imgUrl(s)) + '" alt="" loading="lazy"></button>'; }).join('') + '</div>');
    var wrap = sh.el, close = sh.close;
    wrap.addEventListener('click', function (e) { var b = e.target.closest('[data-src]'); if (b) { close(); done([b.getAttribute('data-src')]); } });
    var inp = $('input[type=file]', wrap);
    if (inp) inp.addEventListener('change', function () {
      var files = Array.prototype.slice.call(inp.files || []); if (!files.length) return;
      var lab = $('.upl', wrap), span = $('.upl span', wrap); lab.classList.add('busy');
      var out = [], i = 0;
      (function next() {
        if (i >= files.length) { close(); load().then(function () { done(out); toast(out.length === 1 ? 'Slika učitana' : out.length + ' slika učitano'); }); return; }
        span.textContent = 'Učitavam ' + (i + 1) + ' od ' + files.length + '…';
        upload(files[i]).then(function (j) { out.push(j.url); i++; next(); }).catch(function (e) { lab.classList.remove('busy'); span.textContent = 'Pokušajte ponovo'; toast(e.message, true); });
      })();
    });
  }

  /* ---------- reviews ---------- */
  function reviewsList() {
    var rows = S.reviews.map(function (r, i) {
      var d = r.data;
      return '<div class="item' + (r.hidden ? ' hid' : '') + '"><a class="ilink" href="#/recenzije/' + esc(r.id) + '"><div class="th star">' + IC.star + '</div><div class="ib"><b>' + esc(d.name) + (d.country ? ' · ' + esc(d.country) : '') + '</b><div class="meta"><span style="color:var(--copper)">' + '★'.repeat(d.rating || 5) + '</span><span>' + esc(d.source || '') + '</span>' + (r.hidden ? '<span class="badge">Skrivena</span>' : '') + '</div><div class="meta"><span class="q">' + esc((d.text || '').slice(0, 90)) + '</span></div></div><span class="chev">' + IC.chev + '</span></a>' +
        reorder(i, S.reviews.length, 'data-rup', 'data-rdown') + '</div>';
    }).join('');
    shell('recenzije', phead('Recenzije', 'Prepišite prave recenzije gostiju (npr. sa Tripadvisora), riječ po riječ.', '<a class="btn mint sm" href="#/recenzije/nova">' + IC.plus + 'Nova</a>') + '<div class="list">' + (rows || '<p class="empty">' + IC.star + 'Još nema recenzija. Dok ih nema, na sajtu stoje prazna mjesta.</p>') + '</div>');
    $$('[data-rup],[data-rdown]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +(b.getAttribute('data-rup') || b.getAttribute('data-rdown')), j = b.hasAttribute('data-rup') ? i - 1 : i + 1;
        var a = S.reviews.slice(); var x = a[i]; a[i] = a[j]; a[j] = x; S.reviews = a; reviewsList();
        api('POST', '/reviews/order', { ids: a.map(function (r) { return r.id; }) }).then(function () { toast('Redoslijed sačuvan'); }).catch(function (e) { toast(e.message, true); });
      });
    });
  }
  function reviewEditor(id) {
    var isNew = id === 'nova', r = isNew ? null : S.reviews.filter(function (x) { return x.id === id; })[0];
    if (!isNew && !r) { location.hash = '#/recenzije'; return; }
    draft = isNew ? { data: { name: '', country: '', date: '', rating: 5, title: '', text: '', source: 'Tripadvisor' }, hidden: false } : { data: clone(r.data), hidden: r.hidden };
    renderReview(isNew, id);
  }
  function renderReview(isNew, id) {
    var d = draft.data;
    shell('recenzije', ehead('#/recenzije', 'Nazad na recenzije', isNew ? 'Nova recenzija' : esc(d.name)) + '<p class="sub esub">Tekst prepišite tačno kako ga je gost napisao.</p><form id="ed" autocomplete="off" novalidate><section class="card">' +
      '<div class="two">' + field('Ime gosta', 'data.name', { ph: 'e.g. Anna K.' }) + field('Zemlja', 'data.country', { ph: 'e.g. Germany' }) + field('Datum', 'data.date', { ph: 'e.g. October 2026' }) +
      '<label class="f"><span>Izvor</span><select data-path="data.source">' + SOURCES.map(function (s) { return '<option' + (d.source === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="f"><span>Ocjena</span><div class="stars" role="radiogroup" aria-label="Ocjena">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-star="' + n + '" class="' + (n <= d.rating ? 'on' : '') + '" aria-label="' + n + ' od 5">★</button>'; }).join('') + '</div></div>' +
      field('Naslov recenzije (ako postoji)', 'data.title', { max: 140 }) + field('Tekst recenzije', 'data.text', { area: true, rows: 7, max: 2500 }) +
      toggle('Prikaži na sajtu', 'hidden', '', true) + '</section>' + (isNew ? '' : '<section class="card"><button type="button" class="btn danger" data-delrev>' + IC.trash + 'Obriši recenziju</button></section>') +
      '</form>' + savebar(isNew, isNew ? 'Objavi' : 'Sačuvaj'));
    bindForm(function () { renderReview(isNew, id); }, function () {
      if (!String(d.name).trim() || !String(d.text).trim()) { toast('Upišite ime i tekst recenzije.', true); return Promise.resolve(); }
      return (isNew ? api('POST', '/reviews', draft) : api('PUT', '/reviews/' + id, draft)).then(function (j) { setDirty(false); toast('Sačuvano i objavljeno na sajtu ✓'); return load().then(function () { location.hash = '#/recenzije'; }); });
    });
    $$('[data-star]').forEach(function (b) { b.addEventListener('click', function () { draft.data.rating = +b.getAttribute('data-star'); $$('[data-star]').forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-star') <= draft.data.rating); }); setDirty(true); }); });
    var del = $('[data-delrev]'); if (del) del.addEventListener('click', function () {
      if (!confirm('Obrisati ovu recenziju?')) return;
      api('DELETE', '/reviews/' + id).then(function () { setDirty(false); toast('Recenzija obrisana'); return load(); }).then(function () { location.hash = '#/recenzije'; }).catch(function (e) { toast(e.message, true); });
    });
  }

  /* ---------- photos library ---------- */
  function mediaList() {
    var kb = function (n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; };
    shell('slike', phead('Slike', 'Sve učitane slike. Prije učitavanja se same smanje, da sajt ostane brz.', S.mediaReady ? '<label class="btn mint sm">' + IC.plus + 'Učitaj<input type="file" accept="image/*" multiple hidden id="mup"></label>' : '') +
      (S.media.length ? '<div class="media-grid">' + S.media.map(function (m) { return '<div class="m"><img src="/media/' + esc(m.key) + '" alt="" loading="lazy"><div><span title="' + esc(m.name) + '">' + esc(m.name) + ' · ' + kb(m.size) + '</span><button class="icon" data-mdel="' + esc(m.key) + '" aria-label="Obriši">' + IC.trash + '</button></div></div>'; }).join('') + '</div>' : '<p class="empty">' + IC.photo + 'Još nema učitanih slika. Slike dodajete i direktno iz ture.</p>'));
    var up = $('#mup'); if (up) up.addEventListener('change', function () {
      var files = Array.prototype.slice.call(up.files || []), i = 0; if (!files.length) return;
      (function next() { if (i >= files.length) { load().then(function () { mediaList(); toast('Učitano ✓'); }); return; } toast('Učitavam ' + (i + 1) + ' od ' + files.length + '…'); upload(files[i]).then(function () { i++; next(); }).catch(function (e) { toast(e.message, true); }); })();
    });
    $$('[data-mdel]').forEach(function (b) { b.addEventListener('click', function () {
      var key = b.getAttribute('data-mdel'); if (!confirm('Obrisati sliku?')) return;
      api('DELETE', '/media/' + encodeURIComponent(key)).catch(function (e) {
        if (e.status === 409 && confirm(e.message + '\n\nObrisati je svejedno? Na turi će ostati prazno mjesto.')) return api('DELETE', '/media/' + encodeURIComponent(key) + '?force=1');
        throw e;
      }).then(function (r) { if (r) { toast('Slika obrisana'); return load().then(mediaList); } }).catch(function (e) { toast(e.message, true); });
    }); });
  }


  /* =====================================================================
     PLANER: enquiries from the site, bookings Mirna adds herself, calendar and plan
     ===================================================================== */
  var B = [];                                   // bookings
  var PV = { view: 'upiti', filter: 'open', q: '', month: null, day: null };
  var MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
  var DAYS = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];
  var ST = { new: 'Novo', replied: 'Odgovoreno', confirmed: 'Potvrđeno', done: 'Završeno', cancelled: 'Otkazano' };
  var SRC = { 'site-email': 'Sajt · email', 'site-whatsapp': 'Sajt · WhatsApp', instagram: 'Instagram', whatsapp: 'WhatsApp', phone: 'Telefon', email: 'Email', agency: 'Agencija', walkin: 'Uživo', other: 'Drugo' };
  var IC = {
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 19c.8-3.2 3.2-5 6-5s5.2 1.8 6 5M16 5.5a3 3 0 0 1 0 6M18 14c1.6.6 2.6 2 3 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10" r="2.3" fill="currentColor"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.3 20.7l4.4-1.1A8.8 8.8 0 1 0 12 3.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 8.3c.2-.4.5-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .5-.1.7l-.5.6c.6 1.1 1.4 1.9 2.6 2.5l.6-.6c.2-.2.4-.2.7-.1l1.6.7c.2.1.4.3.4.5v.5c0 .3-.2.6-.5.8-.6.4-1.4.5-2.3.2-2.3-.8-4.2-2.7-5-5-.3-.9-.2-1.7.1-2.3z" fill="currentColor"/></svg>',
    ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5h2.6l1.4 4.1-2 1.4a12 12 0 0 0 6.4 6.4l1.4-2 4.1 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    brief: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7" width="17" height="12.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    walk: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4.8" r="1.8" fill="currentColor"/><path d="M10 21l2-6 3 3v3M8 12l3-4.5 3.5 1.5L16 12h2.5M12 15l-1.5-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    dots: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18" cy="12" r="1.6" fill="currentColor"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    gcal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    tours: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18c3-6 6-9 9-9s6 3 9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 18h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 18c1-2.6 2.6-4 4-4s3 1.4 4 4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.8 2.5 5.2 5.6.7-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="16.75" cy="16.75" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="5.5" y="11" width="3.2" height="6.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="10.4" y="6.5" width="3.2" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="15.3" y="9" width="3.2" height="8.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17H10l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 9.5h8M8 12.5h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    block: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10h17M8 3v4M16 3v4M9.5 13.5l5 5M14.5 13.5l-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    text: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M12 6v13M8.5 19h7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    moon: '<svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    sun: '<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12.5" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    photo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="m4.5 17 4.5-4 3 2.5 3-3 4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'
  };
  var SRC_IC = { 'site-email': 'globe', 'site-whatsapp': 'globe', instagram: 'ig', whatsapp: 'wa', phone: 'phone', email: 'mail', agency: 'brief', walkin: 'walk', other: 'dots' };

  // dates are worked out in Mostar time
  function localISO(d) { var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sarajevo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()); return p; }
  function todayISO() { return localISO(new Date()); }
  function addDays(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dObj(iso) { return new Date(iso + 'T12:00:00Z'); }
  function fmtDay(iso, long) { if (!iso) return 'Datum fleksibilan'; var d = dObj(iso); return (long ? cap(DAYS[d.getUTCDay()]) + ', ' : '') + d.getUTCDate() + '. ' + MONTHS[d.getUTCMonth()].slice(0, long ? 99 : 3) + (long && d.getUTCFullYear() !== dObj(todayISO()).getUTCFullYear() ? ' ' + d.getUTCFullYear() : ''); }
  function relDay(iso) { var t = todayISO(); if (iso === t) return 'Danas'; if (iso === addDays(t, 1)) return 'Sutra'; if (iso === addDays(t, -1)) return 'Jučer'; return fmtDay(iso, true); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function ago(ts) {
    var t = new Date(String(ts).replace(' ', 'T') + 'Z').getTime(), s = (Date.now() - t) / 1000;
    if (s < 60) return 'upravo'; if (s < 3600) return 'prije ' + Math.floor(s / 60) + ' min'; if (s < 86400) return 'prije ' + Math.floor(s / 3600) + ' h';
    var iso = localISO(new Date(t)); return iso === addDays(todayISO(), -1) ? 'jučer' : fmtDay(iso);
  }
  function timeText(t) { var m = { Morning: 'jutro', Midday: 'podne', Afternoon: 'popodne', Evening: 'veče' }; return !t ? '' : m[t] || t; }
  function guests(d) { var a = d.adults || 0, c = d.children || 0; return (a || c) ? (a + (c ? ' + ' + c : '')) : '?'; }
  function shortTour(d) { var t = (S.tours.filter(function (x) { return x.slug === d.tourSlug; })[0] || {}).data; var n = (t && t.name) || d.tour || 'Tura po dogovoru'; var p = n.split(' – '); return p[0] === 'Mostar City Tour' && p[1] ? p[1] : p[0]; }
  function digits(p) { return String(p || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, ''); }
  function firstName(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }

  function loadBookings() { return api('GET', '/bookings').then(function (j) { B = j.bookings || []; }).catch(function () { B = B || []; }); }
  function newCount() { return B.filter(function (b) { return b.status === 'new'; }).length; }

  function bkCard(b) {
    var d = b.data;
    return '<a class="bk st-' + b.status + '" href="#/planer/' + esc(b.id) + '"><span class="bar"></span><div class="bk-main"><div class="bk-top"><b>' + esc(d.name || 'Bez imena') + '</b><span class="pill st-' + b.status + '">' + ST[b.status] + '</span></div>' +
      '<span class="bk-tour">' + esc(shortTour(d)) + '</span><div class="bk-meta"><span>' + IC.cal + (b.date ? esc(fmtDay(b.date)) : 'fleksibilno') + (d.time ? ' · ' + esc(timeText(d.time)) : '') + '</span><span>' + IC.users + guests(d) + '</span><span class="src" title="' + esc(SRC[b.source] || '') + '">' + IC[SRC_IC[b.source] || 'dots'] + esc(SRC[b.source] || '') + '</span></div></div>' +
      '<small class="bk-ago">' + esc(ago(b.created_at)) + '</small></a>';
  }

  function plannerHome() {
    var t = todayISO(), wkEnd = addDays(t, 7), mo = t.slice(0, 7);
    var upcoming = B.filter(function (b) { return b.date && b.date >= t && (b.status === 'confirmed' || b.status === 'replied'); }).sort(function (a, b) { return (a.date + (a.data.time || '')).localeCompare(b.date + (b.data.time || '')); });
    var next = upcoming.filter(function (b) { return b.status === 'confirmed'; })[0];
    var nNew = newCount(), nWeek = B.filter(function (b) { return b.status === 'confirmed' && b.date >= t && b.date < wkEnd; }).length;
    var gMonth = B.filter(function (b) { return (b.status === 'confirmed' || b.status === 'done') && b.date && b.date.slice(0, 7) === mo; }).reduce(function (s, b) { return s + (b.data.adults || 0) + (b.data.children || 0); }, 0);
    var h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sarajevo', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
    var hi = h < 11 ? 'Dobro jutro' : h < 18 ? 'Dobar dan' : 'Dobro veče';
    var view = PV.view === 'kalendar' ? calView() : PV.view === 'plan' ? planView() : inboxView();
    shell('planer', '<section class="hello"><p class="hello-d">' + esc(cap(DAYS[dObj(t).getUTCDay()])) + ', ' + dObj(t).getUTCDate() + '. ' + MONTHS[dObj(t).getUTCMonth()] + '</p><h1>' + hi + ', Mirna</h1></section>' +
      '<div class="kpis"><button type="button" class="kpi' + (nNew ? ' hot' : '') + '" data-kpi="new"><b>' + nNew + '</b><span>' + (nNew === 1 ? 'novi upit' : 'novih upita') + '</span></button><button type="button" class="kpi" data-kpi="week"><b>' + nWeek + '</b><span>potvrđeno<br>ove sedmice</span></button><button type="button" class="kpi" data-kpi="month"><b>' + gMonth + '</b><span>gostiju<br>ovaj mjesec</span></button></div>' +
      (next ? '<a class="next" href="#/planer/' + esc(next.id) + '"><div class="next-d"><b>' + dObj(next.date).getUTCDate() + '</b><span>' + MONTHS[dObj(next.date).getUTCMonth()].slice(0, 3) + '</span></div><div class="next-b"><small>Sljedeća tura · ' + esc(relDay(next.date).indexOf(',') > 0 ? cap(DAYS[dObj(next.date).getUTCDay()]) : relDay(next.date)) + (next.data.time ? ' · ' + esc(timeText(next.data.time)) : '') + '</small><b>' + esc(shortTour(next.data)) + '</b><span>' + IC.users + esc(next.data.name) + ' · ' + guests(next.data) + (next.data.meeting ? ' · ' + esc(next.data.meeting) : '') + '</span></div><span class="next-go">' + IC.chev + '</span></a>' : '') +
      remindersHtml() + '<div class="pseg" role="tablist"><button type="button" role="tab" data-pv="upiti" aria-selected="' + (PV.view === 'upiti') + '">' + IC.mail + 'Upiti' + (nNew ? '<i>' + nNew + '</i>' : '') + '</button><button type="button" role="tab" data-pv="kalendar" aria-selected="' + (PV.view === 'kalendar') + '">' + IC.cal + 'Kalendar</button><button type="button" role="tab" data-pv="plan" aria-selected="' + (PV.view === 'plan') + '">' + IC.plan + 'Plan</button></div>' +
      '<div class="pview">' + view + '</div><a class="fab" href="#/planer/novi' + (PV.view === 'kalendar' && PV.day ? '?d=' + PV.day : '') + '" aria-label="Dodaj upit ili turu">' + IC.plus + '</a>');
    $$('[data-pv]').forEach(function (b) { b.addEventListener('click', function () { PV.view = b.getAttribute('data-pv'); plannerHome(); }); });
    $$('[data-kpi]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-kpi'); if (k === 'new') { PV.view = 'upiti'; PV.filter = 'new'; } else { PV.view = 'plan'; } plannerHome(); }); });
    $$('[data-f]').forEach(function (b) { b.addEventListener('click', function () { PV.filter = b.getAttribute('data-f'); plannerHome(); }); });
    var q = $('#pq'); if (q) q.addEventListener('input', function () { PV.q = q.value; var l = $('#plist'); if (l) l.innerHTML = inboxList(); });
    $$('[data-mon]').forEach(function (b) { b.addEventListener('click', function () { var m = PV.month.split('-'), d = new Date(Date.UTC(+m[0], +m[1] - 1 + (+b.getAttribute('data-mon')), 1)); PV.month = d.toISOString().slice(0, 7); PV.day = null; plannerHome(); }); });
    $$('[data-day]').forEach(function (b) { b.addEventListener('click', function () { PV.day = b.getAttribute('data-day'); plannerHome(); var s = $('#dayl'); if (s && innerWidth < 800) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); });
    var tdy = $('[data-today]'); if (tdy) tdy.addEventListener('click', function () { PV.month = todayISO().slice(0, 7); PV.day = todayISO(); plannerHome(); });
    $$('[data-blk]').forEach(function (b) { b.addEventListener('click', function () { b.disabled = true; toggleBlocked(b.getAttribute('data-blk')).then(plannerHome).catch(function (e) { toast(e.message, true); plannerHome(); }); }); });
    bindReminders();
  }

  var FILTERS = [['open', 'Otvoreno'], ['new', 'Novo'], ['replied', 'Odgovoreno'], ['confirmed', 'Potvrđeno'], ['done', 'Završeno'], ['cancelled', 'Otkazano'], ['all', 'Sve']];
  function inboxList() {
    var q = PV.q.trim().toLowerCase();
    var list = B.filter(function (b) {
      if (PV.filter === 'open' && !(b.status === 'new' || b.status === 'replied' || b.status === 'confirmed')) return false;
      if (PV.filter !== 'open' && PV.filter !== 'all' && b.status !== PV.filter) return false;
      if (!q) return true;
      var d = b.data; return [d.name, d.email, d.phone, d.instagram, shortTour(d), d.message, d.note].join(' ').toLowerCase().indexOf(q) > -1;
    });
    if (PV.filter === 'open') { var order = { new: 0, replied: 1, confirmed: 2 }; list.sort(function (a, b) { return (order[a.status] - order[b.status]) || String(b.created_at).localeCompare(String(a.created_at)); }); }
    return list.length ? list.map(bkCard).join('') : '<div class="pempty"><b>' + (q ? 'Ništa nije pronađeno' : PV.filter === 'new' ? 'Nema novih upita' : 'Ovdje još nema ničega') + '</b><span>Upiti sa sajta stižu ovdje sami. Ono što dođe preko Instagrama, telefona ili uživo, dodajte dugmetom +.</span></div>';
  }
  function inboxView() {
    var count = function (f) { return B.filter(function (b) { return f === 'all' ? true : f === 'open' ? (b.status === 'new' || b.status === 'replied' || b.status === 'confirmed') : b.status === f; }).length; };
    return '<div class="psearch">' + IC.search + '<input id="pq" type="search" placeholder="Traži ime, turu, telefon…" value="' + esc(PV.q) + '" aria-label="Pretraga"></div>' +
      '<div class="pchips">' + FILTERS.map(function (f) { return '<button type="button" data-f="' + f[0] + '" class="' + (PV.filter === f[0] ? 'on' : '') + (f[0] !== 'open' && f[0] !== 'all' ? ' st-' + f[0] : '') + '">' + f[1] + '<i>' + count(f[0]) + '</i></button>'; }).join('') + '</div>' +
      '<div class="plist" id="plist">' + inboxList() + '</div>';
  }
  function calView() {
    if (!PV.month) PV.month = todayISO().slice(0, 7);
    var m = PV.month.split('-'), y = +m[0], mo = +m[1] - 1, first = new Date(Date.UTC(y, mo, 1)), days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(), pad = (first.getUTCDay() + 6) % 7, t = todayISO();
    var by = {}; B.forEach(function (b) { if (b.date && b.date.slice(0, 7) === PV.month && b.status !== 'cancelled') (by[b.date] = by[b.date] || []).push(b); });
    var cells = ''; for (var i = 0; i < pad; i++) cells += '<span class="cd empty"></span>';
    for (var d = 1; d <= days; d++) {
      var iso = PV.month + '-' + String(d).padStart(2, '0'), l = by[iso] || [];
      cells += '<button type="button" class="cd' + (iso === t ? ' today' : '') + (iso === PV.day ? ' sel' : '') + (iso < t ? ' past' : '') + (l.length ? ' has' : '') + (isBlocked(iso) ? ' blk' : '') + '" data-day="' + iso + '" aria-label="' + d + '. ' + MONTHS[mo] + (l.length ? ', ' + l.length + ' upis' : '') + '"><b>' + d + '</b><span class="dots">' + l.slice(0, 4).map(function (b) { return '<i class="st-' + b.status + '"></i>'; }).join('') + '</span></button>';
    }
    var dayList = '';
    if (PV.day) {
      var l2 = B.filter(function (b) { return b.date === PV.day; }).sort(function (a, b) { return String(a.data.time).localeCompare(String(b.data.time)); });
      dayList = '<div class="dayl" id="dayl"><div class="row"><h3>' + esc(relDay(PV.day)) + '</h3><span class="spacer"></span>' + (PV.day >= todayISO() ? '<button type="button" class="btn sm line" data-blk="' + PV.day + '">' + (isBlocked(PV.day) ? 'Oslobodi dan' : IC.block + 'Zauzet dan') + '</button>' : '') + '<a class="btn sm mint" href="#/planer/novi?d=' + PV.day + '">' + IC.plus + 'Dodaj</a></div>' + (isBlocked(PV.day) ? '<p class="blknote">' + IC.block + 'Ovaj dan je označen kao zauzet: gosti ga ne mogu izabrati na sajtu.</p>' : '') + (l2.length ? l2.map(bkCard).join('') : '<p class="pempty"><span>Ovaj dan je slobodan.</span></p>') + '</div>';
    }
    return '<div class="cal"><div class="cal-h"><button type="button" class="icon" data-mon="-1" aria-label="Prethodni mjesec">' + IC.back + '</button><b>' + cap(MONTHS[mo]) + ' ' + y + '</b><button type="button" class="icon" data-mon="1" aria-label="Sljedeći mjesec">' + IC.chev + '</button><span class="spacer"></span><button type="button" class="btn sm line" data-today>Danas</button></div>' +
      '<div class="cal-g">' + ['P', 'U', 'S', 'Č', 'P', 'S', 'N'].map(function (x) { return '<span class="cw">' + x + '</span>'; }).join('') + cells + '</div>' +
      '<div class="legend">' + ['new', 'replied', 'confirmed', 'done'].map(function (s) { return '<span><i class="st-' + s + '"></i>' + ST[s] + '</span>'; }).join('') + '<span><i class="blkdot"></i>Zauzet</span></div></div>' + dayList;
  }
  function planView() {
    var t = todayISO(), list = B.filter(function (b) { return b.date && b.date >= t && b.status !== 'cancelled' && b.status !== 'done'; }).sort(function (a, b) { return (a.date + (a.data.time || '')).localeCompare(b.date + (b.data.time || '')); });
    var flex = B.filter(function (b) { return !b.date && (b.status === 'new' || b.status === 'replied'); });
    var html = '', cur = '';
    list.forEach(function (b) {
      if (b.date !== cur) { if (cur) html += '</div>'; cur = b.date; html += '<div class="pday"><h3><span>' + esc(relDay(b.date)) + '</span><small>' + (relDay(b.date).indexOf(',') < 0 ? esc(fmtDay(b.date, true)) : '') + '</small></h3>'; }
      var d = b.data;
      html += '<a class="pitem st-' + b.status + '" href="#/planer/' + esc(b.id) + '"><span class="pt">' + esc(timeText(d.time) || '—') + '</span><span class="pb"><b>' + esc(shortTour(d)) + '</b><span>' + esc(d.name) + ' · ' + IC.users + guests(d) + (d.meeting ? ' · ' + esc(d.meeting) : '') + '</span></span><span class="pill st-' + b.status + '">' + ST[b.status] + '</span></a>';
    });
    if (cur) html += '</div>';
    if (flex.length) html += '<div class="pday"><h3><span>Bez datuma</span><small>gost još nije odlučio</small></h3>' + flex.map(function (b) { var d = b.data; return '<a class="pitem st-' + b.status + '" href="#/planer/' + esc(b.id) + '"><span class="pt">?</span><span class="pb"><b>' + esc(shortTour(d)) + '</b><span>' + esc(d.name) + ' · ' + IC.users + guests(d) + '</span></span><span class="pill st-' + b.status + '">' + ST[b.status] + '</span></a>'; }).join('') + '</div>';
    return html || '<div class="pempty"><b>Nema zakazanih tura</b><span>Kad potvrdite upit sa datumom, pojaviće se ovdje, poredano po danima.</span></div>';
  }

  /* ---------- one enquiry / booking ---------- */
  function bookingEditor(id, qs) {
    var isNew = id === 'novi', b = isNew ? null : B.filter(function (x) { return x.id === id; })[0];
    if (!isNew && !b) { location.hash = '#/planer'; return; }
    var dd = (qs.match(/d=(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
    draft = isNew ? { status: 'new', source: 'instagram', date: dd, data: { name: '', phone: '', email: '', instagram: '', tourSlug: '', tour: '', time: '', adults: 2, children: 0, ages: '', tickets: [], price: null, paid: false, meeting: '', message: '', note: '' } } : { status: b.status, source: b.source, date: b.date, data: clone(b.data), created_at: b.created_at };
    renderBooking(isNew, id);
  }
  function waText(dr) {
    var d = dr.data, n = firstName(d.name), tour = shortTour(d), when = dr.date ? fmtDay(dr.date, true) : '';
    var date = dr.date ? dObj(dr.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : '';
    if (dr.status === 'confirmed') return 'Hello ' + n + ', this is Mirna from Mostarly Guide. Your tour is confirmed: ' + tour + (date ? ', ' + date : '') + (d.time && /\d/.test(d.time) ? ' at ' + d.time : '') + (d.meeting ? '. Meeting point: ' + d.meeting : '') + '. See you in Mostar!';
    return 'Hello ' + n + ', this is Mirna from Mostarly Guide. Thank you for your enquiry about ' + tour + (date ? ' on ' + date : '') + '. ';
  }
  function gcalUrl(dr) {
    var d = dr.data; if (!dr.date) return '';
    var ymd = dr.date.replace(/-/g, ''), dates;
    if (/^\d{1,2}:\d{2}$/.test(d.time)) { var p = d.time.split(':'), s = ymd + 'T' + p[0].padStart(2, '0') + p[1] + '00', e = new Date(Date.UTC(+dr.date.slice(0, 4), +dr.date.slice(5, 7) - 1, +dr.date.slice(8), +p[0] + 2, +p[1])); dates = s + '/' + e.toISOString().slice(0, 10).replace(/-/g, '') + 'T' + e.toISOString().slice(11, 16).replace(':', '') + '00'; }
    else { dates = ymd + '/' + addDays(dr.date, 1).replace(/-/g, ''); }
    var det = [d.name, d.phone, d.email, guests(d) + ' gostiju', d.meeting ? 'Sastanak: ' + d.meeting : '', d.note].filter(Boolean).join('\n');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(shortTour(d) + ' · ' + d.name) + '&dates=' + dates + '&ctz=Europe/Sarajevo&details=' + encodeURIComponent(det) + (d.meeting ? '&location=' + encodeURIComponent(d.meeting + ', Mostar') : '');
  }
  function summary(dr) {
    var d = dr.data;
    return [shortTour(d), dr.date ? fmtDay(dr.date, true) + (d.time ? ', ' + timeText(d.time) : '') : 'Datum fleksibilan', 'Gosti: ' + guests(d) + (d.ages ? ' (djeca: ' + d.ages + ')' : ''), d.name, d.phone, d.email, d.instagram ? '@' + d.instagram : '', d.meeting ? 'Sastanak: ' + d.meeting : '', d.price != null ? 'Cijena: €' + d.price + (d.paid ? ' (plaćeno)' : '') : '', (d.tickets || []).length ? 'Ulaznice: ' + d.tickets.join(', ') : '', d.message ? 'Poruka: ' + d.message : ''].filter(Boolean).join('\n');
  }
  function stepper(label, path) {
    var v = get(draft, path) || 0;
    return '<div class="f"><span>' + esc(label) + '</span><div class="stp"><button type="button" data-st="' + path + '|-1" aria-label="Manje">−</button><b data-sv="' + path + '">' + v + '</b><button type="button" data-st="' + path + '|1" aria-label="Više">+</button></div></div>';
  }
  function renderBooking(isNew, id) {
    var d = draft.data, site = /^site-/.test(draft.source);
    var tourOpts = '<option value="">Tura po dogovoru / druga</option>' + S.tours.map(function (t) { return '<option value="' + esc(t.slug) + '"' + (d.tourSlug === t.slug ? ' selected' : '') + '>' + esc(t.data.name) + '</option>'; }).join('');
    var tk = S.tickets.map(function (k) { var lab = k.label + ' (€' + k.price + ' pp)', on = (d.tickets || []).some(function (x) { return x.indexOf(k.label) === 0; }); return '<label><input type="checkbox" data-btk="' + esc(lab) + '"' + (on ? ' checked' : '') + '>' + esc(k.label) + '<em>€' + k.price + '</em></label>'; }).join('');
    var ph = digits(d.phone), acts = [];
    if (ph || d.email || d.instagram) acts.push('<button type="button" class="qa wa" data-msg>' + IC.wa + '<span>Poruka</span></button>');
    if (ph) acts.push('<a class="qa" href="tel:+' + ph + '">' + IC.phone + '<span>Pozovi</span></a>');
    if (d.instagram) acts.push('<a class="qa" href="https://instagram.com/' + esc(d.instagram) + '" target="_blank" rel="noopener">' + IC.ig + '<span>Instagram</span></a>');
    if (draft.date) acts.push('<a class="qa" href="' + esc(gcalUrl(draft)) + '" target="_blank" rel="noopener">' + IC.gcal + '<span>U kalendar</span></a>');
    acts.push('<button type="button" class="qa" data-copy>' + IC.copy + '<span>Kopiraj</span></button>');
    var fromTime = d.time && !/^\d{1,2}:\d{2}$/.test(d.time) ? '<small>Gost je izabrao: <b>' + esc(timeText(d.time)) + '</b>. Kad dogovorite tačno vrijeme, upišite ga.</small>' : '';
    shell('planer', ehead('#/planer', 'Nazad na planer', isNew ? 'Novi upit' : esc(d.name || 'Upit')) +
      '<div class="bk-head">' + (isNew ? '<p class="sub esub">Dodajte upit ili dogovorenu turu koja je stigla preko Instagrama, telefona, uživo…</p>' : '<p class="sub esub">' + IC[SRC_IC[draft.source] || 'dots'] + ' ' + esc(SRC[draft.source] || '') + ' · stiglo ' + esc(ago(draft.created_at)) + '</p>') + '</div>' +
      '<div class="stsel" role="radiogroup" aria-label="Status">' + Object.keys(ST).map(function (s) { return '<label class="st-' + s + '"><input type="radio" name="bst" value="' + s + '"' + (draft.status === s ? ' checked' : '') + '><span>' + ST[s] + '</span></label>'; }).join('') + '</div>' +
      (acts.length > 1 || !isNew ? '<div class="qas">' + acts.join('') + '</div>' : '') +
      '<form id="ed" autocomplete="off" novalidate>' +
      sec('gost', 'Gost', esc([d.name, d.phone || d.email || (d.instagram ? '@' + d.instagram : '')].filter(Boolean).join(' · ') || 'Nije popunjeno'), isNew) + '' + field('Ime i prezime', 'data.name', { ph: 'npr. Anna Müller' }) + '<div class="two">' + field('Telefon / WhatsApp', 'data.phone', { ph: '+49 170 1234567' }) + field('Email', 'data.email', { ph: 'ime@email.com' }) + field('Instagram', 'data.instagram', { ph: '@korisnik' }) + field('Jezik', 'data.lang', { ph: 'English, Deutsch…' }) + '</div>' +
      (site ? '' : '<div class="f"><span>Odakle je stiglo</span><div class="seg src-seg">' + ['instagram', 'whatsapp', 'phone', 'email', 'agency', 'walkin', 'other'].map(function (s) { return '<label><input type="radio" name="bsrc" value="' + s + '"' + (draft.source === s ? ' checked' : '') + '><span>' + IC[SRC_IC[s]] + SRC[s] + '</span></label>'; }).join('') + '</div></div>') + '' + '</div></details>' +
      sec('tura', 'Tura', esc(shortTour(d)) + ' · ' + (draft.date ? esc(fmtDay(draft.date)) : 'datum fleksibilan'), isNew) + '<label class="f"><span>Koja tura</span><select data-path="data.tourSlug">' + tourOpts + '</select></label>' + (d.tourSlug ? '' : field('Opis ture (ako nije sa liste)', 'data.tour', { ph: 'npr. Sarajevo day trip' })) +
      '<div class="two"><label class="f"><span>Datum</span><input type="date" data-path="date" value="' + esc(draft.date || '') + '"></label><label class="f"><span>Vrijeme</span><input type="time" data-path="data.time" value="' + (/^\d{1,2}:\d{2}$/.test(d.time) ? esc(d.time.padStart(5, '0')) : '') + '">' + fromTime + '</label></div>' +
      field('Mjesto sastanka', 'data.meeting', { ph: 'npr. ispred Hamama' }) + '' + '</div></details>' +
      sec('gosti', 'Gosti', guests(d) + ' gostiju' + ((d.tickets || []).length ? ' · ' + d.tickets.length + ' ulaz.' : ''), isNew) + '<div class="two">' + stepper('Odrasli', 'data.adults') + stepper('Djeca', 'data.children') + '</div>' + (d.children ? field('Godine djece', 'data.ages', { ph: 'npr. 6 i 9' }) : '') + '<div class="f"><span>Ulaznice</span><div class="ticks">' + tk + '</div></div>' + '</div></details>' +
      sec('novac', 'Novac', d.price != null && d.price !== '' ? '€' + esc(d.price) + (d.paid ? ' · plaćeno' : ' · nije plaćeno') : 'Cijena nije upisana', false) + '<div class="two">' + field('Dogovorena cijena (€)', 'data.price', { num: true, ph: 'npr. 80' }) + '<div>' + toggle('Plaćeno', 'data.paid') + '</div></div>' + '</div></details>' +
      sec('poruke', 'Poruke', esc(String(d.message || d.note || 'Nema poruka').slice(0, 60)), false) + '' + field('Poruka gosta', 'data.message', { area: true, rows: 3 }) + field('Moja bilješka (vidim samo ja)', 'data.note', { area: true, rows: 3, ph: 'npr. dogovoreno 10h, platit će na licu mjesta' }) + '' + '</div></details>' +
      (isNew ? '' : '<section class="card"><button type="button" class="btn danger" data-delbk>' + IC.trash + 'Obriši upit</button></section>') +
      '</form>' + savebar(isNew, isNew ? 'Dodaj' : 'Sačuvaj'));
    bindForm(function () { renderBooking(isNew, id); }, function () {
      if (!String(draft.data.name || '').trim()) { toast('Upišite ime gosta.', true); return Promise.resolve(); }
      var body = { status: draft.status, source: draft.source, date: draft.date || null, data: draft.data };
      return (isNew ? api('POST', '/bookings', body) : api('PUT', '/bookings/' + id, body)).then(function (j) {
        setDirty(false); toast(isNew ? 'Dodano u planer ✓' : 'Sačuvano ✓');
        return loadBookings().then(function () { location.hash = isNew ? '#/planer' : '#/planer/' + id; if (!isNew) bookingEditor(id, ''); });
      });
    });
    var form = $('#ed');
    // date/time/select fields need a re-render for the quick actions
    form.addEventListener('change', function (e) { var p = e.target.getAttribute('data-path'); if (p === 'date' || p === 'data.time' || p === 'data.tourSlug') { if (p === 'data.tourSlug' && !draft.data.meeting) { var t = S.tours.filter(function (x) { return x.slug === draft.data.tourSlug; })[0]; if (t && t.data.meetingPoint) draft.data.meeting = t.data.meetingPoint; } renderBooking(isNew, id); setDirty(true); } });
    $$('[name=bst]').forEach(function (r) { r.addEventListener('change', function () { draft.status = r.value; setDirty(true); renderBooking(isNew, id); setDirty(true); }); });
    $$('[name=bsrc]').forEach(function (r) { r.addEventListener('change', function () { draft.source = r.value; setDirty(true); }); });
    $$('[data-st]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-st').split('|'), v = Math.max(0, Math.min(99, (get(draft, a[0]) || 0) + (+a[1]))); set(draft, a[0], v); $('[data-sv="' + a[0] + '"]').textContent = v; setDirty(true); if (a[0] === 'data.children' && (v === 0 || v === 1)) renderBooking(isNew, id); }); });
    $$('[data-btk]').forEach(function (c) { c.addEventListener('change', function () { var lab = c.getAttribute('data-btk'), name = lab.split(' (€')[0]; var a = (draft.data.tickets || []).filter(function (x) { return x.indexOf(name) !== 0; }); if (c.checked) a.push(lab); draft.data.tickets = a; setDirty(true); }); });
    var mg = $('[data-msg]'); if (mg) mg.addEventListener('click', function () {
      msgFlow({ id: isNew ? null : id, status: draft.status, date: draft.date, data: draft.data }, null, function () {
        var b = B.filter(function (x) { return x.id === id; })[0]; if (!b) return;
        if (dirty) { draft.status = b.status; draft.data.reviewAsked = b.data.reviewAsked; renderBooking(false, id); setDirty(true); } else bookingEditor(id, '');
      });
    });
    var cp = $('[data-copy]'); if (cp) cp.addEventListener('click', function () { var t = summary(draft); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Detalji kopirani'); }).catch(function () { prompt('Kopirajte:', t); }); });
    var del = $('[data-delbk]'); if (del) del.addEventListener('click', function () { if (!confirm('Obrisati ovaj upit?')) return; api('DELETE', '/bookings/' + id).then(function () { setDirty(false); toast('Obrisano'); return loadBookings(); }).then(function () { location.hash = '#/planer'; }).catch(function (e) { toast(e.message, true); }); });
    if (isNew) { var n = $('[data-path="data.name"]'); if (n && innerWidth > 800) n.focus(); }
  }

  // a new enquiry while the planner is open: refresh when Mirna comes back to the tab, and every minute
  function refreshPlanner() { if (!/^#\/planer\/?$/.test(location.hash || '#/planer') || dirty) return; var before = B.length; loadBookings().then(function () { if (B.length !== before && /^#\/planer\/?$/.test(location.hash || '#/planer')) { plannerHome(); if (B.length > before) toast('Stigao je novi upit'); } }); }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshPlanner(); });
  setInterval(function () { if (!document.hidden) refreshPlanner(); }, 60000);

  /* =====================================================================
     VIŠE: pregled posla, gosti, šabloni poruka, zauzeti dani, tekstovi sajta, kalendar i obavještenja
     ===================================================================== */
  var X = { templates: [], blocked: [], site: null, draft: true, icalUrl: null, pushKey: null, pushCount: 0 };
  function loadSettings() { return api('GET', '/settings').then(function (j) { X = j; }).catch(function () {}); }
  function isBlocked(iso) { return (X.blocked || []).indexOf(iso) > -1; }
  function toggleBlocked(iso) {
    var a = (X.blocked || []).slice(), i = a.indexOf(iso); if (i > -1) a.splice(i, 1); else a.push(iso);
    return api('PUT', '/blocked', { dates: a }).then(function (j) { X.blocked = j.blocked; toast(i > -1 ? 'Dan je ponovo slobodan' : 'Dan je označen kao zauzet'); });
  }
  function money(n) { n = Math.round((n || 0) * 100) / 100; return '€' + (n % 1 ? n.toFixed(2) : String(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function isTour(b) { return b.status === 'confirmed' || b.status === 'done'; }
  function tourFullName(d) { var t = (S.tours.filter(function (x) { return x.slug === d.tourSlug; })[0] || {}).data; return (t && t.name) || d.tour || 'Tura po dogovoru'; }

  function viseHome() {
    var g = guestsAgg().length, up = (X.blocked || []).filter(function (d) { return d >= todayISO(); }).length;
    var pushTxt = !('PushManager' in window) ? 'Kalendar na telefonu, obavještenja' : (Notification.permission === 'granted' && X.pushCount ? 'Obavještenja uključena' : 'Obavještenja za nove upite');
    var tiles = [
      ['pregled', 'chart', 'Pregled posla', 'Upiti, ture, gosti i zarada po mjesecima'],
      ['gosti', 'users', 'Gosti', g + (g === 1 ? ' gost' : ' gostiju') + ' · izvoz u Excel'],
      ['sabloni', 'chat', 'Šabloni poruka', (X.templates || []).length + ' poruka za WhatsApp i email'],
      ['zauzeto', 'block', 'Zauzeti dani', up ? up + (up === 1 ? ' dan' : ' dana') + ' koje gosti ne mogu izabrati' : 'Dani kad ne radite'],
      ['tekstovi', 'text', 'Tekstovi sajta', 'Kontakt, o meni, česta pitanja, ulaznice'],
      ['postavke', 'bell', 'Kalendar i obavještenja', pushTxt]
    ];
    shell('vise', phead('Više', 'Alati za posao i za sajt.') + '<div class="tiles">' + tiles.map(function (t) { return '<a class="tile" href="#/vise/' + t[0] + '"><span class="ti">' + IC[t[1]] + '</span><span class="tb"><b>' + t[2] + '</b><small>' + esc(t[3]) + '</small></span><span class="chev">' + IC.chev + '</span></a>'; }).join('') + '</div>' +
      '<p class="sub vfoot">Sajt objavljen: ' + esc(S.publishedAt ? ago(S.publishedAt) : '—') + (X.draft ? ' · nacrt (žute napomene su vidljive)' : '') + '</p>');
  }

  /* ---------- pregled posla ---------- */
  var SV = { month: null };
  function statsView() {
    if (!SV.month) SV.month = todayISO().slice(0, 7);
    var mo = SV.month, ym = mo.split('-'), y = +ym[0], m = +ym[1] - 1;
    var created = B.filter(function (b) { return String(b.created_at || '').slice(0, 7) === mo; });
    var tours = B.filter(function (b) { return isTour(b) && b.date && b.date.slice(0, 7) === mo; });
    var guests = tours.reduce(function (s, b) { return s + (b.data.adults || 0) + (b.data.children || 0); }, 0);
    var earned = tours.reduce(function (s, b) { return s + (b.data.price || 0); }, 0), paid = tours.reduce(function (s, b) { return s + (b.data.paid ? (b.data.price || 0) : 0); }, 0);
    var conv = created.length ? Math.round(100 * created.filter(isTour).length / created.length) : 0;
    var months = []; for (var i = 5; i >= 0; i--) { var dt = new Date(Date.UTC(y, m - i, 1)), k = dt.toISOString().slice(0, 7); months.push({ k: k, label: MONTHS[dt.getUTCMonth()].slice(0, 3), n: B.filter(function (b) { return isTour(b) && b.date && b.date.slice(0, 7) === k; }).length, e: B.filter(function (b) { return isTour(b) && b.date && b.date.slice(0, 7) === k; }).reduce(function (s, b) { return s + (b.data.price || 0); }, 0) }); }
    var maxN = Math.max.apply(null, months.map(function (x) { return x.n; }).concat([1]));
    var yearAgo = addDays(todayISO(), -365);
    var src = {}; B.filter(function (b) { return String(b.created_at || '').slice(0, 10) >= yearAgo; }).forEach(function (b) { var k = /^site-/.test(b.source) ? 'Sajt' : SRC[b.source] || 'Drugo'; src[k] = (src[k] || 0) + 1; });
    var srcL = Object.keys(src).map(function (k) { return [k, src[k]]; }).sort(function (a, b) { return b[1] - a[1]; }), srcMax = srcL.length ? srcL[0][1] : 1, srcSum = srcL.reduce(function (s, x) { return s + x[1]; }, 0);
    var top = {}; B.filter(function (b) { return isTour(b) && b.date && b.date >= yearAgo; }).forEach(function (b) { var k = shortTour(b.data); top[k] = (top[k] || 0) + 1; });
    var topL = Object.keys(top).map(function (k) { return [k, top[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
    var bars = '<div class="bars">' + months.map(function (x) { return '<div class="mbar' + (x.k === mo ? ' on' : '') + '"><em>' + x.n + '</em><i style="height:' + Math.round(100 * x.n / maxN) + '%"></i><span>' + x.label + '</span></div>'; }).join('') + '</div>';
    shell('vise', ehead('#/vise', 'Nazad na Više', 'Pregled posla') +
      '<div class="cal-h stats-h"><button type="button" class="icon" data-smon="-1" aria-label="Prethodni mjesec">' + IC.back + '</button><b>' + cap(MONTHS[m]) + ' ' + y + '</b><button type="button" class="icon" data-smon="1" aria-label="Sljedeći mjesec">' + IC.chev + '</button></div>' +
      '<div class="kpis k4"><div class="kpi"><b>' + created.length + '</b><span>' + (created.length === 1 ? 'upit stigao' : 'upita stiglo') + '</span></div><div class="kpi"><b>' + tours.length + '</b><span>' + (tours.length === 1 ? 'tura' : 'tura') + ' u mjesecu</span></div><div class="kpi"><b>' + guests + '</b><span>gostiju</span></div><div class="kpi money"><b>' + money(earned) + '</b><span>' + (earned ? 'plaćeno ' + money(paid) : 'dogovoreno') + '</span></div></div>' +
      '<section class="card"><h2>Ture po mjesecima</h2><p class="help">Potvrđene i završene ture, zadnjih 6 mjeseci. Zarada u ' + MONTHS[m] + 'u: <b>' + money(earned) + '</b>.</p>' + bars + '</section>' +
      '<section class="card"><h2>Od upita do ture</h2><div class="conv"><b>' + conv + '%</b><span>upita iz ' + MONTHS[m] + 'a je postalo tura' + (created.length ? ' (' + created.filter(isTour).length + ' od ' + created.length + ')' : '') + '.</span></div></section>' +
      '<section class="card"><h2>Odakle dolaze upiti</h2><p class="help">Zadnjih 12 mjeseci.</p>' + (srcL.length ? '<div class="hbars">' + srcL.map(function (x) { return '<div class="hb"><span>' + esc(x[0]) + '</span><i><s style="width:' + Math.max(4, Math.round(100 * x[1] / srcMax)) + '%"></s></i><b>' + x[1] + '<small> · ' + Math.round(100 * x[1] / srcSum) + '%</small></b></div>'; }).join('') + '</div>' : '<p class="pempty"><span>Još nema upita.</span></p>') + '</section>' +
      '<section class="card"><h2>Najtraženije ture</h2><p class="help">Potvrđene ture, zadnjih 12 mjeseci.</p>' + (topL.length ? '<ol class="toplist">' + topL.map(function (x) { return '<li><span>' + esc(x[0]) + '</span><b>' + x[1] + '</b></li>'; }).join('') + '</ol>' : '<p class="pempty"><span>Još nema potvrđenih tura.</span></p>') + '</section>');
    $$('[data-smon]').forEach(function (b) { b.addEventListener('click', function () { var d = new Date(Date.UTC(y, m + (+b.getAttribute('data-smon')), 1)); SV.month = d.toISOString().slice(0, 7); statsView(); }); });
  }

  /* ---------- gosti ---------- */
  function guestKey(d) { return digits(d.phone) || String(d.email || '').toLowerCase().trim() || (d.instagram ? 'ig:' + String(d.instagram).toLowerCase() : '') || 'n:' + String(d.name || '').toLowerCase().trim(); }
  function guestsAgg() {
    var map = {};
    B.forEach(function (b) {
      var d = b.data, k = guestKey(d); if (k === 'n:') return;
      var g = map[k] || (map[k] = { k: k, name: '', phone: '', email: '', instagram: '', lang: '', n: 0, tours: 0, last: '', list: [] });
      g.list.push(b); g.n++; if (isTour(b)) g.tours++;
      ['name', 'phone', 'email', 'instagram', 'lang'].forEach(function (f) { if (!g[f] && d[f]) g[f] = d[f]; });
      var when = b.date || String(b.created_at || '').slice(0, 10); if (when > g.last) g.last = when;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.last.localeCompare(a.last); });
  }
  var GQ = '';
  function guestsView() {
    var all = guestsAgg();
    shell('vise', ehead('#/vise', 'Nazad na Više', 'Gosti') + '<p class="sub esub">Svi koji su se javili, sa sajta ili ručno uneseni. Dodirnite gosta za njegove upite.</p>' +
      '<div class="row gtools"><div class="psearch">' + IC.search + '<input id="gq" type="search" placeholder="Traži ime, telefon, email…" value="' + esc(GQ) + '" aria-label="Pretraga gostiju"></div><button type="button" class="btn line sm" data-csv>' + IC.download + 'Excel</button></div>' +
      '<div class="glist" id="glist"></div>');
    function draw() {
      var q = GQ.trim().toLowerCase(), l = all.filter(function (g) { return !q || [g.name, g.phone, g.email, g.instagram].join(' ').toLowerCase().indexOf(q) > -1; });
      $('#glist').innerHTML = l.length ? l.map(function (g) { var ini = String(g.name || '?').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).slice(0, 2).join('').toUpperCase(); return '<button type="button" class="guest" data-g="' + esc(g.k) + '"><span class="av">' + esc(ini) + '</span><span class="gb"><b>' + esc(g.name || 'Bez imena') + (g.tours > 1 ? ' <span class="badge ok">Vraća se</span>' : '') + '</b><small>' + esc([g.phone, g.email, g.instagram ? '@' + g.instagram : ''].filter(Boolean).join(' · ') || 'nema kontakta') + '</small></span><span class="gn"><b>' + g.n + '</b><small>' + (g.n === 1 ? 'upit' : 'upita') + '</small></span></button>'; }).join('') : '<div class="pempty"><b>' + (q ? 'Nema takvog gosta' : 'Još nema gostiju') + '</b><span>Gosti se ovdje pojavljuju sami, iz upita u planeru.</span></div>';
    }
    draw();
    $('#gq').addEventListener('input', function (e) { GQ = e.target.value; draw(); });
    $('#glist').addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]'); if (!b) return;
      var g = all.filter(function (x) { return x.k === b.getAttribute('data-g'); })[0]; if (!g) return;
      var ph = digits(g.phone), acts = [];
      if (ph) acts.push('<a class="qa wa" href="https://wa.me/' + ph + '" target="_blank" rel="noopener">' + IC.wa + '<span>WhatsApp</span></a>', '<a class="qa" href="tel:+' + ph + '">' + IC.phone + '<span>Pozovi</span></a>');
      if (g.email) acts.push('<a class="qa" href="mailto:' + esc(g.email) + '">' + IC.mail + '<span>Email</span></a>');
      if (g.instagram) acts.push('<a class="qa" href="https://instagram.com/' + esc(g.instagram) + '" target="_blank" rel="noopener">' + IC.ig + '<span>Instagram</span></a>');
      var sh = sheet(g.name || 'Gost', (acts.length ? '<div class="qas">' + acts.join('') + '</div>' : '') + '<p class="mlabel">' + g.n + (g.n === 1 ? ' upit' : ' upita') + ' · ' + g.tours + (g.tours === 1 ? ' tura' : ' tura') + '</p><div class="plist">' + g.list.map(bkCard).join('') + '</div>');
      sh.el.addEventListener('click', function (ev) { if (ev.target.closest('a.bk')) sh.close(); });
    });
    $('[data-csv]').addEventListener('click', exportCSV);
  }
  function exportCSV() {
    var cols = ['Datum ture', 'Vrijeme', 'Status', 'Izvor', 'Ime', 'Telefon', 'Email', 'Instagram', 'Jezik', 'Tura', 'Odrasli', 'Djeca', 'Godine djece', 'Ulaznice', 'Cijena (EUR)', 'Plaćeno', 'Mjesto sastanka', 'Poruka gosta', 'Bilješka', 'Stiglo'];
    var q = function (v) { v = v == null ? '' : String(v); return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = B.slice().sort(function (a, b) { return String(a.date || '9').localeCompare(String(b.date || '9')); }).map(function (b) { var d = b.data; return [b.date || '', d.time || '', ST[b.status], SRC[b.source] || b.source, d.name, d.phone, d.email, d.instagram, d.lang, tourFullName(d), d.adults || 0, d.children || 0, d.ages, (d.tickets || []).join(', '), d.price == null ? '' : String(d.price).replace('.', ','), d.paid ? 'da' : 'ne', d.meeting, d.message, d.note, b.created_at].map(q).join(';'); });
    var csv = '﻿' + [cols.join(';')].concat(rows).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'mostarly-upiti-' + todayISO() + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Preuzeto: ' + B.length + (B.length === 1 ? ' upit' : ' upita'));
  }

  /* ---------- šabloni poruka ---------- */
  var PH = [['{ime}', 'ime'], ['{tura}', 'tura'], ['{datum}', 'datum'], ['{vrijeme}', 'vrijeme'], ['{mjesto}', 'mjesto'], ['{cijena}', 'cijena'], ['{gosti}', 'gosti'], ['{recenzija}', 'link za recenziju']];
  var LANGS = ['EN', 'DE', 'BS', 'IT', 'FR', 'ES'];
  function templatesView() { draft = { templates: clone(X.templates || []) }; renderTemplates(); }
  function renderTemplates() {
    var T = draft.templates;
    shell('vise', ehead('#/vise', 'Nazad na Više', 'Šabloni poruka') + '<p class="sub esub">Gotove poruke za WhatsApp, email ili Instagram. U poruci koju šaljete, umjesto oznaka kao <b>{ime}</b> ili <b>{datum}</b> automatski se upišu podaci gosta.</p>' +
      '<form id="ed" autocomplete="off" novalidate>' + T.map(function (t, i) {
        return sec('t' + i, esc(t.name || 'Šablon'), '<span class="lang">' + esc(t.lang || '–') + '</span> ' + esc(String(t.text).slice(0, 60)), !t.text) +
          field('Naziv', 'templates.' + i + '.name', { ph: 'npr. Potvrda ture' }) +
          '<div class="f"><span>Jezik</span><div class="seg">' + LANGS.map(function (l) { return '<label><input type="radio" name="tl' + i + '" value="' + l + '"' + (t.lang === l ? ' checked' : '') + '><span>' + l + '</span></label>'; }).join('') + '</div></div>' +
          field('Tekst poruke', 'templates.' + i + '.text', { area: true, rows: 5, max: 2000 }) +
          '<div class="f"><span>Dodaj u tekst</span><div class="chips">' + PH.map(function (x) { return '<button type="button" data-ins="' + i + '|' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
          '<button type="button" class="btn danger sm" data-tdel="' + i + '">' + IC.trash + 'Obriši šablon</button></div></details>';
      }).join('') + '</form>' +
      '<div class="row" style="margin-top:.4rem"><button type="button" class="add" data-tadd>' + IC.plus + 'Novi šablon</button><span class="spacer"></span><button type="button" class="btn line sm" data-treset>Vrati početne</button></div>' +
      savebar(false, 'Sačuvaj'));
    bindForm(renderTemplates, function () {
      if (draft.templates.some(function (t) { return !String(t.text || '').trim(); })) { toast('Svaki šablon mora imati tekst (ili ga obrišite).', true); return Promise.resolve(); }
      return api('PUT', '/templates', { templates: draft.templates }).then(function (j) { X.templates = j.templates; setDirty(false); toast('Šabloni sačuvani ✓'); templatesView(); });
    });
    $$('[name^=tl]').forEach(function (r) { r.addEventListener('change', function () { draft.templates[+r.name.slice(2)].lang = r.value; setDirty(true); }); });
    $$('[data-ins]').forEach(function (b) { b.addEventListener('click', function () {
      var a = b.getAttribute('data-ins').split('|'), ta = $('[data-path="templates.' + a[0] + '.text"]'), s = ta.selectionStart == null ? ta.value.length : ta.selectionStart, e2 = ta.selectionEnd == null ? s : ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + a[1] + ta.value.slice(e2); ta.focus(); ta.setSelectionRange(s + a[1].length, s + a[1].length); ta.dispatchEvent(new Event('input', { bubbles: true }));
    }); });
    $$('[data-tdel]').forEach(function (b) { b.addEventListener('click', function () { if (!confirm('Obrisati ovaj šablon?')) return; draft.templates.splice(+b.getAttribute('data-tdel'), 1); setDirty(true); renderTemplates(); }); });
    $('[data-tadd]').addEventListener('click', function () { draft.templates.push({ id: 't' + Date.now().toString(36), name: 'Novi šablon', lang: 'EN', text: '' }); setDirty(true); renderTemplates(); var t = $$('details[data-sec]'); if (t.length) { t[t.length - 1].open = true; t[t.length - 1].scrollIntoView({ block: 'center' }); } });
    $('[data-treset]').addEventListener('click', function () { if (!confirm('Vratiti početne šablone? Vaše izmjene šablona će nestati kad sačuvate.')) return; draft.templates = clone(DEFAULT_TPL()); setDirty(true); renderTemplates(); });
  }
  function DEFAULT_TPL() { return [
    { id: 'en-thanks', name: 'Zahvala na upitu', lang: 'EN', text: 'Hello {ime}, this is Mirna from Mostarly Guide. Thank you for your enquiry about {tura}! ' },
    { id: 'en-confirm', name: 'Potvrda ture', lang: 'EN', text: 'Hello {ime}, your tour is confirmed: {tura}, {datum} at {vrijeme}. Meeting point: {mjesto}. Price: {cijena}. See you in Mostar! Mirna' },
    { id: 'en-reminder', name: 'Podsjetnik dan prije', lang: 'EN', text: 'Hello {ime}, a quick reminder for tomorrow: {tura} at {vrijeme}, meeting point: {mjesto}. Comfortable shoes are a good idea. See you soon! Mirna' },
    { id: 'en-review', name: 'Molba za recenziju', lang: 'EN', text: 'Hello {ime}, thank you so much for exploring Mostar with me! If you enjoyed the tour, a short review would mean a lot to me: {recenzija} Mirna' },
    { id: 'de-thanks', name: 'Zahvala na upitu', lang: 'DE', text: 'Hallo {ime}, hier ist Mirna von Mostarly Guide. Vielen Dank für Ihre Anfrage zu {tura}! ' },
    { id: 'de-confirm', name: 'Potvrda ture', lang: 'DE', text: 'Hallo {ime}, Ihre Tour ist bestätigt: {tura}, {datum} um {vrijeme}. Treffpunkt: {mjesto}. Preis: {cijena}. Bis bald in Mostar! Mirna' },
    { id: 'de-reminder', name: 'Podsjetnik dan prije', lang: 'DE', text: 'Hallo {ime}, eine kurze Erinnerung für morgen: {tura} um {vrijeme}, Treffpunkt: {mjesto}. Bequeme Schuhe sind eine gute Idee. Bis morgen! Mirna' },
    { id: 'de-review', name: 'Molba za recenziju', lang: 'DE', text: 'Hallo {ime}, vielen Dank, dass Sie Mostar mit mir entdeckt haben! Wenn Ihnen die Tour gefallen hat, würde mich eine kurze Bewertung sehr freuen: {recenzija} Mirna' }
  ]; }

  // fill a template with a booking's details; parts with no value are left out
  var LOCALE = { EN: 'en-GB', DE: 'de-DE', BS: 'bs-BA', IT: 'it-IT', FR: 'fr-FR', ES: 'es-ES' };
  function fillTpl(t, dr) {
    var d = dr.data, lang = t.lang || 'EN';
    var v = {
      ime: firstName(d.name), tura: tourFullName(d),
      datum: dr.date ? dObj(dr.date).toLocaleDateString(LOCALE[lang] || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : '',
      vrijeme: /^\d{1,2}:\d{2}$/.test(d.time || '') ? d.time : '', mjesto: d.meeting || '', cijena: d.price != null && d.price !== '' ? money(d.price) : '',
      gosti: String((d.adults || 0) + (d.children || 0) || ''), recenzija: (S.contact && S.contact.tripadvisor) || ''
    };
    var s = String(t.text || '');
    Object.keys(v).forEach(function (k) {
      if (v[k]) s = s.split('{' + k + '}').join(v[k]);
      else s = s.replace(new RegExp('(\\s(?:at|um|on|am|à|alle|a las))?\\s*\\{' + k + '\\}', 'g'), '');
    });
    return s.replace(/(^|[.!?]\s+)[^.!?:]{1,40}:\s*(?=[.!?]|$)[.!?]?\s*/g, '$1').replace(/\s+([.,!?])/g, '$1').replace(/,\s*\./g, '.').replace(/ {2,}/g, ' ').trim();
  }
  function prefLang(d) { var l = String(d.lang || '').toLowerCase(); return /de|deutsch|german|njema/.test(l) ? 'DE' : /it|ital/.test(l) ? 'IT' : /fr|fran/.test(l) ? 'FR' : /es|span/.test(l) ? 'ES' : /bs|bos|hr|sr|bhs/.test(l) ? 'BS' : 'EN'; }
  // change a saved booking without touching the form (e.g. "replied" after sending a message)
  function patchBooking(id, status, extra) {
    var b = B.filter(function (x) { return x.id === id; })[0]; if (!b) return Promise.resolve();
    var body = { status: status || b.status, source: b.source, date: b.date, data: Object.assign({}, b.data, extra || {}) };
    return api('PUT', '/bookings/' + id, body).then(loadBookings);
  }
  // choose a template, check the text, send it on WhatsApp / email, or copy it for Instagram
  function msgFlow(dr, only, after) {
    var d = dr.data, pl = prefLang(d), list = (X.templates || []).slice().filter(function (t) { return !only || t.id.indexOf(only) > -1 || String(t.name).toLowerCase().indexOf(only) > -1; });
    if (!list.length) list = (X.templates || []).slice();
    list.sort(function (a, b) { return (a.lang === pl ? 0 : 1) - (b.lang === pl ? 0 : 1); });
    var sh = sheet('Poruka za ' + (firstName(d.name) || 'gosta'), '');
    var mb = $('.mb', sh.el);
    function pick() {
      mb.innerHTML = (list.length ? '<div class="tpls">' + list.map(function (t, i) { return '<button type="button" class="tpl" data-t="' + i + '"><span class="tpl-h"><b>' + esc(t.name) + '</b><span class="lang">' + esc(t.lang || '') + '</span></span><span class="tpl-p">' + esc(fillTpl(t, dr)) + '</span></button>'; }).join('') + '</div>' : '') +
        '<button type="button" class="tpl blank" data-t="-1"><span class="tpl-h"><b>Prazna poruka</b></span><span class="tpl-p">Napišite sami.</span></button><p class="sub" style="margin-top:.8rem">Šablone mijenjate u <a href="#/vise/sabloni" data-close>Više → Šabloni poruka</a>.</p>';
    }
    function compose(t) {
      var txt = t ? fillTpl(t, dr) : '', ph = digits(d.phone);
      mb.innerHTML = '<label class="f"><span>Poruka' + (t ? ' · ' + esc(t.name) : '') + '</span><textarea id="msgt" rows="7">' + esc(txt) + '</textarea></label>' +
        '<div class="sendrow">' + (ph ? '<button type="button" class="btn wa" data-send="wa">' + IC.wa + 'WhatsApp</button>' : '') + (d.email ? '<button type="button" class="btn" data-send="mail">' + IC.mail + 'Email</button>' : '') + '<button type="button" class="btn line" data-send="copy">' + IC.copy + (d.instagram ? 'Kopiraj za Instagram' : 'Kopiraj') + '</button></div>' +
        (!ph && !d.email && !d.instagram ? '<p class="help">Gost nema upisan telefon, email ni Instagram. Tekst možete kopirati.</p>' : '') + '<button type="button" class="add" data-back style="margin-top:.8rem">' + IC.back + 'Drugi šablon</button>';
      $('[data-back]', mb).addEventListener('click', pick);
      $$('[data-send]', mb).forEach(function (b) { b.addEventListener('click', function () {
        var how = b.getAttribute('data-send'), text = $('#msgt', mb).value;
        if (how === 'wa') window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
        else if (how === 'mail') location.href = 'mailto:' + d.email + '?subject=' + encodeURIComponent('Mostarly Guide · ' + tourFullName(d)) + '&body=' + encodeURIComponent(text);
        else { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('Kopirano'); if (d.instagram) window.open('https://instagram.com/' + d.instagram, '_blank', 'noopener'); }).catch(function () { prompt('Kopirajte poruku:', text); }); }
        sh.close();
        if (dr.id) {
          var isReview = t && /review|recenz/i.test(t.id + ' ' + t.name), st = dr.status === 'new' ? 'replied' : null;
          if (isReview || st) patchBooking(dr.id, st, isReview ? { reviewAsked: true } : null).then(function () { if (st) toast('Status: Odgovoreno'); if (after) after(); }).catch(function (e) { toast(e.message, true); });
        }
      }); });
    }
    mb.addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; var i = +b.getAttribute('data-t'); compose(i < 0 ? null : list[i]); });
    if (only && list.length && (list[0].id.indexOf(only) > -1)) compose(list[0]); else pick();
  }

  /* ---------- zauzeti dani ---------- */
  var BV = { month: null };
  function blockedView() {
    if (!BV.month) BV.month = todayISO().slice(0, 7);
    var m = BV.month.split('-'), y = +m[0], mo = +m[1] - 1, first = new Date(Date.UTC(y, mo, 1)), days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(), pad = (first.getUTCDay() + 6) % 7, t = todayISO();
    var busy = {}; B.forEach(function (b) { if (b.date && isTour(b)) busy[b.date] = (busy[b.date] || 0) + 1; });
    var cells = ''; for (var i = 0; i < pad; i++) cells += '<span class="cd empty"></span>';
    for (var d = 1; d <= days; d++) { var iso = BV.month + '-' + String(d).padStart(2, '0'); cells += '<button type="button" class="cd' + (iso === t ? ' today' : '') + (iso < t ? ' past' : '') + (isBlocked(iso) ? ' blk' : '') + '" data-bday="' + iso + '"' + (iso < t ? ' disabled' : '') + ' aria-pressed="' + isBlocked(iso) + '" aria-label="' + d + '. ' + MONTHS[mo] + (isBlocked(iso) ? ', zauzet' : '') + '"><b>' + d + '</b><span class="dots">' + (busy[iso] ? '<i class="st-confirmed"></i>' : '') + '</span></button>'; }
    var up = (X.blocked || []).filter(function (x) { return x >= t; });
    shell('vise', ehead('#/vise', 'Nazad na Više', 'Zauzeti dani') + '<p class="sub esub">Dodirnite dan kad ne radite (godišnji, druga tura, privatno). Na sajtu ga gosti neće moći izabrati u formi za upit. Promjena se čuva odmah.</p>' +
      '<div class="cal"><div class="cal-h"><button type="button" class="icon" data-bmon="-1" aria-label="Prethodni mjesec">' + IC.back + '</button><b>' + cap(MONTHS[mo]) + ' ' + y + '</b><button type="button" class="icon" data-bmon="1" aria-label="Sljedeći mjesec">' + IC.chev + '</button></div>' +
      '<div class="cal-g">' + ['P', 'U', 'S', 'Č', 'P', 'S', 'N'].map(function (x) { return '<span class="cw">' + x + '</span>'; }).join('') + cells + '</div>' +
      '<div class="legend"><span><i class="blkdot"></i>Zauzet dan</span><span><i class="st-confirmed"></i>Imate potvrđenu turu</span></div></div>' +
      '<section class="card" style="margin-top:.8rem"><h2>Zauzeti dani</h2>' + (up.length ? '<div class="blist">' + up.map(function (x) { return '<span class="bchip">' + esc(fmtDay(x, true)) + '<button type="button" data-bdel="' + x + '" aria-label="Oslobodi ' + esc(fmtDay(x, true)) + '">' + IC.x + '</button></span>'; }).join('') + '</div>' : '<p class="help" style="margin:0">Nema zauzetih dana. Svi dani su slobodni za upite.</p>') + '</section>');
    $$('[data-bmon]').forEach(function (b) { b.addEventListener('click', function () { var dd = new Date(Date.UTC(y, mo + (+b.getAttribute('data-bmon')), 1)); BV.month = dd.toISOString().slice(0, 7); blockedView(); }); });
    $$('[data-bday],[data-bdel]').forEach(function (b) { b.addEventListener('click', function () { var iso = b.getAttribute('data-bday') || b.getAttribute('data-bdel'); b.disabled = true; toggleBlocked(iso).then(blockedView).catch(function (e) { toast(e.message, true); blockedView(); }); }); });
  }

  /* ---------- tekstovi sajta ---------- */
  function pairList(title, path, k1, k2, ph1, ph2) {
    var arr = get(draft, path) || [];
    return '<div class="f"><span>' + esc(title) + '</span><div class="le" data-list="' + path + '">' + arr.map(function (it, i) {
      return '<div class="li pair"><span class="n">' + (i + 1) + '</span><div class="pp"><input type="text" data-path="' + path + '.' + i + '.' + k1 + '" value="' + esc(it[k1] || '') + '" placeholder="' + esc(ph1) + '" aria-label="' + esc(title) + ' ' + (i + 1) + '"><textarea data-path="' + path + '.' + i + '.' + k2 + '" rows="2" placeholder="' + esc(ph2) + '">' + esc(it[k2] || '') + '</textarea></div>' +
        '<div class="ctl"><span class="spacer"></span><button type="button" class="icon" data-lmove="' + path + '|' + i + '|-1" aria-label="Pomjeri gore"' + (i === 0 ? ' disabled' : '') + '>' + IC.up + '</button><button type="button" class="icon" data-lmove="' + path + '|' + i + '|1" aria-label="Pomjeri dole"' + (i === arr.length - 1 ? ' disabled' : '') + '>' + IC.down + '</button><button type="button" class="icon del" data-ldel="' + path + '|' + i + '" aria-label="Obriši">' + IC.trash + '</button></div></div>';
    }).join('') + '<button type="button" class="add" data-ladd="' + path + '|obj:' + k1 + ',' + k2 + '">' + IC.plus + 'Dodaj</button></div></div>';
  }
  function siteView() { if (!X.site) { toast('Tekstovi se nisu učitali. Osvježite stranicu.', true); location.hash = '#/vise'; return; } draft = { site: clone(X.site), draft: !!X.draft }; renderSite(); }
  function renderSite() {
    var s = draft.site, c = s.contact, ab = s.about, nNotes = (ab.notes || []).length + (c.notes || []).length;
    var notesBlock = nNotes ? sec('snotes', nNotes + (nNotes === 1 ? ' napomena' : ' napomene') + ' za provjeru', 'Dodirnite da vidite šta treba potvrditi', false).replace('card sec', 'card sec notes') + '<ul>' +
      [['site.about.notes', ab.notes || []], ['site.contact.notes', c.notes || []]].map(function (g) { return g[1].map(function (n, i) { return '<li><span>' + esc(n) + '</span><button type="button" class="btn sm line" data-snote="' + g[0] + '|' + i + '">Riješeno ✓</button></li>'; }).join(''); }).join('') + '</ul><small>Kad nešto riješite, kliknite "Riješeno" pa sačuvajte.</small></div></details>' : '';
    shell('vise', ehead('#/vise', 'Nazad na Više', 'Tekstovi sajta', '<a class="back" href="/" target="_blank" rel="noopener" aria-label="Otvori sajt" title="Otvori sajt">' + IC.ext + '</a>') + '<p class="sub esub">Tekst na sajtu pišite na engleskom. Nakon snimanja promjena je odmah na sajtu.</p>' + notesBlock +
      '<form id="ed" autocomplete="off" novalidate>' +
      sec('kontakt', 'Kontakt', esc([c.phone, c.email].filter(Boolean).join(' · ')), false) + '<div class="two">' + field('Telefon', 'site.contact.phone', { ph: '+387 63 000 000' }) + field('WhatsApp broj', 'site.contact.whatsapp', { ph: '38763000000', hint: 'Samo cifre, sa pozivnim brojem, bez + i razmaka.' }) + field('Email', 'site.contact.email') + field('Instagram', 'site.contact.instagram', { ph: 'mostarly.guide' }) + '</div>' + field('Tripadvisor link', 'site.contact.tripadvisor', { ph: 'https://www.tripadvisor.com/…', hint: 'Ovaj link ide i u poruku "Molba za recenziju".' }) + field('Glavno mjesto sastanka', 'site.contact.meetingPoint') + '</div></details>' +
      sec('opis', 'Naslov i opis sajta', esc(s.tagline), false) + field('Kratki slogan', 'site.tagline', { max: 200 }) + field('Opis (za Google i na početnoj)', 'site.description', { area: true, rows: 3, max: 600 }) + '</div></details>' +
      sec('omeni', 'O meni', esc(ab.experience || ''), false) + field('Kratko o meni (na početnoj)', 'site.about.short', { area: true, rows: 4, max: 800 }) + field('Iskustvo (jedna rečenica)', 'site.about.experience', { max: 200 }) + listEditor('Pasusi na stranici About', 'site.about.paragraphs', 'Novi pasus…') + '</div></details>' +
      sec('zasto', 'Zašto sa mnom', (s.why || []).length + ' razloga', false) + pairList('Razlozi', 'site.why', 't', 'd', 'Naslov', 'Kratko objašnjenje') + '</div></details>' +
      sec('usluge', 'Usluge', (s.services || []).length + ' usluga', false) + pairList('Usluge', 'site.services', 't', 'd', 'Naziv usluge', 'Opis') + '</div></details>' +
      sec('naupit', 'Ture na upit', (s.onRequest || []).length + ' stavki', false) + listEditor('Šta još nudite na upit', 'site.onRequest', 'npr. Rafting on the Neretva') + '</div></details>' +
      sec('faq', 'Česta pitanja', (s.faq || []).length + ' pitanja', false) + pairList('Pitanja i odgovori', 'site.faq', 'q', 'a', 'Pitanje', 'Odgovor') + '</div></details>' +
      sec('ulaznice', 'Ulaznice', (s.tickets || []).map(function (k) { return '€' + k.price; }).join(' · '), false) + '<p class="help">Cijene po osobi, koje gosti vide u formi za upit.</p>' + (s.tickets || []).map(function (k, i) { return '<div class="tkrow">' + field('Naziv', 'site.tickets.' + i + '.label') + field('€', 'site.tickets.' + i + '.price', { num: true }) + '</div>'; }).join('') + field('Napomena ispod ulaznica', 'site.ticketsNote', { area: true, rows: 2, max: 400 }) + '</div></details>' +
      sec('kategorije', 'Kategorije tura', (s.categories || []).map(function (k) { return k.name; }).join(' · '), false) + (s.categories || []).map(function (k, i) { return '<div class="catrow">' + field('Naziv kategorije', 'site.categories.' + i + '.name') + field('Uvodni tekst', 'site.categories.' + i + '.intro', { area: true, rows: 2, max: 600 }) + '</div>'; }).join('') + '</div></details>' +
      sec('objava', 'Objava sajta', draft.draft ? 'Nacrt: žute napomene su vidljive, Google ne indeksira' : 'Sajt je javan i gotov', false) + toggle('Sajt je gotov', 'draft', 'Uključeno: žute napomene i oznake "to confirm" nestaju sa sajta, a Google smije prikazivati sajt u pretrazi. Uključite tek kad je sve provjereno.', true) + '</div></details>' +
      '</form>' + savebar(false, 'Sačuvaj i objavi'));
    bindForm(renderSite, function () {
      return api('PUT', '/site', { site: draft.site, draft: draft.draft }).then(function (j) { X.site = j.site; X.draft = j.draft; setDirty(false); toast('Sačuvano i objavljeno na sajtu ✓'); return load().then(siteView); });
    });
    $$('[data-snote]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-snote').split('|'); get(draft, a[0]).splice(+a[1], 1); setDirty(true); renderSite(); }); });
  }

  /* ---------- kalendar na telefonu, obavještenja, aplikacija ---------- */
  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  var IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  function u8(s) { var b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function swReady() { return navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).then(function () { return navigator.serviceWorker.ready; }); }
  function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function currentSub() { if (!pushSupported()) return Promise.resolve(null); return navigator.serviceWorker.getRegistration('/admin/').then(function (r) { return r ? r.pushManager.getSubscription() : null; }).catch(function () { return null; }); }
  function settingsView() {
    currentSub().then(function (sub) {
      var cal = X.icalUrl, web = cal ? cal.replace(/^https?:/, 'webcal:') : '';
      var pushState = !pushSupported() ? (IOS && !STANDALONE ? 'ios' : 'no') : Notification.permission === 'denied' ? 'denied' : sub ? 'on' : 'off';
      var pushBody = {
        ios: '<p class="help">Na iPhoneu obavještenja rade kad je admin dodan na početni ekran: u Safariju dodirnite <b>Dijeli</b> pa <b>Dodaj na početni ekran</b>, otvorite Mostarly sa početnog ekrana i vratite se ovdje.</p>',
        no: '<p class="help">Ovaj preglednik ne podržava obavještenja. Otvorite admin u Chromeu (Android) ili sa početnog ekrana na iPhoneu.</p>',
        denied: '<p class="help">Obavještenja su blokirana u postavkama preglednika za ovaj sajt. Dozvolite ih tamo (ikonica lokota pored adrese), pa se vratite.</p>',
        on: '<p class="status ok">' + IC.check + 'Uključeno na ovom uređaju' + (X.pushCount > 1 ? ' (ukupno uređaja: ' + X.pushCount + ')' : '') + '</p><div class="row"><button type="button" class="btn sm" data-ptest>Pošalji probno</button><button type="button" class="btn line sm" data-poff>Isključi</button></div>',
        off: '<p class="help">Kad stigne novi upit sa sajta, telefon će vas obavijestiti kao poruka. Svake večeri stiže i podsjetnik za sutrašnje ture.</p><button type="button" class="btn mint" data-pon>' + IC.bell + 'Uključi obavještenja</button>'
      }[pushState];
      shell('vise', ehead('#/vise', 'Nazad na Više', 'Kalendar i obavještenja') +
        '<section class="card"><h2>' + IC.cal + ' Ture u kalendaru telefona</h2>' + (cal ? '<p class="help">Potvrđene ture se same pojavljuju u vašem kalendaru i mijenjaju se kad ih promijenite ovdje (kalendar osvježava otprilike svakih sat vremena).</p>' +
          '<div class="calbtns"><a class="btn mint" href="' + esc(web) + '">' + IC.cal + 'Dodaj na iPhone</a><a class="btn" href="https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(web) + '" target="_blank" rel="noopener">' + IC.gcal + 'Google Calendar</a></div>' +
          '<label class="f" style="margin-top:.9rem"><span>Link kalendara (privatan, ne dijelite ga)</span><div class="copyrow"><input type="text" readonly value="' + esc(cal) + '" id="icalu"><button type="button" class="btn line sm" data-ccopy>' + IC.copy + 'Kopiraj</button></div></label>' +
          '<button type="button" class="add" data-creset style="margin-top:.4rem">Napravi novi link</button>'
          : '<p class="help">Uključite i dobićete privatni link koji jednom dodate u Google ili iPhone kalendar. Od tada se potvrđene ture same pojavljuju tamo.</p><button type="button" class="btn mint" data-con>' + IC.cal + 'Uključi kalendar</button>') + '</section>' +
        '<section class="card"><h2>' + IC.bell + ' Obavještenja na telefonu</h2>' + pushBody + '</section>' +
        '<section class="card"><h2>' + IC.phone + ' Admin kao aplikacija</h2>' + (STANDALONE ? '<p class="status ok">' + IC.check + 'Admin je otvoren kao aplikacija.</p>' : installEvt ? '<p class="help">Dodajte Mostarly admin na početni ekran: otvara se kao prava aplikacija, bez adresne trake.</p><button type="button" class="btn mint" data-install>Dodaj na početni ekran</button>' : IOS ? '<p class="help">U Safariju dodirnite <b>Dijeli</b> (kvadrat sa strelicom) pa <b>Dodaj na početni ekran</b>.</p>' : '<p class="help">U meniju preglednika (tri tačke) izaberite <b>Instaliraj aplikaciju</b> ili <b>Dodaj na početni ekran</b>.</p>') + '</section>' +
        '<section class="card"><h2>Tema</h2><div class="seg" role="radiogroup" aria-label="Tema">' + [['auto', 'Kao telefon'], ['light', 'Svijetla'], ['dark', 'Tamna']].map(function (o) { var cur = document.documentElement.getAttribute('data-theme') || 'auto'; return '<label><input type="radio" name="theme" value="' + o[0] + '"' + (cur === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>'; }).join('') + '</div></section>');
      var on = function (sel, fn) { var el = $(sel); if (el) el.addEventListener('click', fn); };
      on('[data-con]', function () { api('POST', '/ical/reset').then(function (j) { X.icalUrl = j.icalUrl; toast('Kalendar je uključen'); settingsView(); }).catch(function (e) { toast(e.message, true); }); });
      on('[data-creset]', function () { if (!confirm('Napraviti novi link? Stari link prestaje raditi, pa ga treba ponovo dodati u kalendar.')) return; api('POST', '/ical/reset').then(function (j) { X.icalUrl = j.icalUrl; toast('Novi link je spreman'); settingsView(); }); });
      on('[data-ccopy]', function () { var i = $('#icalu'); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(function () { toast('Link kopiran'); }).catch(function () { i.select(); }); });
      on('[data-pon]', function (e) {
        var b = e.currentTarget; b.disabled = true;
        Notification.requestPermission().then(function (p) { if (p !== 'granted') throw new Error('Obavještenja nisu dozvoljena.'); return swReady(); })
          .then(function (reg) { return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(X.pushKey) }); }); })
          .then(function (s) { var j = s.toJSON(); return api('POST', '/push/subscribe', { endpoint: j.endpoint, keys: j.keys }); })
          .then(loadSettings).then(function () { toast('Obavještenja su uključena ✓'); settingsView(); })
          .catch(function (er) { b.disabled = false; toast(er.message || 'Nije uspjelo', true); settingsView(); });
      });
      on('[data-ptest]', function () { api('POST', '/push/test').then(function (j) { toast(j.sent ? 'Poslano. Stiže za par sekundi.' : 'Nije poslano, pokušajte isključiti pa uključiti.', !j.sent); }).catch(function (e) { toast(e.message, true); }); });
      on('[data-poff]', function () { currentSub().then(function (s) { if (!s) return; var ep = s.endpoint; return s.unsubscribe().then(function () { return api('POST', '/push/unsubscribe', { endpoint: ep }); }); }).then(loadSettings).then(function () { toast('Obavještenja su isključena'); settingsView(); }); });
      on('[data-install]', function () { if (!installEvt) return; installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; settingsView(); }); });
      $$('[name=theme]').forEach(function (r) { r.addEventListener('change', function () { var root = document.documentElement; if (r.value === 'auto') { root.removeAttribute('data-theme'); try { localStorage.removeItem('mly-admin-theme'); } catch (er) {} } else { root.setAttribute('data-theme', r.value); try { localStorage.setItem('mly-admin-theme', r.value); } catch (er) {} } }); });
    });
  }

  /* ---------- podsjetnici na početnoj planera ---------- */
  function remindersHtml() {
    var t = todayISO(), tm = addDays(t, 1), rows = [];
    B.filter(function (b) { return b.status === 'confirmed' && b.date === tm; }).forEach(function (b) { rows.push('<div class="rem"><span class="ri st-confirmed">' + IC.bell + '</span><span class="rb"><b>Sutra: ' + esc(shortTour(b.data)) + (b.data.time ? ' · ' + esc(timeText(b.data.time)) : '') + '</b><small>' + esc(b.data.name || '') + ' · ' + guests(b.data) + '</small></span><button type="button" class="btn sm" data-rmsg="' + esc(b.id) + '|reminder">Podsjeti gosta</button></div>'); });
    B.filter(function (b) { return b.status === 'confirmed' && b.date && b.date < t; }).slice(0, 5).forEach(function (b) { rows.push('<div class="rem"><span class="ri st-done">' + IC.check + '</span><span class="rb"><b>Tura je prošla: ' + esc(b.data.name || '') + '</b><small>' + esc(shortTour(b.data)) + ' · ' + esc(fmtDay(b.date)) + '</small></span><button type="button" class="btn sm line" data-rdone="' + esc(b.id) + '">Završeno ✓</button></div>'); });
    B.filter(function (b) { return b.status === 'done' && !b.data.reviewAsked && b.date && b.date >= addDays(t, -30) && (b.data.phone || b.data.email || b.data.instagram); }).slice(0, 3).forEach(function (b) { rows.push('<div class="rem"><span class="ri st-replied">' + IC.star + '</span><span class="rb"><b>Zamolite za recenziju</b><small>' + esc(b.data.name || '') + ' · ' + esc(shortTour(b.data)) + '</small></span><button type="button" class="btn sm" data-rmsg="' + esc(b.id) + '|review">Pošalji</button></div>'); });
    return rows.length ? '<div class="rems">' + rows.join('') + '</div>' : '';
  }
  function bindReminders() {
    $$('[data-rdone]').forEach(function (b) { b.addEventListener('click', function () { b.disabled = true; patchBooking(b.getAttribute('data-rdone'), 'done').then(function () { toast('Označeno kao završeno'); plannerHome(); }).catch(function (e) { b.disabled = false; toast(e.message, true); }); }); });
    $$('[data-rmsg]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-rmsg').split('|'), bk = B.filter(function (x) { return x.id === a[0]; })[0]; if (bk) msgFlow({ id: bk.id, status: bk.status, date: bk.date, data: bk.data }, a[1], plannerHome); }); });
  }

  /* ---------- router ---------- */
  function route() {
    lastHash = location.hash || '#/planer';
    var hq = lastHash.split('?'), parts = hq[0].replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    if (parts[0] === 'planer' && parts[1]) return bookingEditor(decodeURIComponent(parts[1]), hq[1] || '');
    if (parts[0] === 'planer' || parts[0] === '') return plannerHome();
    if (parts[0] === 'ture' && parts[1]) return tourEditor(decodeURIComponent(parts[1]));
    if (parts[0] === 'recenzije' && parts[1]) return reviewEditor(decodeURIComponent(parts[1]));
    if (parts[0] === 'recenzije') return reviewsList();
    if (parts[0] === 'slike') return mediaList();
    if (parts[0] === 'vise') { var V = { pregled: statsView, gosti: guestsView, sabloni: templatesView, zauzeto: blockedView, tekstovi: siteView, postavke: settingsView }; return (V[parts[1]] || viseHome)(); }
    if (parts[0] === 'ture') return toursList();
    return plannerHome();
  }

  // the service worker is only for notifications and for installing the admin as an app
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(function () {});
  Promise.all([load(), loadBookings(), loadSettings()]).then(route).catch(function (e) {
    app.innerHTML = '<div class="boot"><div style="text-align:center;padding:1rem"><h1>Mostarly admin</h1><p>' + esc(e.status === 401 ? 'Niste prijavljeni. Osvježite stranicu da se prijavite.' : e.message) + '</p><p><a href="/admin/">Pokušaj ponovo</a></p></div></div>';
  });
})();
