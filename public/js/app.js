/* ============================================================
   js/app.js
   Shared chrome: header, cart drawer, mobile nav, reveal
   animations, product card rendering, newsletter and contact.
============================================================ */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  window.$ = $;
  window.$$ = $$;

  var WEB3FORMS_KEY = window.SITE_CONFIG.web3formsKey;

  /* ---------- escape everything that reaches innerHTML ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  window.esc = esc;

  /* ---------- header / drawers ---------- */

  function closeAll() {
    var d = $('#drawer'), m = $('#mnav'), s = $('#scrim');
    if (d) d.classList.remove('open');
    if (m) m.classList.remove('open');
    if (s) s.classList.remove('show');
    document.body.style.overflow = '';
  }
  window.closeAll = closeAll;

  window.openCart = function () {
    renderDrawer();
    $('#drawer').classList.add('open');
    $('#scrim').classList.add('show');
    document.body.style.overflow = 'hidden';
  };

  window.openMenu = function () {
    $('#mnav').classList.add('open');
    $('#scrim').classList.add('show');
    document.body.style.overflow = 'hidden';
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });

  /* ---------- cart badge ---------- */

  function syncBadge() {
    var n = window.Cart.count();
    $$('.cart-count').forEach(function (el) {
      if (el.textContent !== String(n)) {
        el.textContent = n;
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    });
  }

  /* ---------- cart drawer ---------- */

  function renderDrawer() {
    var body = $('#drawerBody'), foot = $('#drawerFoot');
    if (!body) return;
    var items = window.Cart.detailed();

    if (!items.length) {
      body.innerHTML =
        '<div class="empty"><div style="font-size:52px;margin-bottom:10px">&#128722;</div>' +
        '<h3>Your cart is empty</h3><p>Add something your pet will thank you for.</p></div>';
      foot.innerHTML = '<a href="products.html" class="btn btn-primary btn-block">Browse products</a>';
      return;
    }

    body.innerHTML = items.map(function (i) {
      return '<div class="ci">' +
        '<img src="' + esc(i.image) + '" alt="' + esc(i.name) + '">' +
        '<div class="ci-info"><h4>' + esc(i.name) + '</h4>' +
        '<div class="v">' + esc(i.variant) + '</div>' +
        '<div class="ci-bot"><div class="mini-qty">' +
        '<button data-act="dec" data-id="' + esc(i.id) + '" data-v="' + esc(i.variant) + '" aria-label="Decrease quantity">&minus;</button>' +
        '<span>' + i.quantity + '</span>' +
        '<button data-act="inc" data-id="' + esc(i.id) + '" data-v="' + esc(i.variant) + '" aria-label="Increase quantity">+</button>' +
        '</div><span class="ci-price">' + window.money(i.lineTotal) + '</span></div>' +
        '<button class="rm" data-act="rm" data-id="' + esc(i.id) + '" data-v="' + esc(i.variant) + '" style="margin-top:8px">Remove</button>' +
        '</div></div>';
    }).join('');

    foot.innerHTML =
      '<div class="tot-row"><span>Subtotal</span><span>' + window.money(window.Cart.subtotal()) + '</span></div>' +
      '<div class="tot-row"><span>Shipping</span><span class="free">Free</span></div>' +
      '<div class="tot-row big"><span>Total</span><span>' + window.money(window.Cart.total()) + '</span></div>' +
      '<a href="checkout.html" class="btn btn-primary btn-block">Checkout</a>' +
      '<a href="cart.html" class="btn btn-ghost btn-block" style="margin-top:10px">View cart</a>';
  }
  window.renderDrawer = renderDrawer;

  /* One delegated listener handles every quantity control on the page. */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.dataset.act, id = btn.dataset.id, v = btn.dataset.v;
    if (act === 'inc') window.Cart.bump(id, v, 1);
    else if (act === 'dec') window.Cart.bump(id, v, -1);
    else if (act === 'rm') window.Cart.remove(id, v);
    else if (act === 'add') window.Cart.add(id, v, 1);
  });

  document.addEventListener('cart:changed', function () {
    syncBadge();
    renderDrawer();
    if (window.onCartChanged) window.onCartChanged();
  });

  /* ---------- product cards ---------- */

  window.productCard = function (p) {
    var sw = p.variants.slice(0, 6).map(function (v) {
      return '<span class="sw" style="background:' + esc(v.c) + '" title="' + esc(v.n) + '"></span>';
    }).join('');
    var more = p.variants.length > 6 ? '<span class="sw-more">+' + (p.variants.length - 6) + '</span>' : '';
    var url = 'product?id=' + encodeURIComponent(p.id);

    return '<article class="pcard reveal">' +
      (p.badge ? '<span class="badge">' + esc(p.badge) + '</span>' : '') +
      '<a href="' + url + '" class="pcard-media" aria-label="' + esc(p.name) + '">' +
      '<img src="' + esc(p.main) + '" alt="' + esc(p.name) + '" loading="lazy"></a>' +
      '<div class="pcard-body">' +
      '<div class="stars">' + window.stars(p.rating) + ' <span>' + p.rating + ' (' + p.reviews + ')</span></div>' +
      '<h3><a href="' + url + '">' + esc(p.name) + '</a></h3>' +
      '<p class="sub">' + esc(p.tagline) + '</p>' +
      (p.variants.length > 1 ? '<div class="swatch-row">' + sw + more + '</div>' : '') +
      '<div class="price-row"><span class="price">' + window.money(p.price) + '</span>' +
      '<span class="ship-tag">Free US shipping</span></div>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-primary" style="flex:1;padding:12px 18px;font-size:14px" data-act="add" data-id="' + esc(p.id) + '" data-v="' + esc(p.variants[0].n) + '">Add to cart</button>' +
      '<a href="' + url + '" class="btn btn-ghost" style="padding:12px 18px;font-size:14px">Details</a>' +
      '</div></div></article>';
  };

  /* ---------- scroll reveal ---------- */

  function initReveal() {
    var els = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (e) { io.observe(e); });
  }
  window.initReveal = initReveal;

  /* ---------- FAQ accordion ---------- */

  window.buildFAQ = function (mountId) {
    var box = document.getElementById(mountId);
    if (!box) return;
    box.innerHTML = window.FAQS.map(function (f) {
      return '<div class="faq-item reveal"><button class="faq-q" aria-expanded="false">' +
        esc(f[0]) + '<span class="pm">+</span></button>' +
        '<div class="faq-a"><div>' + esc(f[1]) + '</div></div></div>';
    }).join('');

    box.addEventListener('click', function (e) {
      var q = e.target.closest('.faq-q');
      if (!q) return;
      var item = q.parentElement, panel = $('.faq-a', item);
      var isOpen = item.classList.contains('open');
      $$('.faq-item', box).forEach(function (f) {
        f.classList.remove('open');
        $('.faq-q', f).setAttribute('aria-expanded', 'false');
        $('.faq-a', f).style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add('open');
        q.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  };

  /* ---------- Web3Forms helper ---------- */

  window.sendForm = function (payload) {
    return fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.assign({ access_key: WEB3FORMS_KEY, from_name: 'NioPets store' }, payload)),
    });
  };

  /* ---------- newsletter ---------- */

  window.initNewsletter = function () {
    var form = $('#newsForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('input', form);
      var email = input.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
        window.Cart.toast('Enter a valid email address');
        return;
      }
      form.reset();
      window.Cart.toast('Subscribed. Your 10% code is on its way');
      window.sendForm({
        subject: 'New NioPets newsletter signup',
        name: 'Newsletter signup',
        email: email,
        message: 'New subscriber: ' + email,
      }).catch(function () {});
    });
  };

  /* ---------- search ---------- */

  window.initSearch = function () {
    $$('.searchbar').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = $('input', form).value.trim();
        location.href = 'products.html' + (q ? '?q=' + encodeURIComponent(q) : '');
      });
    });
  };

  /* ---------- nav highlight ---------- */

  function markActiveNav() {
    var page = location.pathname.split('/').pop() || 'index.html';
    $$('nav.main a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === page || (page === 'product.html' && href === 'products.html')) {
        a.classList.add('active');
      }
    });
  }

  /* ---------- boot ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    syncBadge();
    renderDrawer();
    initReveal();
    markActiveNav();
    window.initSearch();
    window.initNewsletter();

    var y = $('#yr');
    if (y) y.textContent = new Date().getFullYear();

    $$('[data-open-cart]').forEach(function (b) { b.addEventListener('click', window.openCart); });
    $$('[data-open-menu]').forEach(function (b) { b.addEventListener('click', window.openMenu); });
    $$('[data-close]').forEach(function (b) { b.addEventListener('click', closeAll); });
  });
})();
