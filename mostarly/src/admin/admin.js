/* Mostarly admin: tours, prices, photos and reviews. Every save is published to the site at once. */
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
  function setDirty(v) { dirty = v; var st = $('.savebar .st'); if (st) { st.textContent = v ? 'Ima nesačuvanih izmjena' : 'Sve je sačuvano'; st.classList.toggle('dirty', v); } }
  function load() { return api('GET', '/state').then(function (j) { S = j; }); }

  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  var lastHash = location.hash;
  window.addEventListener('hashchange', function () {
    if (dirty && !confirm('Imate nesačuvane izmjene. Želite li izaći bez snimanja?')) { history.replaceState(null, '', lastHash); return; }
    setDirty(false); route();
  });

  /* ---------- layout ---------- */
  function shell(tab, inner) {
    var t = S.tours.length, r = S.reviews.length, m = S.media.length;
    app.innerHTML = '<header class="top"><a class="brand" href="#/ture">Mostarly <small>Admin</small></a>' +
      '<nav class="tabs" aria-label="Dijelovi"><a href="#/ture"' + (tab === 'ture' ? ' class="on"' : '') + '>Ture<span>' + t + '</span></a><a href="#/recenzije"' + (tab === 'recenzije' ? ' class="on"' : '') + '>Recenzije<span>' + r + '</span></a><a href="#/slike"' + (tab === 'slike' ? ' class="on"' : '') + '>Slike<span>' + m + '</span></a></nav>' +
      '<div class="who"><span class="em">' + esc(S.email) + '</span><a href="/" target="_blank" rel="noopener">Pogledaj sajt ↗</a></div></header><main>' + inner + '</main>';
  }

  /* ---------- tours list ---------- */
  function toursList() {
    var rows = S.tours.map(function (t, i) {
      var d = t.data;
      return '<div class="item' + (t.hidden ? ' hid' : '') + '" data-slug="' + esc(t.slug) + '">' +
        '<div class="th">' + (d.image ? '<img src="' + esc(imgUrl(d.image)) + '" alt="" loading="lazy">' : esc((d.name || '?').charAt(0))) + '</div>' +
        '<div><b>' + esc(d.name) + '</b><div class="meta"><span>' + esc(catName(d.category)) + '</span><span>' + esc(priceText(d.price)) + '</span>' +
        (t.hidden ? '<span class="badge">Skrivena</span>' : '') + (d.featured ? '<span class="badge ok">Na početnoj</span>' : '') + (d.price && !d.price.confirmed ? '<span class="badge warn">Cijena za potvrdu</span>' : '') +
        ((d.notes || []).length ? '<span class="badge warn">' + d.notes.length + ' napomen' + (d.notes.length === 1 ? 'a' : 'e') + '</span>' : '') + '</div></div>' +
        '<div class="acts"><button class="icon" data-up="' + i + '" aria-label="Pomjeri gore"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="icon" data-down="' + i + '" aria-label="Pomjeri dole"' + (i === S.tours.length - 1 ? ' disabled' : '') + '>↓</button><a class="btn sm" href="#/ture/' + esc(t.slug) + '">Uredi</a></div></div>';
    }).join('');
    shell('ture', '<div class="row"><div><h1>Ture</h1><p class="sub">Redoslijed ovdje je redoslijed na sajtu. Promjene se objavljuju odmah.</p></div><span class="spacer"></span><a class="btn mint" href="#/ture/nova">+ Nova tura</a></div>' +
      '<div class="list">' + (rows || '<p class="empty">Još nema tura.</p>') + '</div>');
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
      return '<div class="li"><textarea data-path="' + path + '.' + i + (withOptional ? '.text' : '') + '" rows="1" placeholder="' + esc(ph) + '">' + esc(text) + '</textarea>' +
        '<div class="ctl">' + (withOptional ? '<label class="opt"><input type="checkbox" data-path="' + path + '.' + i + '.optional" data-bool' + (it.optional ? ' checked' : '') + '>opc.</label>' : '') +
        '<button type="button" class="icon" data-lmove="' + path + '|' + i + '|-1" aria-label="Gore"' + (i === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="icon" data-lmove="' + path + '|' + i + '|1" aria-label="Dole"' + (i === arr.length - 1 ? ' disabled' : '') + '>↓</button><button type="button" class="icon" data-ldel="' + path + '|' + i + '" aria-label="Obriši">×</button></div></div>';
    }).join('');
    return '<div class="f"><span>' + esc(title) + '</span><div class="le" data-list="' + path + '">' + rows + '<button type="button" class="add" data-ladd="' + path + '|' + (withOptional ? 1 : 0) + '">+ Dodaj</button></div></div>';
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
    var notes = (d.notes || []).length ? '<div class="notes"><b>Napomene za provjeru</b><ul>' + d.notes.map(function (n, i) { return '<li><span>' + esc(n) + '</span><button type="button" class="btn sm line" data-note="' + i + '">Riješeno ✓</button></li>'; }).join('') + '</ul><small>Kad nešto riješite, kliknite "Riješeno" pa sačuvajte. Žuta napomena tada nestaje i sa sajta.</small></div>' : '';
    var tickets = S.tickets.map(function (k) { return '<label><input type="checkbox" data-ticket="' + esc(k.id) + '"' + ((d.tickets || []).indexOf(k.id) > -1 ? ' checked' : '') + '>' + esc(k.label) + '<em>€' + k.price + '</em></label>'; }).join('');
    var gal = (d.gallery || []).map(function (g, i) { return '<div class="g"><img src="' + esc(imgUrl(g.src)) + '" alt=""><button type="button" class="mv" data-gmain="' + i + '" title="Postavi kao glavnu" aria-label="Postavi kao glavnu">★</button><button type="button" data-gdel="' + i + '" aria-label="Ukloni">×</button></div>'; }).join('');
    shell('ture', '<a class="back" href="#/ture">← Sve ture</a><h1>' + (isNew ? 'Nova tura' : esc(d.name)) + '</h1><p class="sub">' + (isNew ? 'Popunite osnovno i sačuvajte. Ostalo možete dodati kasnije.' : 'Tekst na sajtu pišite na engleskom. Nakon snimanja, promjena je odmah na sajtu.') + '</p>' + notes +
      '<form id="ed" autocomplete="off" novalidate>' +
      '<section class="card"><h2>Osnovno</h2>' + field('Naziv ture', 'data.name', { max: 160, ph: 'e.g. Mostar City Tour – Highlights of the Old Town' }) +
      '<label class="f"><span>Kategorija</span><select data-path="data.category">' + cats + '</select></label>' +
      field('Kratki opis (ispod naslova i na kartici)', 'data.tagline', { area: true, rows: 2, max: 400 }) + field('Opis ture', 'data.description', { area: true, rows: 6, max: 5000 }) + '</section>' +
      '<section class="card"><h2>Cijena</h2><p class="help">Svaka cijena mora reći da li je po osobi ili po grupi.</p>' +
      '<div class="f"><span>Kako se plaća</span><div class="seg">' + ['person', 'group', 'request'].map(function (b) { return '<label><input type="radio" name="basis" value="' + b + '"' + (p.basis === b ? ' checked' : '') + '><span>' + BASIS[b] + '</span></label>'; }).join('') + '</div></div>' +
      (p.basis !== 'request' ? '<div class="two">' + field('Iznos u eurima', 'data.price.amount', { num: true }) + '<div>' + toggle('Prikaži kao "od"', 'data.price.from', 'npr. "from €40 per person"') + '</div></div>' : '') +
      toggle('Cijena je potvrđena', 'data.price.confirmed', 'Dok nije, na sajtu stoji oznaka "to confirm".') +
      '<div class="preview" id="pprev">Na sajtu: <b>' + esc(priceText(p)) + '</b></div></section>' +
      '<section class="card"><h2>Slike</h2><div class="photo"><div class="pv">' + (d.image ? '<img src="' + esc(imgUrl(d.image)) + '" alt="">' : 'Nema glavne slike<br>(prikazuje se ćilim šara)') + '</div><div>' +
      '<div class="row"><button type="button" class="btn sm" data-pickmain>' + (d.image ? 'Promijeni glavnu sliku' : 'Dodaj glavnu sliku') + '</button>' + (d.image ? '<button type="button" class="btn sm line" data-nomain>Ukloni</button>' : '') + '</div>' +
      field('Opis slike (za slijepe i za Google)', 'data.imageAlt', { ph: 'e.g. The Old Bridge at sunset', max: 200 }) + '</div></div>' +
      '<div class="f" style="margin-top:.8rem"><span>Galerija na stranici ture</span><div class="gal">' + gal + '<button type="button" class="addg" data-pickgal>+ Dodaj slike</button></div><small>★ postavlja sliku kao glavnu.</small></div></section>' +
      '<section class="card"><h2>Detalji</h2><div class="two">' + field('Trajanje', 'data.duration', { ph: 'About 2 hours' }) + field('Lokacija', 'data.location', { ph: 'Old Town, Mostar' }) + field('Veličina grupe', 'data.groupSize', { ph: '2–20 people' }) + field('Jezici', 'data.languages', { ph: 'English' }) + '</div>' +
      field('Težina hodanja', 'data.level', { ph: 'Easy: uneven cobblestones and some steps' }) + field('Dostupnost', 'data.availability', { ph: 'Daily, by prior arrangement' }) + field('Mjesto sastanka', 'data.meetingPoint', { ph: 'In front of the Hamam, Old Town' }) + '</section>' +
      '<section class="card"><h2>Program ture</h2><p class="help">Redom kako gosti obilaze. "opc." znači da stanica ovisi o sezoni ili željama.</p>' + listEditor('Stanice', 'data.itinerary', 'e.g. Meet in front of the Hamam.', true) + '</section>' +
      '<section class="card"><h2>Šta je uključeno</h2>' + listEditor('Uključeno', 'data.included', 'e.g. Licensed local guide') + listEditor('Nije uključeno / plaća se posebno', 'data.notIncluded', 'e.g. Entrance tickets') + listEditor('Dobro je znati', 'data.practical', 'e.g. Wear comfortable shoes.') + '</section>' +
      '<section class="card"><h2>Ulaznice u formi za upit</h2><p class="help">Gosti ih mogu označiti kad šalju upit za ovu turu.</p><div class="ticks">' + tickets + '</div></section>' +
      '<section class="card"><h2>Prikaz</h2>' + toggle('Prikaži turu na sajtu', 'hidden', 'Isključeno: tura je sakrivena, ali ostaje ovdje sačuvana.', true) + toggle('Istakni na početnoj stranici', 'data.featured', 'Među "Featured tours" na vrhu početne.') + '</section>' +
      '<section class="card"><details class="adv"' + (d.seoTitle || d.seoDescription ? '' : '') + '><summary>Za Google (naslov i opis u pretrazi)</summary>' + field('Naslov u Googleu', 'data.seoTitle', { max: 65, hint: 'Do 60 znakova. Ako je prazno, koristi se naziv ture.' }) + field('Opis u Googleu', 'data.seoDescription', { area: true, rows: 3, max: 160, hint: 'Do 155 znakova: šta gost dobije, gdje i koliko traje.' }) + '</details></section>' +
      (isNew ? '' : '<section class="card"><h2>Brisanje</h2><p class="help">Ako turu samo želite skloniti sa sajta, isključite "Prikaži turu na sajtu". Brisanje se ne može vratiti.</p><button type="button" class="btn danger" data-deltour>Obriši turu</button></section>') +
      '</form><div class="savebar"><div class="in"><span class="st">Sve je sačuvano</span><span class="spacer"></span>' + (isNew ? '' : '<a class="btn line sm" href="/tours/' + esc(slug) + '/" target="_blank" rel="noopener">Pogledaj ↗</a>') + '<button class="btn mint" data-save>' + (isNew ? 'Sačuvaj i objavi' : 'Sačuvaj') + '</button></div></div>');
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
      var v = el.hasAttribute('data-bool') ? (el.hasAttribute('data-invert') ? !el.checked : el.checked) : el.hasAttribute('data-num') ? (el.value === '' ? 0 : Number(el.value)) : el.value;
      set(draft, p, v); setDirty(true);
      var c = $('[data-count="' + p + '"]'); if (c) { var mx = +c.textContent.split('/ ')[1]; c.textContent = String(el.value).length + ' / ' + mx; c.classList.toggle('over', String(el.value).length > mx); }
      if (p.indexOf('data.price') === 0) { var pp = $('#pprev b'); if (pp) pp.textContent = priceText(draft.data.price); }
      if (el.tagName === 'TEXTAREA' && el.closest('.le')) autoGrow(el);
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    $$('.le textarea').forEach(autoGrow);
    $$('[data-ladd]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-ladd').split('|'), arr = get(draft, a[0]) || []; arr.push(a[1] === '1' ? { text: '', optional: false } : ''); set(draft, a[0], arr); rerender(); setDirty(true); var all = $$('[data-list="' + a[0] + '"] textarea'); if (all.length) all[all.length - 1].focus(); }); });
    $$('[data-ldel]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-ldel').split('|'); get(draft, a[0]).splice(+a[1], 1); rerender(); setDirty(true); }); });
    $$('[data-lmove]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-lmove').split('|'), arr = get(draft, a[0]), i = +a[1], j = i + (+a[2]); var x = arr[i]; arr[i] = arr[j]; arr[j] = x; rerender(); setDirty(true); }); });
    var sb = $('[data-save]');
    sb.addEventListener('click', function () {
      if (saving) return; saving = true; sb.disabled = true; sb.textContent = 'Snimam…';
      Promise.resolve(save()).catch(function (e) { toast(e.message, true); }).then(function () { saving = false; var b = $('[data-save]'); if (b) { b.disabled = false; b.textContent = 'Sačuvaj'; } });
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
    var wrap = document.createElement('div'); wrap.className = 'modal'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Izaberi sliku');
    wrap.innerHTML = '<div class="box"><div class="row"><h2>' + (multi ? 'Dodaj slike' : 'Izaberi sliku') + '</h2><span class="spacer"></span><button class="icon" data-close aria-label="Zatvori">×</button></div>' +
      (S.mediaReady ? '<label class="upl"><input type="file" accept="image/*"' + (multi ? ' multiple' : '') + '>📷 <span>Učitaj ' + (multi ? 'slike' : 'sliku') + ' sa telefona ili računara</span></label>' : '<p class="empty">Učitavanje slika još nije uključeno (R2). Izaberite jednu od postojećih.</p>') +
      '<p class="sub" style="margin:1rem 0 0">Ili izaberite postojeću:</p><div class="pick">' + lib.map(function (s) { return '<button type="button" data-src="' + esc(s) + '"><img src="' + esc(imgUrl(s)) + '" alt="" loading="lazy"></button>'; }).join('') + '</div></div>';
    document.body.appendChild(wrap);
    function close() { wrap.remove(); }
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('[data-close]')) close(); var b = e.target.closest('[data-src]'); if (b) { close(); done([b.getAttribute('data-src')]); } });
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
      return '<div class="item' + (r.hidden ? ' hid' : '') + '"><div class="th">' + '★'.repeat(1) + '</div><div><b>' + esc(d.name) + (d.country ? ' · ' + esc(d.country) : '') + '</b><div class="meta"><span>' + '★'.repeat(d.rating || 5) + '</span><span>' + esc((d.text || '').slice(0, 70)) + (d.text && d.text.length > 70 ? '…' : '') + '</span>' + (r.hidden ? '<span class="badge">Skrivena</span>' : '') + '</div></div>' +
        '<div class="acts"><button class="icon" data-rup="' + i + '" aria-label="Gore"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="icon" data-rdown="' + i + '" aria-label="Dole"' + (i === S.reviews.length - 1 ? ' disabled' : '') + '>↓</button><a class="btn sm" href="#/recenzije/' + esc(r.id) + '">Uredi</a></div></div>';
    }).join('');
    shell('recenzije', '<div class="row"><div><h1>Recenzije</h1><p class="sub">Prepišite prave recenzije gostiju (npr. sa Tripadvisora), riječ po riječ.</p></div><span class="spacer"></span><a class="btn mint" href="#/recenzije/nova">+ Nova recenzija</a></div><div class="list">' + (rows || '<p class="empty">Još nema recenzija. Dok ih nema, na sajtu stoje prazna mjesta.</p>') + '</div>');
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
    shell('recenzije', '<a class="back" href="#/recenzije">← Sve recenzije</a><h1>' + (isNew ? 'Nova recenzija' : esc(d.name)) + '</h1><p class="sub">Tekst prepišite tačno kako ga je gost napisao.</p><form id="ed" autocomplete="off" novalidate><section class="card">' +
      '<div class="two">' + field('Ime gosta', 'data.name', { ph: 'e.g. Anna K.' }) + field('Zemlja', 'data.country', { ph: 'e.g. Germany' }) + field('Datum', 'data.date', { ph: 'e.g. October 2026' }) +
      '<label class="f"><span>Izvor</span><select data-path="data.source">' + SOURCES.map(function (s) { return '<option' + (d.source === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="f"><span>Ocjena</span><div class="stars" role="radiogroup" aria-label="Ocjena">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-star="' + n + '" class="' + (n <= d.rating ? 'on' : '') + '" aria-label="' + n + ' od 5">★</button>'; }).join('') + '</div></div>' +
      field('Naslov recenzije (ako postoji)', 'data.title', { max: 140 }) + field('Tekst recenzije', 'data.text', { area: true, rows: 7, max: 2500 }) +
      toggle('Prikaži na sajtu', 'hidden', '', true) + '</section>' + (isNew ? '' : '<section class="card"><button type="button" class="btn danger" data-delrev>Obriši recenziju</button></section>') +
      '</form><div class="savebar"><div class="in"><span class="st">Sve je sačuvano</span><span class="spacer"></span><button class="btn mint" data-save>' + (isNew ? 'Sačuvaj i objavi' : 'Sačuvaj') + '</button></div></div>');
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
    shell('slike', '<div class="row"><div><h1>Slike</h1><p class="sub">Sve učitane slike. Prije učitavanja se same smanje, da sajt ostane brz.</p></div><span class="spacer"></span>' + (S.mediaReady ? '<label class="btn mint">+ Učitaj slike<input type="file" accept="image/*" multiple hidden id="mup"></label>' : '') + '</div>' +
      (S.media.length ? '<div class="media-grid">' + S.media.map(function (m) { return '<div class="m"><img src="/media/' + esc(m.key) + '" alt="" loading="lazy"><div><span title="' + esc(m.name) + '">' + esc(m.name) + ' · ' + kb(m.size) + '</span><button class="icon" data-mdel="' + esc(m.key) + '" aria-label="Obriši">×</button></div></div>'; }).join('') + '</div>' : '<p class="empty">Još nema učitanih slika. Slike dodajete i direktno iz ture.</p>'));
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

  /* ---------- router ---------- */
  function route() {
    lastHash = location.hash || '#/ture';
    var parts = lastHash.replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    if (parts[0] === 'ture' && parts[1]) return tourEditor(decodeURIComponent(parts[1]));
    if (parts[0] === 'recenzije' && parts[1]) return reviewEditor(decodeURIComponent(parts[1]));
    if (parts[0] === 'recenzije') return reviewsList();
    if (parts[0] === 'slike') return mediaList();
    return toursList();
  }

  load().then(route).catch(function (e) {
    app.innerHTML = '<div class="boot"><div style="text-align:center;padding:1rem"><h1>Mostarly admin</h1><p>' + esc(e.status === 401 ? 'Niste prijavljeni. Osvježite stranicu da se prijavite.' : e.message) + '</p><p><a href="/admin/">Pokušaj ponovo</a></p></div></div>';
  });
})();
