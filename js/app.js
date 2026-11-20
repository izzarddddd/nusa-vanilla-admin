/* Router hash portal admin. Rute: /login, /, /products, /inquiries, /buyers, /buyers/:id */
(function () {
  const app = document.getElementById('app');
  const A = window.NVAdmin;

  function route() {
    document.body.style.overflow = '';
    const path = (location.hash.replace(/^#/, '') || '/').split('?')[0].replace(/\/+$/, '') || '/';
    let m;
    if (path === '/login') A.login(app);
    else if (path === '/') A.dashboard(app);
    else if (path === '/products') A.productsPage(app);
    else if (path === '/inquiries') A.inquiriesPage(app);
    else if (path === '/buyers') A.buyersPage(app);
    else if ((m = path.match(/^\/buyers\/([0-9a-f-]{36})$/))) A.buyerPage(app, m[1]);
    else app.innerHTML = '<div class="a-login"><div class="a-card a-empty">Halaman tidak ditemukan.<div style="margin-top:12px"><a class="a-btn" href="#/">Ke dashboard</a></div></div></div>';
    window.scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  route();
})();
