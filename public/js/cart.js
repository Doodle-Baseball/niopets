/* ============================================================
   js/cart.js

   The cart lives in localStorage and stores ONLY:
     [{ id, variant, quantity }]

   No prices are stored. Prices are looked up from the display
   catalog for rendering, and re-derived by the SERVER for charging.
   If someone edits localStorage they change what they see, never
   what they pay.
============================================================ */
(function () {
  'use strict';

  var KEY = 'niopets_cart_v1';
  var MAX = window.MAX_QTY || 10;

  var Cart = {};

  /* ---------- storage ---------- */

  Cart.read = function () {
    var raw;
    try {
      raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (e) {
      raw = [];
    }
    if (!Array.isArray(raw)) raw = [];

    /* Sanitise on every read: a hand edited localStorage cannot
       inject junk into the page or into the checkout request. */
    var clean = [];
    raw.forEach(function (item) {
      if (!item || typeof item.id !== 'string') return;
      var p = window.findProduct(item.id);
      if (!p || p.active === false) return;

      var variant = typeof item.variant === 'string' ? item.variant : '';
      var known = p.variants.some(function (v) { return v.n === variant; });
      if (!known) variant = p.variants[0].n;

      var q = parseInt(item.quantity, 10);
      if (!isFinite(q) || q < 1) q = 1;
      if (q > Math.min(MAX, p.maxQuantity || MAX)) q = Math.min(MAX, p.maxQuantity || MAX);

      var key = p.id + '|' + variant;
      var dupe = clean.find(function (c) { return c.id + '|' + c.variant === key; });
      if (dupe) { dupe.quantity = Math.min(MAX, dupe.quantity + q); return; }

      clean.push({ id: p.id, variant: variant, quantity: q });
    });
    return clean;
  };

  Cart.write = function (items) {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) {
      /* Private browsing or storage full. The cart still works for this page. */
      console.warn('Cart could not be saved', e);
    }
    document.dispatchEvent(new CustomEvent('cart:changed'));
  };

  /* ---------- operations ---------- */

  Cart.add = function (id, variant, qty) {
    var p = window.findProduct(id);
    if (!p) return false;
    if (p.active === false) { Cart.toast('That product is unavailable'); return false; }

    var v = variant || p.variants[0].n;
    var q = parseInt(qty, 10);
    if (!isFinite(q) || q < 1) q = 1;

    var items = Cart.read();
    var line = items.find(function (c) { return c.id === id && c.variant === v; });
    var cap = Math.min(MAX, p.maxQuantity || MAX);

    if (line) {
      if (line.quantity >= cap) {
        Cart.toast('You can order up to ' + cap + ' of this item');
        return false;
      }
      line.quantity = Math.min(cap, line.quantity + q);
    } else {
      items.push({ id: id, variant: v, quantity: Math.min(cap, q) });
    }

    Cart.write(items);
    Cart.toast(q + ' x ' + p.name + ' added to cart');
    return true;
  };

  Cart.setQuantity = function (id, variant, qty) {
    var p = window.findProduct(id);
    if (!p) return;
    var cap = Math.min(MAX, p.maxQuantity || MAX);
    var q = parseInt(qty, 10);

    var items = Cart.read();
    if (!isFinite(q) || q < 1) q = 1;
    if (q > cap) { q = cap; Cart.toast('Maximum ' + cap + ' per item'); }

    var line = items.find(function (c) { return c.id === id && c.variant === variant; });
    if (line) line.quantity = q;
    Cart.write(items);
  };

  Cart.bump = function (id, variant, delta) {
    var items = Cart.read();
    var line = items.find(function (c) { return c.id === id && c.variant === variant; });
    if (!line) return;
    var p = window.findProduct(id);
    var cap = Math.min(MAX, (p && p.maxQuantity) || MAX);
    var next = line.quantity + delta;

    if (next < 1) return Cart.remove(id, variant);
    if (next > cap) { Cart.toast('Maximum ' + cap + ' per item'); return; }

    line.quantity = next;
    Cart.write(items);
  };

  Cart.remove = function (id, variant) {
    var items = Cart.read().filter(function (c) {
      return !(c.id === id && c.variant === variant);
    });
    Cart.write(items);
    Cart.toast('Item removed');
  };

  Cart.clear = function () { Cart.write([]); };

  Cart.isEmpty = function () { return Cart.read().length === 0; };

  /* ---------- derived values, for DISPLAY only ---------- */

  Cart.detailed = function () {
    return Cart.read().map(function (c) {
      var p = window.findProduct(c.id);
      var v = p.variants.find(function (x) { return x.n === c.variant; }) || p.variants[0];
      return {
        id: c.id,
        variant: c.variant,
        quantity: c.quantity,
        name: p.name,
        price: p.price,
        image: v.img || p.main,
        lineTotal: p.price * c.quantity,
      };
    });
  };

  Cart.count = function () {
    return Cart.read().reduce(function (s, c) { return s + c.quantity; }, 0);
  };

  Cart.subtotal = function () {
    return Cart.detailed().reduce(function (s, i) { return s + i.lineTotal; }, 0);
  };

  Cart.shipping = function () { return window.SHIPPING_FEE || 0; };
  Cart.tax = function () { return Cart.subtotal() * (window.TAX_RATE || 0); };
  Cart.total = function () { return Cart.subtotal() + Cart.shipping() + Cart.tax(); };

  /** Exactly what gets POSTed to the server. Ids and quantities only. */
  Cart.payload = function () {
    return Cart.read().map(function (c) {
      return { id: c.id, variant: c.variant, quantity: c.quantity };
    });
  };

  /* ---------- toast ---------- */

  var toastTimer;
  Cart.toast = function (msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  };

  window.Cart = Cart;
})();
