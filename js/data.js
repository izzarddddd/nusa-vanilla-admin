/* Akses data Supabase untuk portal admin. Semua tabel dilindungi RLS is_admin(); lihat schema.sql di repo nusa-vanilla. */
(function () {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const num = r => ({ ...r, length_cm: +r.length_cm, moisture_percentage: +r.moisture_percentage, vanillin_percentage: +r.vanillin_percentage, price_per_kg: +r.price_per_kg, stock_kg: +r.stock_kg });
  const fail = e => { const err = new Error(e.message || 'Terjadi kesalahan'); err.code = e.code; throw err; };
  const STAT_COLS = 'id,status,quantity_kg,price_snapshot_at_inquiry,quoted_price_per_kg,quoted_quantity_kg,country,product_id,buyer_id,created_at,vanilla_products(name)';
  const MAX_ROWS = 5000;
  const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const IMG_MAX = 2 * 1024 * 1024;
  /* karakter yang punya arti khusus di filter PostgREST dibuang dari kata kunci */
  const clean = q => String(q || '').replace(/[%,()*\\]/g, ' ').trim().slice(0, 80);

  const D = {
    sb,
    async session() { const { data } = await sb.auth.getSession(); return data.session; },
    async isAdmin() {
      const s = await D.session(); if (!s) return false;
      const { data } = await sb.from('admins').select('user_id').eq('user_id', s.user.id).maybeSingle();
      return !!data;
    },
    async login(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); return !error; },
    logout() { return sb.auth.signOut(); },

    /* ───────── produk ───────── */
    async products({ deleted = false } = {}) {
      let q = sb.from('vanilla_products').select('*').order('created_at');
      q = deleted ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null);
      const { data, error } = await q;
      if (error) fail(error);
      return data.map(num);
    },
    async saveProduct(row) {
      const { id, ...rest } = row;
      const { error } = await (id ? sb.from('vanilla_products').update(rest).eq('id', id) : sb.from('vanilla_products').insert(rest));
      if (error) { if (error.code === '23505') { const e = new Error('Slug sudah dipakai produk lain. Ubah nama produk.'); e.code = 'DUPLICATE'; throw e; } fail(error); }
    },
    async softDeleteProduct(id) { const { error } = await sb.from('vanilla_products').update({ deleted_at: new Date().toISOString() }).eq('id', id); if (error) fail(error); },
    async restoreProduct(id) {
      const { error } = await sb.from('vanilla_products').update({ deleted_at: null }).eq('id', id);
      if (error) { if (error.code === '23505') throw new Error('Sudah ada produk aktif dengan nama yang sama. Ubah atau hapus dulu produk itu.'); fail(error); }
    },
    async pendingCount(productId) {
      const { count, error } = await sb.from('inquiries').select('id', { count: 'exact', head: true }).eq('product_id', productId).eq('status', 'PENDING');
      if (error) fail(error); return count || 0;
    },
    async priceHistory(productId) {
      const { data, error } = await sb.from('product_price_history').select('old_price,new_price,changed_at').eq('product_id', productId).order('changed_at', { ascending: false }).limit(100);
      if (error) fail(error); return data;
    },
    async uploadImage(file) {
      const ext = IMG_TYPES[file.type];
      if (!ext) throw new Error('Foto harus berformat JPG, PNG, atau WebP.');
      if (file.size > IMG_MAX) throw new Error('Ukuran foto maksimal 2 MB.');
      const path = crypto.randomUUID() + '.' + ext;
      const { error } = await sb.storage.from('product-images').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
      if (error) fail(error);
      return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    },

    /* ───────── RFQ ───────── */
    async inquiries({ status = '', search = '', buyerId = '', page = 1, limit = 20, all = false } = {}) {
      let q = sb.from('inquiries').select('*, vanilla_products(name)', { count: 'exact' }).order('created_at', { ascending: false });
      q = all ? q.range(0, MAX_ROWS - 1) : q.range((page - 1) * limit, page * limit - 1);
      if (status) q = q.eq('status', status);
      if (buyerId) q = q.eq('buyer_id', buyerId);
      const s = clean(search);
      if (s) q = q.or(`company_name.ilike.%${s}%,email.ilike.%${s}%,inquiry_number.ilike.%${s}%`);
      const { data, error, count } = await q;
      if (error) fail(error);
      return { items: data, total: count || 0, page, limit, totalPages: Math.max(1, Math.ceil((count || 0) / limit)) };
    },
    async setInquiryStatus(id, status) { const { error } = await sb.from('inquiries').update({ status }).eq('id', id); if (error) fail(error); },
    async saveInquiryDetail(id, d) { const { error } = await sb.from('inquiries').update(d).eq('id', id); if (error) fail(error); },
    /** Kolom ringan semua RFQ, untuk dashboard dan statistik buyer. */
    async inquiryStats() {
      const { data, error } = await sb.from('inquiries').select(STAT_COLS).order('created_at', { ascending: false }).limit(MAX_ROWS);
      if (error) fail(error); return data;
    },

    /* ───────── buyer ───────── */
    async buyers() {
      const { data, error } = await sb.from('buyers').select('*').order('created_at', { ascending: false }).limit(MAX_ROWS);
      if (error) fail(error); return data;
    },
    async buyer(id) {
      const { data, error } = await sb.from('buyers').select('*').eq('id', id).maybeSingle();
      if (error) fail(error); return data;
    },
    async saveBuyer(id, d) { const { error } = await sb.from('buyers').update(d).eq('id', id); if (error) fail(error); }
  };
  window.NVData = D;
})();
