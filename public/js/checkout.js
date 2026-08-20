/* ============================================================
   js/checkout.js

   Flow:
     validate shipping form
       -> POST { items:[{id,variant,quantity}], customer }  to the API
       -> server prices the cart and creates the Whop checkout
       -> mount Whop embedded checkout with the returned plan/session
       -> customer pays inside Whop's iframe
       -> Whop redirects to success.html
       -> the WEBHOOK confirms the payment. Not this file.

   No total is ever sent. No card data ever touches this page.
============================================================ */
(function () {
  'use strict';

  var API = window.SITE_CONFIG.apiBase + '/api/create-checkout';
  var RETURN_URL = window.SITE_CONFIG.siteUrl + '/success.html';

  var els = {};
  var submitting = false;

  function money(n) { return window.money(n); }

  /* ---------- order summary ---------- */

  function renderSummary() {
    var items = window.Cart.detailed();
    var list = document.getElementById('ckList');
    var totals = document.getElementById('ckTotals');
    if (!list) return;

    if (!items.length) {
      location.replace('cart.html');
      return;
    }

    list.innerHTML = items.map(function (i) {
      return '<div class="mini-item">' +
        '<img src="' + window.esc(i.image) + '" alt="' + window.esc(i.name) + '">' +
        '<div class="t"><h5>' + window.esc(i.name) + '</h5>' +
        '<small>' + window.esc(i.variant) + ' x ' + i.quantity + '</small></div>' +
        '<b>' + money(i.lineTotal) + '</b></div>';
    }).join('');

    var rows =
      '<div class="tot-row"><span>Subtotal (' + window.Cart.count() + ' items)</span><span>' + money(window.Cart.subtotal()) + '</span></div>' +
      '<div class="tot-row"><span>Shipping</span><span class="free">' +
      (window.Cart.shipping() === 0 ? 'Free' : money(window.Cart.shipping())) + '</span></div>';

    if (window.TAX_RATE > 0) {
      rows += '<div class="tot-row"><span>Tax</span><span>' + money(window.Cart.tax()) + '</span></div>';
    }
    rows += '<div class="tot-row big"><span>Total</span><span>' + money(window.Cart.total()) + '</span></div>';
    totals.innerHTML = rows;
  }

  /* ---------- validation ---------- */

  var RULES = {
    first_name: function (v) { return v.trim().length > 0; },
    last_name: function (v) { return v.trim().length > 0; },
    address: function (v) { return v.trim().length > 2; },
    city: function (v) { return v.trim().length > 0; },
    state: function (v) { return v.length > 0; },
    zip: function (v) { return /^\d{5}(-\d{4})?$/.test(v.trim()); },
    phone: function (v) { return v.replace(/\D/g, '').length >= 7; },
    email: function (v) { return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v.trim()); },
  };

  function markBad(id, bad) {
    var field = document.getElementById(id).closest('.field');
    field.classList.toggle('bad', bad);
    return bad;
  }

  function collect() {
    return {
      first_name: els.first_name.value,
      last_name: els.last_name.value,
      address: els.address.value,
      address_2: els.address_2.value,
      city: els.city.value,
      state: els.state.value,
      zip: els.zip.value,
      phone: els.phone.value,
      email: els.email.value,
      notes: els.notes.value,
      country: 'United States (US)',
    };
  }

  function validate() {
    var data = collect();
    var bad = 0;
    Object.keys(RULES).forEach(function (k) {
      if (markBad(k, !RULES[k](data[k] || ''))) bad++;
    });
    return bad === 0 ? data : null;
  }

  /* ---------- Whop embedded checkout ---------- */

  function mountWhop(res, customer) {
    document.getElementById('stepForm').style.display = 'none';
    document.getElementById('stepPay').style.display = 'block';

    document.getElementById('payRef').textContent = res.order_ref;
    document.getElementById('payTotal').textContent = money(res.total_cents / 100);

    var mount = document.getElementById('whop-embed');
    mount.innerHTML = '';

    /* Attributes verified against docs.whop.com/payments/checkout-embed */
    mount.setAttribute('data-whop-checkout-plan-id', res.plan_id);
    if (res.session_id) mount.setAttribute('data-whop-checkout-session', res.session_id);
    mount.setAttribute('data-whop-checkout-return-url', RETURN_URL + '?ref=' + encodeURIComponent(res.order_ref));
    mount.setAttribute('data-whop-checkout-theme', 'light');
    mount.setAttribute('data-whop-checkout-theme-accent-color', '#F4622B');
    mount.setAttribute('data-whop-checkout-theme-border-radius', '14');
    mount.setAttribute('data-whop-checkout-collect-shipping', 'true');
    mount.setAttribute('data-whop-checkout-on-payment-error', 'onWhopPaymentError');

    /* Prefill from the address the customer already typed, so they
       do not enter it twice. They can still correct it inside Whop. */
    mount.setAttribute('data-whop-checkout-prefill-email', customer.email);
    mount.setAttribute('data-whop-checkout-prefill-address-name', customer.first_name + ' ' + customer.last_name);
    mount.setAttribute('data-whop-checkout-prefill-address-country', 'US');
    mount.setAttribute('data-whop-checkout-prefill-address-line1', customer.address);
    mount.setAttribute('data-whop-checkout-prefill-address-line2', customer.address_2 || '');
    mount.setAttribute('data-whop-checkout-prefill-address-city', customer.city);
    mount.setAttribute('data-whop-checkout-prefill-address-state', customer.state);
    mount.setAttribute('data-whop-checkout-prefill-address-postal-code', customer.zip);

    if (window.SITE_CONFIG.whopEnvironment === 'sandbox') {
      mount.setAttribute('data-whop-checkout-environment', 'sandbox');
    }

    /* Remember the reference so success.html can show it. This is a
       display convenience only and proves nothing about payment. */
    try {
      sessionStorage.setItem('niopets_last_order', JSON.stringify({
        ref: res.order_ref,
        total: res.total_cents / 100,
      }));
    } catch (e) {}

    /* The loader script scans for these attributes. If it already ran,
       ask it to mount this node now. */
    if (window.wco && typeof window.wco.mount === 'function') {
      try { window.wco.mount('whop-embed'); } catch (e) {}
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.onWhopPaymentError = function (err) {
    window.Cart.toast((err && err.message) || 'Payment failed. Please try another card.');
  };

  /* ---------- submit ---------- */

  function startCheckout() {
    if (submitting) return;

    if (window.Cart.isEmpty()) {
      window.Cart.toast('Your cart is empty');
      location.href = 'cart.html';
      return;
    }

    var customer = validate();
    if (!customer) {
      window.Cart.toast('Check the highlighted fields');
      var first = document.querySelector('.field.bad');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    submitting = true;
    var btn = document.getElementById('ckBtn');
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = 'Creating your order ';

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      /* ids and quantities only. Never a price, never a total. */
      body: JSON.stringify({ items: window.Cart.payload(), customer: customer }),
    })
      .then(function (r) {
        return r.json().then(function (body) { return { ok: r.ok, body: body }; });
      })
      .then(function (out) {
        if (!out.ok || !out.body.plan_id) {
          throw new Error(out.body.error || 'Could not start checkout');
        }
        /* Leave card entry to Whop's hosted checkout. The returned URL is
           created for this exact server-priced order. */
        if (!out.body.checkout_url) {
          throw new Error('Whop did not return a checkout URL');
        }
        location.href = out.body.checkout_url;
      })
      .catch(function (e) {
        window.Cart.toast(e.message || 'Could not start checkout. Please try again.');
      })
      .finally(function () {
        submitting = false;
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.textContent = 'Continue to payment';
      });
  }

  /* ---------- boot ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('ckBtn')) return;

    ['first_name', 'last_name', 'address', 'address_2', 'city', 'state', 'zip', 'phone', 'email', 'notes']
      .forEach(function (id) { els[id] = document.getElementById(id); });

    /* US states */
    var sel = els.state;
    window.US_STATES.forEach(function (s) {
      var o = document.createElement('option');
      o.textContent = s;
      sel.appendChild(o);
    });

    /* Clear the error state as soon as the customer fixes a field. */
    Object.keys(RULES).forEach(function (k) {
      els[k].addEventListener('input', function () {
        if (RULES[k](els[k].value || '')) markBad(k, false);
      });
    });

    renderSummary();
    window.onCartChanged = renderSummary;

    document.getElementById('ckBtn').addEventListener('click', startCheckout);
  });
})();
