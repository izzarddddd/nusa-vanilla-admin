# Tropic Bean Co. Admin

Portal administrator untuk toko ekspor vanili **Tropic Bean Co.**. Aplikasi statis terpisah dari situs publik, tetapi memakai **project Supabase yang sama**.

- Situs publik: https://izzarddddd.github.io/nusa-vanilla/ (repo `nusa-vanilla`)
- Portal admin: https://izzarddddd.github.io/nusa-vanilla-admin/ (repo ini)

## Fitur
- **Dashboard:** RFQ menunggu/penawaran/dikonfirmasi beserta nilainya, konversi, jumlah buyer, stok menipis, peringatan RFQ menunggu > 2 hari, RFQ per bulan, produk/negara teratas.
- **Produk:** ubah harga/stok/status langsung di tabel, form lengkap, unggah foto (Supabase Storage), riwayat harga, hapus dan pulihkan.
- **Inquiry RFQ:** filter status, pencarian, penawaran final (harga + kuantitas disepakati), catatan internal, tombol Email/WhatsApp, ekspor CSV.
- **Buyer:** terbentuk otomatis dari RFQ (satu buyer per email). Profil, catatan, statistik, label (Prospek / Pelanggan / Pelanggan tetap / Tidak aktif), riwayat RFQ, ekspor CSV.

## Setup
1. Jalankan `schema.sql` dari repo `nusa-vanilla` (bagian **Admin v2** di akhir berkas) di Supabase → SQL Editor. Aman diulang.
2. `config.js` sudah berisi URL dan anon key project yang sama dengan situs publik. Jangan pernah memakai `service_role` key.
3. Akun admin: lihat langkah 4–5 README `nusa-vanilla` (user Auth + baris di tabel `admins`, sign-up dimatikan).
4. Lokal: `npm run serve` (port 5174) atau buka `index.html`. Tes: `npm test`.

## Keamanan
Repo ini publik (syarat GitHub Pages gratis), jadi kerahasiaan kode bukan pelindung. Akses dijaga oleh **login Supabase Auth + Row Level Security** (`is_admin()`): tanpa sesi admin, semua tabel admin menolak baca dan tulis. Halaman bertanda `noindex`.

## Struktur
```
index.html        cangkang halaman
config.js         URL & anon key Supabase, PUBLIC_SITE_URL
css/admin.css     tampilan
js/lib.js         rumus harga, statistik buyer, CSV, validasi (dipakai browser dan test)
js/core.js        helper
js/data.js        akses Supabase
js/admin.js       halaman: login, dashboard, produk, RFQ, buyer
js/app.js         router (#/, #/inquiries, #/buyers, #/buyers/:id, #/products, #/login)
tests/            test unit
```
`js/lib.js` berbagi rumus harga dengan `nusa-vanilla/js/lib.js`; ubah keduanya bersamaan.
