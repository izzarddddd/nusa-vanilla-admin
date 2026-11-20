/* Portal admin Nusa Vanilla (aplikasi terpisah): dashboard, produk, RFQ, buyer. */
(function () {
  const { esc, $, $$, fmtDate, fmtDay, toast, seo, download } = window.NV;
  const L = window.NVLib, D = window.NVData;
  const usd = L.formatUSD;
  const nf = n => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  const BADGE = { PENDING: 'warn', QUOTED: '', CONFIRMED: 'ok', CANCELLED: 'bad', AVAILABLE: 'ok', OUT_OF_STOCK: 'warn', ARCHIVED: '', REPEAT: 'ok', CUSTOMER: 'ok', PROSPECT: 'warn', INACTIVE: '' };
  const badge = (s, label) => `<span class="a-badge ${BADGE[s] || ''}">${esc(label || L.STATUS_LABEL[s] || s)}</span>`;
  const buyerBadge = st => badge(L.buyerLabel(st), L.BUYER_LABEL[L.buyerLabel(st)]);
  const skeleton = `<div class="a-card">${'<div class="a-skel"></div>'.repeat(6)}</div>`;
  const errBox = m => `<div class="a-card a-empty">${esc(m)}<div style="margin-top:12px"><button class="a-btn" data-retry>Coba lagi</button></div></div>`;
  const STALE_DAYS = 2;

  /* Konfirmasi sebelum aksi destruktif */
  function confirmBox(msg, label = 'Hapus') {
    return new Promise(res => {
      const bg = document.createElement('div'); bg.className = 'a-modal-bg';
      bg.innerHTML = `<div class="a-modal" role="alertdialog" aria-modal="true" style="width:min(440px,100%)"><h2>Konfirmasi</h2><p style="margin:10px 0 0">${esc(msg)}</p><div class="a-actions"><button class="a-btn bad" data-ok>${esc(label)}</button><button class="a-btn" data-no>Batal</button></div></div>`;
      document.body.appendChild(bg);
      const done = v => { bg.remove(); res(v); };
      bg.addEventListener('click', e => { if (e.target.dataset.ok != null) done(true); if (e.target.dataset.no != null || e.target === bg) done(false); });
      $('[data-no]', bg).focus();
    });
  }

  function shell(tab, inner) {
    const link = (k, t) => `<a href="#/${k}" class="${tab === k ? 'on' : ''}">${t}</a>`;
    return `<div class="a-shell"><aside class="a-side"><div class="a-brand">Nusa Vanilla <small>Admin</small></div>${link('', 'Dashboard')}${link('inquiries', 'Inquiry RFQ')}${link('buyers', 'Buyer')}${link('products', 'Produk')}<div class="grow"></div><a href="${esc(window.PUBLIC_SITE_URL || '#')}" target="_blank" rel="noopener">Lihat situs ↗</a><a href="#" id="out">Keluar</a></aside><main class="a-main" id="a-main">${inner}</main></div>`;
  }
  function bindShell(app) { const o = $('#out', app); o.onclick = async e => { e.preventDefault(); await D.logout(); location.hash = '#/login'; }; }

  async function guard(next) {
    let ok = false;
    try { ok = await D.isAdmin(); } catch (_) {}
    if (!ok) { location.hash = '#/login?next=' + encodeURIComponent(next); return false; }
    return true;
  }

  /* ───────── login ───────── */
  let fails = 0;
  function login(app) {
    seo('Masuk | Admin Nusa Vanilla');
    const next = decodeURIComponent((location.hash.split('?next=')[1] || '#/'));
    app.innerHTML = `<div class="a-login"><form class="a-card" novalidate><h1 style="margin:0 0 4px;font-size:1.3rem">Masuk admin</h1><p style="margin:0 0 8px;color:#71717a;font-size:.9rem">Portal pengelola Nusa Vanilla.</p>
      <label class="a-label" for="a-em">Email</label><input class="a-in" id="a-em" type="email" autocomplete="username" required>
      <label class="a-label" for="a-pw">Kata sandi</label><input class="a-in" id="a-pw" type="password" autocomplete="current-password" required>
      <div class="a-err" id="a-e" role="alert"></div><div class="a-actions"><button class="a-btn pri" type="submit">Masuk</button></div></form></div>`;
    $('form', app).addEventListener('submit', async e => {
      e.preventDefault();
      const b = $('button', app), er = $('#a-e', app); er.textContent = '';
      b.disabled = true;
      if (fails) await new Promise(r => setTimeout(r, Math.min(8000, 1000 * 2 ** (fails - 1))));  // jeda membesar, akun tidak dikunci permanen
      const ok = await D.login($('#a-em', app).value.trim(), $('#a-pw', app).value);
      const admin = ok && await D.isAdmin();
      if (!admin) { if (ok) await D.logout(); fails++; er.textContent = 'Email atau kata sandi salah.'; b.disabled = false; return; }
      fails = 0; location.hash = next.startsWith('#/') && !next.startsWith('#/login') ? next : '#/';
    });
    $('#a-em', app).focus();
  }

  /* ───────── dashboard ───────── */
  const monthKey = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7);
  const monthLabel = k => new Date(k + '-15').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
  function topBy(rows, keyFn, valFn, n = 5) {
    const m = new Map();
    for (const r of rows) { const k = keyFn(r); if (!k) continue; m.set(k, (m.get(k) || 0) + valFn(r)); }
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
  }
  const rankList = (items, fmt) => items.length ? `<table class="a-tbl">${items.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${fmt(v)}</td></tr>`).join('')}</table>` : '<div class="a-empty" style="padding:14px">Belum ada data.</div>';

  async function dashboard(app) {
    if (!await guard('#/')) return;
    seo('Dashboard | Admin Nusa Vanilla');
    app.innerHTML = shell('', `<h1>Dashboard</h1><div id="d">${skeleton}</div>`); bindShell(app);
    try {
      const [rows, prods, buyers] = await Promise.all([D.inquiryStats(), D.products(), D.buyers()]);
      const by = s => rows.filter(i => i.status === s), sum = l => L.round2(l.reduce((a, i) => a + L.inquiryValue(i), 0));
      const pending = by('PENDING'), quoted = by('QUOTED'), confirmed = by('CONFIRMED');
      const lowN = prods.filter(p => L.isLowStock(p) || p.status === 'OUT_OF_STOCK').length;
      const done = confirmed.length + by('CANCELLED').length + quoted.length + pending.length;
      const rate = done ? Math.round(confirmed.length / done * 100) : 0;
      const cutoff = Date.now() - STALE_DAYS * 864e5;
      const stale = pending.filter(i => new Date(i.created_at) < cutoff);
      const months = []; for (let k = 5; k >= 0; k--) { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - k); months.push(monthKey(d)); }
      const perMonth = months.map(k => { const l = rows.filter(i => monthKey(i.created_at) === k); return { k, n: l.length, v: sum(l.filter(i => i.status !== 'CANCELLED')) }; });
      const maxN = Math.max(1, ...perMonth.map(m => m.n));
      const kpi = (t, v, sub = '') => `<div class="a-card"><b>${v}</b><span>${t}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
      $('#d', app).innerHTML = `<div class="a-kpis">
          ${kpi('RFQ menunggu', pending.length, usd(sum(pending)))}
          ${kpi('Penawaran dikirim', quoted.length, usd(sum(quoted)))}
          ${kpi('Dikonfirmasi', confirmed.length, usd(sum(confirmed)))}
          ${kpi('Konversi', rate + '%', 'RFQ → dikonfirmasi')}
          ${kpi('Buyer', buyers.length)}
          ${kpi('Stok menipis / habis', lowN)}</div>
        ${stale.length ? `<div class="a-card a-alert"><b>${stale.length} RFQ menunggu lebih dari ${STALE_DAYS} hari.</b> <a href="#/inquiries?status=PENDING">Tindak lanjuti sekarang</a></div>` : ''}
        <div class="a-cols">
          <div class="a-card"><h2 class="a-h2">RFQ per bulan</h2><div class="a-bars">${perMonth.map(m => `<div class="a-bar" title="${m.n} RFQ · ${usd(m.v)}"><i style="height:${Math.round(m.n / maxN * 100)}%"></i><span>${m.n}</span><small>${monthLabel(m.k)}</small></div>`).join('')}</div></div>
          <div class="a-card"><h2 class="a-h2">Produk paling diminta (kg)</h2>${rankList(topBy(rows.filter(i => i.status !== 'CANCELLED'), i => i.vanilla_products?.name, i => +i.quantity_kg), v => nf(v) + ' kg')}</div>
          <div class="a-card"><h2 class="a-h2">Negara teratas (nilai RFQ)</h2>${rankList(topBy(rows.filter(i => i.status !== 'CANCELLED'), i => i.country, L.inquiryValue), usd)}</div>
          <div class="a-card"><h2 class="a-h2">RFQ terbaru</h2>${rows.length ? `<table class="a-tbl">${rows.slice(0, 5).map(i => `<tr><td>${fmtDay(i.created_at)}<br><small>${esc(i.vanilla_products?.name)}</small></td><td class="num">${nf(i.quantity_kg)} kg</td><td>${badge(i.status)}</td></tr>`).join('')}</table>` : '<div class="a-empty" style="padding:14px">Belum ada RFQ.</div>'}</div>
        </div>`;
    } catch (e) { $('#d', app).innerHTML = errBox(e.message); $('[data-retry]', app).onclick = () => dashboard(app); }
  }

  /* ───────── produk ───────── */
  const pstate = { deleted: false };
  async function productsPage(app) {
    if (!await guard('#/products')) return;
    seo('Produk | Admin Nusa Vanilla');
    app.innerHTML = shell('products', `<h1>Produk</h1><div class="a-tools"><label class="a-check"><input type="checkbox" id="del" ${pstate.deleted ? 'checked' : ''}> Tampilkan yang dihapus</label><span class="grow"></span><button class="a-btn pri" id="add">Tambah produk</button></div><div id="list">${skeleton}</div>`); bindShell(app);
    $('#add', app).onclick = () => productForm(null, () => productsPage(app));
    $('#del', app).onchange = e => { pstate.deleted = e.target.checked; productsPage(app); };
    let items;
    try { items = await D.products({ deleted: pstate.deleted }); } catch (e) { $('#list', app).innerHTML = errBox(e.message); $('[data-retry]', app).onclick = () => productsPage(app); return; }
    if (pstate.deleted) {
      $('#list', app).innerHTML = items.length ? `<div class="a-card a-tbl-wrap"><table class="a-tbl"><tr><th>Produk</th><th class="num">Harga USD/kg</th><th>Dihapus</th><th></th></tr>${items.map(p => `<tr data-id="${p.id}"><td><b>${esc(p.name)}</b><br><small>${esc(p.grade)}</small></td><td class="num">${usd(p.price_per_kg)}</td><td>${fmtDay(p.deleted_at)}</td><td><button class="a-btn" data-restore>Pulihkan</button></td></tr>`).join('')}</table></div>` : '<div class="a-card a-empty">Tidak ada produk yang dihapus.</div>';
      $('#list', app).onclick = async e => {
        const tr = e.target.closest('tr[data-id]'); if (!tr || !e.target.matches('[data-restore]')) return;
        try { await D.restoreProduct(tr.dataset.id); toast('Produk dipulihkan'); productsPage(app); } catch (err) { toast(err.message, true); }
      };
      return;
    }
    $('#list', app).innerHTML = items.length ? `<div class="a-card a-tbl-wrap"><table class="a-tbl"><tr><th>Produk</th><th class="num">Harga USD/kg</th><th class="num">Stok kg</th><th>Status</th><th></th></tr>
      ${items.map(p => `<tr data-id="${p.id}"><td><b>${esc(p.name)}</b><br><small>${esc(p.grade)}</small></td>
        <td class="num"><input data-f="price_per_kg" value="${p.price_per_kg}" inputmode="decimal" aria-label="Harga ${esc(p.name)}"><div class="a-err" data-e="price_per_kg"></div></td>
        <td class="num"><input data-f="stock_kg" value="${p.stock_kg}" inputmode="decimal" aria-label="Stok ${esc(p.name)}"><div class="a-err" data-e="stock_kg"></div></td>
        <td><select data-f="status" aria-label="Status ${esc(p.name)}">${['AVAILABLE', 'OUT_OF_STOCK', 'ARCHIVED'].map(s => `<option ${p.status === s ? 'selected' : ''} value="${s}">${s}</option>`).join('')}</select></td>
        <td style="white-space:nowrap"><button class="a-btn pri" data-save disabled>Simpan</button> <button class="a-btn" data-edit>Ubah</button> <button class="a-btn" data-hist>Riwayat harga</button> <button class="a-btn bad" data-del>Hapus</button></td></tr>`).join('')}</table></div>` : '<div class="a-card a-empty">Belum ada produk. Tambahkan produk pertama agar tampil di katalog.</div>';
    const byId = id => items.find(p => p.id === id);
    const list = $('#list', app);
    list.oninput = list.onchange = e => { const tr = e.target.closest('tr[data-id]'); if (tr) $('[data-save]', tr).disabled = false; };
    list.onclick = async e => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return;
      const p = byId(tr.dataset.id);
      if (e.target.matches('[data-edit]')) return productForm(p, () => productsPage(app));
      if (e.target.matches('[data-hist]')) return priceHistory(p);
      if (e.target.matches('[data-save]')) {
        const row = { ...p }; $$('[data-f]', tr).forEach(i => row[i.dataset.f] = i.value);
        const errs = L.validateProduct(row);
        $$('[data-e]', tr).forEach(n => n.textContent = errs[n.dataset.e] || '');
        $$('input[data-f]', tr).forEach(i => i.setAttribute('aria-invalid', errs[i.dataset.f] ? 'true' : 'false'));
        if (errs.price_per_kg || errs.stock_kg) return;
        e.target.disabled = true;
        try { await D.saveProduct({ id: p.id, price_per_kg: +row.price_per_kg, stock_kg: +row.stock_kg, status: row.status }); toast('Tersimpan'); Object.assign(p, { price_per_kg: +row.price_per_kg, stock_kg: +row.stock_kg, status: row.status }); }
        catch (err) { toast(err.message, true); e.target.disabled = false; }
      }
      if (e.target.matches('[data-del]')) {
        let n = 0; try { n = await D.pendingCount(p.id); } catch (_) {}
        const ok = await confirmBox(`Hapus "${p.name}" dari katalog?${n ? ` Produk ini punya ${n} RFQ berstatus Menunggu; riwayat RFQ tetap tersimpan.` : ' Riwayat RFQ tetap tersimpan.'} Produk bisa dipulihkan lewat "Tampilkan yang dihapus".`);
        if (!ok) return;
        try { await D.softDeleteProduct(p.id); toast('Produk dihapus dari katalog'); productsPage(app); } catch (err) { toast(err.message, true); }
      }
    };
  }

  async function priceHistory(p) {
    const bg = document.createElement('div'); bg.className = 'a-modal-bg';
    bg.innerHTML = `<div class="a-modal" role="dialog" aria-modal="true" style="width:min(520px,100%)"><h2>Riwayat harga</h2><p style="margin:2px 0 10px;color:var(--a-mute)">${esc(p.name)}</p><div id="ph">${skeleton}</div><div class="a-actions"><button class="a-btn" data-no>Tutup</button></div></div>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg || e.target.dataset.no != null) bg.remove(); });
    try {
      const h = await D.priceHistory(p.id);
      $('#ph', bg).innerHTML = h.length ? `<div class="a-tbl-wrap"><table class="a-tbl"><tr><th>Tanggal</th><th class="num">Sebelum</th><th class="num">Sesudah</th><th class="num">Selisih</th></tr>${h.map(r => { const d = r.old_price == null ? null : L.round2(r.new_price - r.old_price); return `<tr><td>${fmtDate(r.changed_at)}</td><td class="num">${r.old_price == null ? '-' : usd(r.old_price)}</td><td class="num">${usd(r.new_price)}</td><td class="num ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d == null ? 'harga awal' : (d > 0 ? '+' : '') + usd(d)}</td></tr>`; }).join('')}</table></div>` : '<div class="a-empty">Belum ada riwayat.</div>';
    } catch (e) { $('#ph', bg).innerHTML = `<div class="a-err">${esc(e.message)}</div>`; }
  }

  function productForm(p, done) {
    const v = p || { status: 'AVAILABLE', price_per_kg: '', stock_kg: 0, length_cm: 0, moisture_percentage: '', vanillin_percentage: '' };
    const f = (k, l, t = 'text', extra = '') => `<div><label class="a-label" for="p-${k}">${l}</label><input class="a-in" id="p-${k}" name="${k}" type="${t}" ${extra} value="${esc(v[k] ?? '')}"><div class="a-err" data-e="${k}"></div></div>`;
    const bg = document.createElement('div'); bg.className = 'a-modal-bg';
    bg.innerHTML = `<form class="a-modal" novalidate role="dialog" aria-modal="true" aria-labelledby="pf-h"><h2 id="pf-h">${p ? 'Ubah produk' : 'Tambah produk'}</h2><div class="a-err" id="pf-err" role="alert"></div>
      <div class="a-grid2">${f('name', 'Nama produk')}${f('grade', 'Grade')}${f('origin', 'Asal (mis. Flores, NTT)')}<div><label class="a-label" for="p-status">Status</label><select id="p-status" name="status">${['AVAILABLE', 'OUT_OF_STOCK', 'ARCHIVED'].map(s => `<option ${v.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      ${f('price_per_kg', 'Harga USD per kg', 'text', 'inputmode="decimal"')}${f('stock_kg', 'Stok (kg)', 'text', 'inputmode="decimal"')}${f('length_cm', 'Panjang polong (cm)', 'text', 'inputmode="decimal"')}${f('moisture_percentage', 'Kadar air (%)', 'text', 'inputmode="decimal"')}${f('vanillin_percentage', 'Kadar vanilin (%)', 'text', 'inputmode="decimal"')}${f('image_url', 'URL foto (atau unggah di bawah)')}</div>
      <label class="a-label" for="p-file">Unggah foto (JPG/PNG/WebP, maks 2 MB)</label><input id="p-file" type="file" accept="image/jpeg,image/png,image/webp"><div class="a-err" data-e="file"></div>
      ${v.image_url ? `<img class="a-thumb" src="${esc(v.image_url)}" alt="Foto saat ini">` : ''}
      <label class="a-label" for="p-description">Deskripsi</label><textarea id="p-description" name="description" rows="3">${esc(v.description || '')}</textarea>
      <div class="a-actions"><button class="a-btn pri" type="submit">Simpan</button><button class="a-btn" type="button" data-no>Batal</button></div></form>`;
    document.body.appendChild(bg);
    $('input', bg).focus();
    const close = () => bg.remove();
    bg.addEventListener('click', e => { if (e.target === bg || e.target.dataset.no != null) close(); });
    $('form', bg).addEventListener('submit', async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      const errs = L.validateProduct(d);
      $$('[data-e]', bg).forEach(n => n.textContent = errs[n.dataset.e] || '');
      $$('input.a-in', bg).forEach(i => i.setAttribute('aria-invalid', errs[i.name] ? 'true' : 'false'));
      if (Object.keys(errs).length) return;
      const row = { id: p ? p.id : undefined, name: d.name.trim(), grade: d.grade.trim(), origin: d.origin.trim() || null, status: d.status, price_per_kg: +d.price_per_kg, stock_kg: +d.stock_kg, length_cm: +d.length_cm || 0,
        moisture_percentage: +d.moisture_percentage, vanillin_percentage: +d.vanillin_percentage, image_url: d.image_url.trim() || null, description: d.description.trim() || null };
      if (!p) row.slug = L.slugify(row.name);
      const btn = $('button[type=submit]', bg); btn.disabled = true;
      try {
        const file = $('#p-file', bg).files[0];
        if (file) row.image_url = await D.uploadImage(file);
        await D.saveProduct(row); toast('Tersimpan'); close(); done();
      } catch (err) { $('#pf-err', bg).textContent = err.message; btn.disabled = false; }
    });
  }

  /* ───────── RFQ ───────── */
  const istate = { status: '', search: '', page: 1 };
  const INQ_COLS = [
    { label: 'Nomor', get: i => i.inquiry_number }, { label: 'Tanggal', get: i => i.created_at }, { label: 'Perusahaan', get: i => i.company_name },
    { label: 'Kontak', get: i => i.contact_name }, { label: 'Email', get: i => i.email }, { label: 'Telepon', get: i => i.phone }, { label: 'Negara', get: i => i.country },
    { label: 'Produk', get: i => i.vanilla_products?.name }, { label: 'Kuantitas kg', get: i => i.quantity_kg }, { label: 'Harga snapshot USD/kg', get: i => i.price_snapshot_at_inquiry },
    { label: 'Penawaran final USD/kg', get: i => i.quoted_price_per_kg }, { label: 'Kuantitas disetujui kg', get: i => i.quoted_quantity_kg }, { label: 'Nilai USD', get: L.inquiryValue },
    { label: 'Status', get: i => L.STATUS_LABEL[i.status] }, { label: 'Catatan internal', get: i => i.internal_notes }
  ];
  async function inquiriesPage(app) {
    if (!await guard('#/inquiries')) return;
    const qs = new URLSearchParams(location.hash.split('?')[1] || '');
    if (qs.get('status') && Object.keys(L.STATUS_FLOW).includes(qs.get('status'))) { istate.status = qs.get('status'); istate.page = 1; history.replaceState(null, '', '#/inquiries'); }
    seo('Inquiry RFQ | Admin Nusa Vanilla');
    app.innerHTML = shell('inquiries', `<h1>Inquiry RFQ</h1><div class="a-tools"><label for="fs" class="a-label" style="margin:0">Status</label><select id="fs" style="width:auto"><option value="">Semua</option>${Object.keys(L.STATUS_FLOW).map(s => `<option value="${s}" ${istate.status === s ? 'selected' : ''}>${L.STATUS_LABEL[s]}</option>`).join('')}</select>
      <input class="a-in a-search" id="q" type="search" placeholder="Cari perusahaan, email, atau nomor RFQ" value="${esc(istate.search)}" aria-label="Cari RFQ"><span class="grow"></span><button class="a-btn" id="csv">Ekspor CSV</button></div><div id="list">${skeleton}</div>`); bindShell(app);
    $('#fs', app).onchange = e => { istate.status = e.target.value; istate.page = 1; inquiriesPage(app); };
    $('#q', app).onkeydown = e => { if (e.key === 'Enter') { istate.search = e.target.value; istate.page = 1; inquiriesPage(app); } };
    $('#csv', app).onclick = async e => {
      e.target.disabled = true;
      try { const r = await D.inquiries({ status: istate.status, search: istate.search, all: true }); download(`rfq-${new Date().toISOString().slice(0, 10)}.csv`, L.toCsv(r.items, INQ_COLS)); toast(`${r.items.length} RFQ diekspor`); }
      catch (err) { toast(err.message, true); } finally { e.target.disabled = false; }
    };
    let r;
    try { r = await D.inquiries(istate); } catch (e) { $('#list', app).innerHTML = errBox(e.message); $('[data-retry]', app).onclick = () => inquiriesPage(app); return; }
    $('#list', app).innerHTML = inquiryTable(r, true);
    bindInquiryList($('#list', app), r.items, () => inquiriesPage(app), p => { istate.page += p; inquiriesPage(app); });
  }

  function inquiryTable(r, paged) {
    if (!r.items.length) return `<div class="a-card a-empty">${istate.status || istate.search ? 'Tidak ada RFQ yang cocok.' : 'Belum ada RFQ. Permintaan dari pembeli akan muncul di sini.'}</div>`;
    return `<div class="a-card a-tbl-wrap"><table class="a-tbl"><tr><th>Nomor</th><th>Tanggal</th><th>Perusahaan</th><th>Produk</th><th class="num">Kg</th><th class="num">Nilai</th><th>Status</th><th></th></tr>
      ${r.items.map(i => `<tr><td>${esc(i.inquiry_number)}</td><td>${fmtDay(i.created_at)}</td><td>${esc(i.company_name)}<br><small>${esc(i.country)}</small></td><td>${esc(i.vanilla_products?.name)}</td><td class="num">${nf(i.quoted_quantity_kg ?? i.quantity_kg)}</td><td class="num">${usd(L.inquiryValue(i))}${i.quoted_price_per_kg ? '<br><small>penawaran final</small>' : ''}</td><td>${badge(i.status)}</td><td><button class="a-btn" data-open="${i.id}">Detail</button></td></tr>`).join('')}</table>
      ${paged ? `<div class="a-tools" style="margin:12px 0 0"><span class="grow">${r.total} RFQ · halaman ${r.page} dari ${r.totalPages}</span><button class="a-btn" data-p="-1" ${r.page <= 1 ? 'disabled' : ''}>Sebelumnya</button><button class="a-btn" data-p="1" ${r.page >= r.totalPages ? 'disabled' : ''}>Berikutnya</button></div>` : ''}</div>`;
  }
  function bindInquiryList(el, items, refresh, page) {
    el.onclick = e => {
      const pg = e.target.closest('[data-p]'); if (pg && page) page(+pg.dataset.p);
      const o = e.target.closest('[data-open]'); if (o) detail(items.find(i => i.id === o.dataset.open), refresh);
    };
  }

  function detail(i, done) {
    const bg = document.createElement('div'); bg.className = 'a-modal-bg';
    const next = L.STATUS_FLOW[i.status];
    const wa = L.waLink(i.phone);
    bg.innerHTML = `<div class="a-modal" role="dialog" aria-modal="true" aria-labelledby="dt-h"><h2 id="dt-h">${esc(i.inquiry_number)}</h2><p style="margin:4px 0 12px">${badge(i.status)} <small>${fmtDate(i.created_at)}</small></p>
      <table class="a-tbl">${[['Perusahaan', i.buyer_id ? `<a href="#/buyers/${esc(i.buyer_id)}">${esc(i.company_name)}</a>` : esc(i.company_name), true], ['Kontak', i.contact_name], ['Email', i.email], ['Telepon', i.phone], ['Negara tujuan', i.country], ['Produk', i.vanilla_products?.name], ['Kuantitas diminta', nf(i.quantity_kg) + ' kg'], ['Harga saat diajukan', usd(i.price_snapshot_at_inquiry) + '/kg'], ['Estimasi pembeli', usd(L.estimate(i.quantity_kg, i.price_snapshot_at_inquiry))], ['Catatan pembeli', i.notes || '-']].map(([k, v, raw]) => `<tr><th>${k}</th><td style="white-space:pre-wrap">${raw ? v : esc(v)}</td></tr>`).join('')}</table>
      <div class="a-actions" style="margin-top:10px"><a class="a-btn" href="mailto:${esc(i.email)}">Email</a>${wa ? `<a class="a-btn" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div>
      <h3 class="a-h2" style="margin-top:18px">Penawaran final &amp; catatan internal</h3>
      <div class="a-grid2"><div><label class="a-label" for="q-price">Harga disepakati (USD/kg)</label><input class="a-in" id="q-price" name="quoted_price_per_kg" inputmode="decimal" value="${esc(i.quoted_price_per_kg ?? '')}"><div class="a-err" data-e="quoted_price_per_kg"></div></div>
      <div><label class="a-label" for="q-qty">Kuantitas disepakati (kg)</label><input class="a-in" id="q-qty" name="quoted_quantity_kg" inputmode="decimal" value="${esc(i.quoted_quantity_kg ?? '')}"><div class="a-err" data-e="quoted_quantity_kg"></div></div></div>
      <label class="a-label" for="q-notes">Catatan internal (tidak terlihat pembeli)</label><textarea id="q-notes" name="internal_notes" rows="3">${esc(i.internal_notes || '')}</textarea>
      <div class="a-err" id="dt-e" role="alert"></div>
      <div class="a-actions"><button class="a-btn pri" data-save>Simpan catatan &amp; penawaran</button>${next.map(s => `<button class="a-btn ${s === 'CANCELLED' ? 'bad' : ''}" data-to="${s}">${s === 'CANCELLED' ? 'Batalkan' : 'Tandai: ' + L.STATUS_LABEL[s]}</button>`).join('')}<button class="a-btn" data-no>Tutup</button></div></div>`;
    document.body.appendChild(bg);
    const form = () => ({ quoted_price_per_kg: $('#q-price', bg).value.trim(), quoted_quantity_kg: $('#q-qty', bg).value.trim(), internal_notes: $('#q-notes', bg).value.trim() });
    bg.addEventListener('click', async e => {
      if (e.target === bg || e.target.dataset.no != null) return bg.remove();
      const er = $('#dt-e', bg);
      if (e.target.matches('[data-save]')) {
        const f = form(), errs = L.validateQuote(f);
        $$('[data-e]', bg).forEach(n => n.textContent = errs[n.dataset.e] || '');
        if (Object.keys(errs).length) return;
        if (f.internal_notes.length > 2000) { er.textContent = 'Catatan maksimal 2000 karakter.'; return; }
        e.target.disabled = true; er.textContent = '';
        try { await D.saveInquiryDetail(i.id, { quoted_price_per_kg: f.quoted_price_per_kg === '' ? null : +f.quoted_price_per_kg, quoted_quantity_kg: f.quoted_quantity_kg === '' ? null : +f.quoted_quantity_kg, internal_notes: f.internal_notes || null }); toast('Tersimpan'); bg.remove(); done(); }
        catch (err) { er.textContent = err.message; e.target.disabled = false; }
        return;
      }
      const to = e.target.dataset.to; if (!to) return;
      if (to === 'CANCELLED' && !await confirmBox('Batalkan RFQ ini? Status tidak bisa dikembalikan.', 'Batalkan RFQ')) return;
      e.target.disabled = true;
      try { await D.setInquiryStatus(i.id, to); toast('Status diperbarui'); bg.remove(); done(); } catch (err) { er.textContent = err.message; e.target.disabled = false; }
    });
  }

  /* ───────── buyer ───────── */
  const bstate = { search: '', label: '' };
  const group = rows => { const m = new Map(); for (const r of rows) { if (!r.buyer_id) continue; (m.get(r.buyer_id) || m.set(r.buyer_id, []).get(r.buyer_id)).push(r); } return m; };
  async function buyersPage(app) {
    if (!await guard('#/buyers')) return;
    seo('Buyer | Admin Nusa Vanilla');
    app.innerHTML = shell('buyers', `<h1>Buyer</h1><div class="a-tools"><input class="a-in a-search" id="q" type="search" placeholder="Cari perusahaan, kontak, email, atau negara" value="${esc(bstate.search)}" aria-label="Cari buyer"><select id="fl" style="width:auto" aria-label="Filter label"><option value="">Semua label</option>${Object.entries(L.BUYER_LABEL).map(([k, t]) => `<option value="${k}" ${bstate.label === k ? 'selected' : ''}>${t}</option>`).join('')}</select><span class="grow"></span><button class="a-btn" id="csv">Ekspor CSV</button></div><div id="list">${skeleton}</div>`); bindShell(app);
    let buyers, stats;
    try { [buyers, stats] = await Promise.all([D.buyers(), D.inquiryStats()]); } catch (e) { $('#list', app).innerHTML = errBox(e.message); $('[data-retry]', app).onclick = () => buyersPage(app); return; }
    const g = group(stats);
    const rows = buyers.map(b => { const st = L.buyerStats(g.get(b.id) || []); return { b, st, label: L.buyerLabel(st) }; }).sort((x, y) => (y.st.last || y.b.created_at).localeCompare(x.st.last || x.b.created_at));
    const render = () => {
      const q = bstate.search.trim().toLowerCase();
      const vis = rows.filter(r => (!bstate.label || r.label === bstate.label) && (!q || [r.b.company_name, r.b.contact_name, r.b.email, r.b.country].some(s => String(s || '').toLowerCase().includes(q))));
      $('#list', app).innerHTML = vis.length ? `<div class="a-card a-tbl-wrap"><table class="a-tbl"><tr><th>Perusahaan</th><th>Kontak</th><th class="num">RFQ</th><th class="num">Dikonfirmasi</th><th class="num">Nilai dikonfirmasi</th><th>RFQ terakhir</th><th>Label</th></tr>
        ${vis.map(({ b, st, label }) => `<tr class="a-click" data-go="${b.id}" tabindex="0"><td><b>${esc(b.company_name)}</b><br><small>${esc(b.country || '-')}</small></td><td>${esc(b.contact_name)}<br><small>${esc(b.email)}</small></td><td class="num">${st.count}</td><td class="num">${st.confirmed}</td><td class="num">${usd(st.value)}</td><td>${st.last ? fmtDay(st.last) : '-'}</td><td>${badge(label, L.BUYER_LABEL[label])}</td></tr>`).join('')}</table><div class="a-tools" style="margin:12px 0 0"><span class="grow">${vis.length} dari ${rows.length} buyer</span></div></div>`
        : `<div class="a-card a-empty">${rows.length ? 'Tidak ada buyer yang cocok.' : 'Belum ada buyer. Buyer terbentuk otomatis saat ada RFQ masuk.'}</div>`;
    };
    render();
    $('#q', app).oninput = e => { bstate.search = e.target.value; render(); };
    $('#fl', app).onchange = e => { bstate.label = e.target.value; render(); };
    const go = e => { const t = e.target.closest('[data-go]'); if (t) location.hash = '#/buyers/' + t.dataset.go; };
    $('#list', app).onclick = go;
    $('#list', app).onkeydown = e => { if (e.key === 'Enter') go(e); };
    $('#csv', app).onclick = () => {
      download(`buyer-${new Date().toISOString().slice(0, 10)}.csv`, L.toCsv(rows, [
        { label: 'Perusahaan', get: r => r.b.company_name }, { label: 'Kontak', get: r => r.b.contact_name }, { label: 'Email', get: r => r.b.email }, { label: 'Telepon', get: r => r.b.phone },
        { label: 'Negara', get: r => r.b.country }, { label: 'Jumlah RFQ', get: r => r.st.count }, { label: 'RFQ dikonfirmasi', get: r => r.st.confirmed }, { label: 'Nilai dikonfirmasi USD', get: r => r.st.value },
        { label: 'Nilai pipeline USD', get: r => r.st.pipeline }, { label: 'RFQ terakhir', get: r => r.st.last }, { label: 'Label', get: r => L.BUYER_LABEL[r.label] }, { label: 'Catatan', get: r => r.b.notes }]));
      toast(`${rows.length} buyer diekspor`);
    };
  }

  async function buyerPage(app, id) {
    if (!await guard('#/buyers/' + id)) return;
    seo('Detail buyer | Admin Nusa Vanilla');
    app.innerHTML = shell('buyers', `<p class="a-back"><a href="#/buyers">← Semua buyer</a></p><div id="d">${skeleton}</div>`); bindShell(app);
    let b, r;
    try { [b, r] = await Promise.all([D.buyer(id), D.inquiries({ buyerId: id, all: true })]); } catch (e) { $('#d', app).innerHTML = errBox(e.message); $('[data-retry]', app).onclick = () => buyerPage(app, id); return; }
    if (!b) { $('#d', app).innerHTML = '<div class="a-card a-empty">Buyer tidak ditemukan.</div>'; return; }
    const st = L.buyerStats(r.items), wa = L.waLink(b.phone);
    const kpi = (t, v) => `<div class="a-card"><b>${v}</b><span>${t}</span></div>`;
    $('#d', app).innerHTML = `<h1 style="margin:0 0 4px">${esc(b.company_name)} ${buyerBadge(st)}</h1><p style="margin:0 0 18px;color:var(--a-mute)">Buyer sejak ${fmtDay(b.created_at)}</p>
      <div class="a-kpis">${kpi('Jumlah RFQ', st.count)}${kpi('Dikonfirmasi', st.confirmed)}${kpi('Nilai dikonfirmasi', usd(st.value))}${kpi('Pipeline berjalan', usd(st.pipeline))}</div>
      <div class="a-cols"><form class="a-card" id="bf" novalidate><h2 class="a-h2">Profil &amp; catatan</h2>
        <div class="a-grid2"><div><label class="a-label" for="b-company">Perusahaan</label><input class="a-in" id="b-company" name="company_name" value="${esc(b.company_name)}"></div><div><label class="a-label" for="b-contact">Kontak</label><input class="a-in" id="b-contact" name="contact_name" value="${esc(b.contact_name)}"></div>
        <div><label class="a-label" for="b-email">Email</label><input class="a-in" id="b-email" value="${esc(b.email)}" readonly></div><div><label class="a-label" for="b-phone">Telepon</label><input class="a-in" id="b-phone" name="phone" value="${esc(b.phone || '')}"></div></div>
        <label class="a-label" for="b-country">Negara</label><input class="a-in" id="b-country" name="country" value="${esc(b.country || '')}">
        <label class="a-label" for="b-notes">Catatan internal</label><textarea id="b-notes" name="notes" rows="4" placeholder="Preferensi grade, kebiasaan bayar, hasil negosiasi...">${esc(b.notes || '')}</textarea>
        <div class="a-err" id="b-err" role="alert"></div><div class="a-actions"><button class="a-btn pri" type="submit">Simpan</button><a class="a-btn" href="mailto:${esc(b.email)}">Email</a>${wa ? `<a class="a-btn" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div></form>
        <div class="a-card" style="grid-column:span 1"><h2 class="a-h2">Riwayat RFQ</h2><div id="il">${r.items.length ? inquiryTable(r, false).replace('a-card a-tbl-wrap', 'a-tbl-wrap') : '<div class="a-empty" style="padding:14px">Belum ada RFQ.</div>'}</div></div></div>`;
    $('#bf', app).onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target)), er = $('#b-err', app);
      if (d.company_name.trim().length < 2 || d.contact_name.trim().length < 2) { er.textContent = 'Nama perusahaan dan kontak minimal 2 karakter.'; return; }
      if (d.phone.trim() && !/^[+0-9 ()-]{6,30}$/.test(d.phone.trim())) { er.textContent = 'Nomor telepon tidak valid.'; return; }
      if (d.notes.length > 4000) { er.textContent = 'Catatan maksimal 4000 karakter.'; return; }
      er.textContent = ''; const btn = $('button[type=submit]', e.target); btn.disabled = true;
      try { await D.saveBuyer(id, { company_name: d.company_name.trim(), contact_name: d.contact_name.trim(), phone: d.phone.trim() || null, country: d.country.trim() || null, notes: d.notes.trim() || null }); toast('Tersimpan'); buyerPage(app, id); }
      catch (err) { er.textContent = err.message; btn.disabled = false; }
    };
    bindInquiryList($('#il', app), r.items, () => buyerPage(app, id));
  }

  window.NVAdmin = { login, dashboard, productsPage, inquiriesPage, buyersPage, buyerPage };
})();
