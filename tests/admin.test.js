// Jalankan: npm test  (test runner bawaan Node, tanpa dependency)
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/lib.js');

const rfq = (status, qty, price, extra = {}) => ({ status, quantity_kg: qty, price_snapshot_at_inquiry: price, created_at: '2026-03-01T00:00:00Z', ...extra });

test('nilai RFQ memakai penawaran final bila ada, kalau tidak harga snapshot', () => {
  assert.equal(L.inquiryValue(rfq('PENDING', 10, 200)), 2000);
  assert.equal(L.inquiryValue(rfq('QUOTED', 10, 200, { quoted_price_per_kg: 180, quoted_quantity_kg: 8 })), 1440);
});

test('statistik buyer: nilai hanya dari RFQ dikonfirmasi, pipeline dari yang berjalan, batal diabaikan', () => {
  const st = L.buyerStats([rfq('CONFIRMED', 10, 100), rfq('QUOTED', 5, 100), rfq('CANCELLED', 50, 100, { created_at: '2026-04-01T00:00:00Z' })]);
  assert.deepEqual({ c: st.count, k: st.confirmed, o: st.open, v: st.value, p: st.pipeline }, { c: 3, k: 1, o: 1, v: 1000, p: 500 });
  assert.equal(st.last, '2026-04-01T00:00:00Z');
});

test('label buyer', () => {
  const lab = l => L.buyerLabel(L.buyerStats(l));
  assert.equal(lab([rfq('CONFIRMED', 1, 1), rfq('CONFIRMED', 1, 1)]), 'REPEAT');
  assert.equal(lab([rfq('CONFIRMED', 1, 1)]), 'CUSTOMER');
  assert.equal(lab([rfq('PENDING', 1, 1)]), 'PROSPECT');
  assert.equal(lab([rfq('CANCELLED', 1, 1)]), 'INACTIVE');
  assert.equal(lab([]), 'INACTIVE');
});

test('CSV: kutip koma/kutip dan netralkan sel berawalan rumus', () => {
  const csv = L.toCsv([{ a: '=HYPERLINK("x")', b: 'PT A, B' }, { a: '@cmd', b: null }], [{ label: 'A', get: r => r.a }, { label: 'B', get: r => r.b }]);
  assert.equal(csv, '﻿A,B\r\n"\'=HYPERLINK(""x"")","PT A, B"\r\n\'@cmd,');
});

test('validasi penawaran final: kosong boleh, harus > 0 dan maks 2 desimal', () => {
  assert.deepEqual(L.validateQuote({ quoted_price_per_kg: '', quoted_quantity_kg: null }), {});
  assert.deepEqual(L.validateQuote({ quoted_price_per_kg: '150.5', quoted_quantity_kg: '20' }), {});
  for (const v of ['0', '-3', 'abc', '1.234']) assert.ok(L.validateQuote({ quoted_price_per_kg: v }).quoted_price_per_kg, v);
});

test('tautan WhatsApp hanya angka, kosong bila nomor tidak layak', () => {
  assert.equal(L.waLink('+62 812-3456-789'), 'https://wa.me/628123456789');
  assert.equal(L.waLink('12'), '');
  assert.equal(L.waLink(null), '');
});
