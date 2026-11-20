/* Helper bersama portal admin. */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const WIB = { timeZone: 'Asia/Jakarta' };
  const fmtDate = iso => new Date(iso).toLocaleString('id-ID', { ...WIB, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const fmtDay = iso => new Date(iso).toLocaleDateString('id-ID', { ...WIB, day: 'numeric', month: 'short', year: 'numeric' });

  let toastT;
  function toast(msg, bad = false) {
    let t = $('.a-toast');
    if (!t) { t = document.createElement('div'); t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.className = 'a-toast' + (bad ? ' bad' : '');
    t.textContent = msg;
    clearTimeout(toastT);
    toastT = setTimeout(() => t.remove(), bad ? 5000 : 2800);
  }

  const seo = title => { document.title = title; };

  /** Unduh teks sebagai berkas (dipakai ekspor CSV). */
  function download(name, text, type = 'text/csv;charset=utf-8') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  window.NV = { esc, $, $$, fmtDate, fmtDay, toast, seo, download };
})();
