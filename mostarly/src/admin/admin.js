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
    var t = S.tours.length, r = S.reviews.length, m = S.media.length, n = (typeof newCount === 'function') ? newCount() : 0;
    var tabs = [['planer', 'Planer', n ? '<i class="dot">' + n + '</i>' : ''], ['ture', 'Ture', '<span>' + t + '</span>'], ['recenzije', 'Recenzije', '<span>' + r + '</span>'], ['slike', 'Slike', '<span>' + m + '</span>']];
    var icons = { planer: 'cal', ture: 'tours', recenzije: 'star', slike: 'photo' };
    var editing = /^#\/(planer|ture|recenzije)\/.+/.test(location.hash);
    app.innerHTML = '<header class="top"><a class="brand" href="#/planer">Mostarly <small>Admin</small></a>' +
      '<nav class="tabs" aria-label="Dijelovi">' + tabs.map(function (x) { return '<a href="#/' + x[0] + '"' + (tab === x[0] ? ' class="on"' : '') + '>' + x[1] + x[2] + '</a>'; }).join('') + '</nav>' +
      '<div class="who"><span class="em">' + esc(S.email) + '</span><a href="/" target="_blank" rel="noopener">Sajt ↗</a></div></header><main class="v-' + tab + '">' + inner + '</main>' +
      (editing ? '' : '<nav class="bnav" aria-label="Dijelovi">' + tabs.map(function (x) { return '<a href="#/' + x[0] + '"' + (tab === x[0] ? ' class="on" aria-current="page"' : '') + '>' + IC[icons[x[0]]] + '<span>' + x[1] + '</span>' + (x[0] === 'planer' && n ? '<i>' + n + '</i>' : '') + '</a>'; }).join('') + '</nav>');
    document.body.classList.toggle('has-bnav', !editing);
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
      var v = el.hasAttribute('data-bool') ? (el.hasAttribute('data-invert') ? !el.checked : el.checked) : el.hasAttribute('data-num') ? (el.value === '' ? (p === 'data.price' ? null : 0) : Number(el.value)) : el.value;
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
      (next ? '<a class="next" href="#/planer/' + esc(next.id) + '"><div class="next-d"><b>' + dObj(next.date).getUTCDate() + '</b><span>' + MONTHS[dObj(next.date).getUTCMonth()].slice(0, 3) + '</span></div><div class="next-b"><small>Sljedeća tura · ' + esc(relDay(next.date).indexOf(',') > 0 ? cap(DAYS[dObj(next.date).getUTCDay()]) : relDay(next.date)) + (next.data.time ? ' · ' + esc(timeText(next.data.time)) : '') + '</small><b>' + esc(shortTour(next.data)) + '</b><span>' + IC.users + esc(next.data.name) + ' · ' + guests(next.data) + (next.data.meeting ? ' · ' + esc(next.data.meeting) : '') + '</span></div><span class="next-go">›</span></a>' : '') +
      '<div class="pseg" role="tablist"><button type="button" role="tab" data-pv="upiti" aria-selected="' + (PV.view === 'upiti') + '">' + IC.mail + 'Upiti' + (nNew ? '<i>' + nNew + '</i>' : '') + '</button><button type="button" role="tab" data-pv="kalendar" aria-selected="' + (PV.view === 'kalendar') + '">' + IC.cal + 'Kalendar</button><button type="button" role="tab" data-pv="plan" aria-selected="' + (PV.view === 'plan') + '">' + IC.plan + 'Plan</button></div>' +
      '<div class="pview">' + view + '</div><a class="fab" href="#/planer/novi' + (PV.view === 'kalendar' && PV.day ? '?d=' + PV.day : '') + '" aria-label="Dodaj upit ili turu">+</a>');
    $$('[data-pv]').forEach(function (b) { b.addEventListener('click', function () { PV.view = b.getAttribute('data-pv'); plannerHome(); }); });
    $$('[data-kpi]').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-kpi'); if (k === 'new') { PV.view = 'upiti'; PV.filter = 'new'; } else { PV.view = 'plan'; } plannerHome(); }); });
    $$('[data-f]').forEach(function (b) { b.addEventListener('click', function () { PV.filter = b.getAttribute('data-f'); plannerHome(); }); });
    var q = $('#pq'); if (q) q.addEventListener('input', function () { PV.q = q.value; var l = $('#plist'); if (l) l.innerHTML = inboxList(); });
    $$('[data-mon]').forEach(function (b) { b.addEventListener('click', function () { var m = PV.month.split('-'), d = new Date(Date.UTC(+m[0], +m[1] - 1 + (+b.getAttribute('data-mon')), 1)); PV.month = d.toISOString().slice(0, 7); PV.day = null; plannerHome(); }); });
    $$('[data-day]').forEach(function (b) { b.addEventListener('click', function () { PV.day = b.getAttribute('data-day'); plannerHome(); var s = $('#dayl'); if (s && innerWidth < 800) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); });
    var tdy = $('[data-today]'); if (tdy) tdy.addEventListener('click', function () { PV.month = todayISO().slice(0, 7); PV.day = todayISO(); plannerHome(); });
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
    return '<div class="psearch">' + '<input id="pq" type="search" placeholder="Traži ime, turu, telefon…" value="' + esc(PV.q) + '" aria-label="Pretraga"></div>' +
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
      cells += '<button type="button" class="cd' + (iso === t ? ' today' : '') + (iso === PV.day ? ' sel' : '') + (iso < t ? ' past' : '') + (l.length ? ' has' : '') + '" data-day="' + iso + '" aria-label="' + d + '. ' + MONTHS[mo] + (l.length ? ', ' + l.length + ' upis' : '') + '"><b>' + d + '</b><span class="dots">' + l.slice(0, 4).map(function (b) { return '<i class="st-' + b.status + '"></i>'; }).join('') + '</span></button>';
    }
    var dayList = '';
    if (PV.day) {
      var l2 = B.filter(function (b) { return b.date === PV.day; }).sort(function (a, b) { return String(a.data.time).localeCompare(String(b.data.time)); });
      dayList = '<div class="dayl" id="dayl"><div class="row"><h3>' + esc(relDay(PV.day)) + '</h3><span class="spacer"></span><a class="btn sm mint" href="#/planer/novi?d=' + PV.day + '">+ Dodaj za ovaj dan</a></div>' + (l2.length ? l2.map(bkCard).join('') : '<p class="pempty"><span>Ovaj dan je slobodan.</span></p>') + '</div>';
    }
    return '<div class="cal"><div class="cal-h"><button type="button" class="icon" data-mon="-1" aria-label="Prethodni mjesec">‹</button><b>' + cap(MONTHS[mo]) + ' ' + y + '</b><button type="button" class="icon" data-mon="1" aria-label="Sljedeći mjesec">›</button><span class="spacer"></span><button type="button" class="btn sm line" data-today>Danas</button></div>' +
      '<div class="cal-g">' + ['P', 'U', 'S', 'Č', 'P', 'S', 'N'].map(function (x) { return '<span class="cw">' + x + '</span>'; }).join('') + cells + '</div>' +
      '<div class="legend">' + ['new', 'replied', 'confirmed', 'done'].map(function (s) { return '<span><i class="st-' + s + '"></i>' + ST[s] + '</span>'; }).join('') + '</div></div>' + dayList;
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
    if (ph) acts.push('<a class="qa wa" href="https://wa.me/' + ph + '?text=' + encodeURIComponent(waText(draft)) + '" target="_blank" rel="noopener">' + IC.wa + '<span>WhatsApp</span></a>', '<a class="qa" href="tel:+' + ph + '">' + IC.phone + '<span>Pozovi</span></a>');
    if (d.email) acts.push('<a class="qa" href="mailto:' + esc(d.email) + '?subject=' + encodeURIComponent('Your tour in Mostar: ' + shortTour(d)) + '&body=' + encodeURIComponent(waText(draft)) + '">' + IC.mail + '<span>Email</span></a>');
    if (d.instagram) acts.push('<a class="qa" href="https://instagram.com/' + esc(d.instagram) + '" target="_blank" rel="noopener">' + IC.ig + '<span>Instagram</span></a>');
    if (draft.date) acts.push('<a class="qa" href="' + esc(gcalUrl(draft)) + '" target="_blank" rel="noopener">' + IC.gcal + '<span>U kalendar</span></a>');
    acts.push('<button type="button" class="qa" data-copy>' + IC.copy + '<span>Kopiraj</span></button>');
    var fromTime = d.time && !/^\d{1,2}:\d{2}$/.test(d.time) ? '<small>Gost je izabrao: <b>' + esc(timeText(d.time)) + '</b>. Kad dogovorite tačno vrijeme, upišite ga.</small>' : '';
    shell('planer', '<a class="back" href="#/planer">← Planer</a>' +
      '<div class="bk-head"><h1>' + (isNew ? 'Novi upit' : esc(d.name || 'Upit')) + '</h1>' + (isNew ? '<p class="sub">Dodajte upit ili dogovorenu turu koja je stigla preko Instagrama, telefona, uživo…</p>' : '<p class="sub">' + IC[SRC_IC[draft.source] || 'dots'] + ' ' + esc(SRC[draft.source] || '') + ' · stiglo ' + esc(ago(draft.created_at)) + '</p>') + '</div>' +
      '<div class="stsel" role="radiogroup" aria-label="Status">' + Object.keys(ST).map(function (s) { return '<label class="st-' + s + '"><input type="radio" name="bst" value="' + s + '"' + (draft.status === s ? ' checked' : '') + '><span>' + ST[s] + '</span></label>'; }).join('') + '</div>' +
      (acts.length > 1 || !isNew ? '<div class="qas">' + acts.join('') + '</div>' : '') +
      '<form id="ed" autocomplete="off" novalidate>' +
      '<section class="card"><h2>Gost</h2>' + field('Ime i prezime', 'data.name', { ph: 'npr. Anna Müller' }) + '<div class="two">' + field('Telefon / WhatsApp', 'data.phone', { ph: '+49 170 1234567' }) + field('Email', 'data.email', { ph: 'ime@email.com' }) + field('Instagram', 'data.instagram', { ph: '@korisnik' }) + field('Jezik', 'data.lang', { ph: 'English, Deutsch…' }) + '</div>' +
      (site ? '' : '<div class="f"><span>Odakle je stiglo</span><div class="seg src-seg">' + ['instagram', 'whatsapp', 'phone', 'email', 'agency', 'walkin', 'other'].map(function (s) { return '<label><input type="radio" name="bsrc" value="' + s + '"' + (draft.source === s ? ' checked' : '') + '><span>' + IC[SRC_IC[s]] + SRC[s] + '</span></label>'; }).join('') + '</div></div>') + '</section>' +
      '<section class="card"><h2>Tura</h2><label class="f"><span>Koja tura</span><select data-path="data.tourSlug">' + tourOpts + '</select></label>' + (d.tourSlug ? '' : field('Opis ture (ako nije sa liste)', 'data.tour', { ph: 'npr. Sarajevo day trip' })) +
      '<div class="two"><label class="f"><span>Datum</span><input type="date" data-path="date" value="' + esc(draft.date || '') + '"></label><label class="f"><span>Vrijeme</span><input type="time" data-path="data.time" value="' + (/^\d{1,2}:\d{2}$/.test(d.time) ? esc(d.time.padStart(5, '0')) : '') + '">' + fromTime + '</label></div>' +
      field('Mjesto sastanka', 'data.meeting', { ph: 'npr. ispred Hamama' }) + '</section>' +
      '<section class="card"><h2>Gosti</h2><div class="two">' + stepper('Odrasli', 'data.adults') + stepper('Djeca', 'data.children') + '</div>' + (d.children ? field('Godine djece', 'data.ages', { ph: 'npr. 6 i 9' }) : '') + '<div class="f"><span>Ulaznice</span><div class="ticks">' + tk + '</div></div></section>' +
      '<section class="card"><h2>Novac</h2><div class="two">' + field('Dogovorena cijena (€)', 'data.price', { num: true, ph: 'npr. 80' }) + '<div>' + toggle('Plaćeno', 'data.paid') + '</div></div></section>' +
      '<section class="card"><h2>Poruke</h2>' + field('Poruka gosta', 'data.message', { area: true, rows: 3 }) + field('Moja bilješka (vidim samo ja)', 'data.note', { area: true, rows: 3, ph: 'npr. dogovoreno 10h, platit će na licu mjesta' }) + '</section>' +
      (isNew ? '' : '<section class="card"><button type="button" class="btn danger" data-delbk>Obriši</button></section>') +
      '</form><div class="savebar"><div class="in"><span class="st">Sve je sačuvano</span><span class="spacer"></span><button class="btn mint" data-save>' + (isNew ? 'Dodaj' : 'Sačuvaj') + '</button></div></div>');
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
    var cp = $('[data-copy]'); if (cp) cp.addEventListener('click', function () { var t = summary(draft); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Detalji kopirani'); }).catch(function () { prompt('Kopirajte:', t); }); });
    var del = $('[data-delbk]'); if (del) del.addEventListener('click', function () { if (!confirm('Obrisati ovaj upit?')) return; api('DELETE', '/bookings/' + id).then(function () { setDirty(false); toast('Obrisano'); return loadBookings(); }).then(function () { location.hash = '#/planer'; }).catch(function (e) { toast(e.message, true); }); });
    if (isNew) { var n = $('[data-path="data.name"]'); if (n && innerWidth > 800) n.focus(); }
  }

  // a new enquiry while the planner is open: refresh when Mirna comes back to the tab, and every minute
  function refreshPlanner() { if (!/^#\/planer\/?$/.test(location.hash || '#/planer') || dirty) return; var before = B.length; loadBookings().then(function () { if (B.length !== before && /^#\/planer\/?$/.test(location.hash || '#/planer')) { plannerHome(); if (B.length > before) toast('Stigao je novi upit'); } }); }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshPlanner(); });
  setInterval(function () { if (!document.hidden) refreshPlanner(); }, 60000);

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
    if (parts[0] === 'ture') return toursList();
    return plannerHome();
  }

  Promise.all([load(), loadBookings()]).then(route).catch(function (e) {
    app.innerHTML = '<div class="boot"><div style="text-align:center;padding:1rem"><h1>Mostarly admin</h1><p>' + esc(e.status === 401 ? 'Niste prijavljeni. Osvježite stranicu da se prijavite.' : e.message) + '</p><p><a href="/admin/">Pokušaj ponovo</a></p></div></div>';
  });
})();
