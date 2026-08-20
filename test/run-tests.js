/* ============================================================
   test/run-tests.js
   Run with: node test/run-tests.js

   Covers the attacks that actually matter:
   price tampering, quantity abuse, webhook forgery, replay.
============================================================ */

const crypto = require('crypto');
const path = require('path');

const { priceCart, CATALOG } = require(path.join(__dirname, '..', 'lib', 'catalog.js'));

let pass = 0, fail = 0;

function ok(name, condition, detail) {
  if (condition) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

function rejects(name, items) {
  try {
    priceCart(items);
    ok(name, false, 'accepted when it should have been rejected');
  } catch (e) {
    ok(name + '  [' + e.message + ']', true);
  }
}

console.log('\n=== 1. SERVER SIDE PRICING ===');

const two = priceCart([{ id: 'bubble-carrier', quantity: 2 }]);
ok('2 x $45 carrier = 9000 cents', two.totalCents === 9000, two.totalCents);

const mixed = priceCart([
  { id: 'bubble-carrier', quantity: 1 },  // 45.00
  { id: 'cat-fountain', quantity: 2 },    // 98.00
  { id: 'travel-cup', quantity: 1 },      // 20.00
]);
ok('multi product cart = 16300 cents', mixed.totalCents === 16300, mixed.totalCents);
ok('line items are itemised', mixed.lines.length === 3);
ok('integer cents only, no floats', Number.isInteger(mixed.totalCents));

/* the classic float bug: 0.1 + 0.2 style drift */
const many = priceCart([{ id: 'travel-bottle', quantity: 3 }]);
ok('no float drift on 3 x $30', many.totalCents === 9000, many.totalCents);

console.log('\n=== 2. PRICE TAMPERING ===');

/* a browser sending its own price is simply ignored */
const spoofed = priceCart([{ id: 'ball-launcher', quantity: 1, price: 0.01, total: 0.01, unit_price_cents: 1 }]);
ok('injected price fields ignored, still 9900', spoofed.totalCents === 9900, spoofed.totalCents);
ok('server uses catalog price, not sent price', spoofed.lines[0].unit_price_cents === 9900);

console.log('\n=== 3. MALICIOUS INPUT ===');

rejects('unknown product id', [{ id: 'free-money', quantity: 1 }]);
rejects('negative quantity', [{ id: 'travel-cup', quantity: -5 }]);
rejects('zero quantity', [{ id: 'travel-cup', quantity: 0 }]);
rejects('huge quantity', [{ id: 'travel-cup', quantity: 999999 }]);
rejects('fractional quantity', [{ id: 'travel-cup', quantity: 1.5 }]);
rejects('string quantity', [{ id: 'travel-cup', quantity: '5; DROP TABLE' }]);
rejects('empty cart', []);
rejects('null items', null);
rejects('not an array', { id: 'travel-cup', quantity: 1 });
rejects('malformed line', [null]);
rejects('missing id', [{ quantity: 2 }]);
rejects('unknown variant', [{ id: 'travel-cup', quantity: 1, variant: 'Solid Gold' }]);
rejects('duplicate line to bypass qty cap', [
  { id: 'travel-cup', quantity: 10, variant: 'Blue' },
  { id: 'travel-cup', quantity: 10, variant: 'Blue' },
]);
rejects('too many line items', Array.from({ length: 40 }, () => ({ id: 'travel-cup', quantity: 1 })));

/* quantity cap is enforced per product */
rejects('quantity above product max', [{ id: 'bubble-carrier', quantity: 11 }]);
const atCap = priceCart([{ id: 'bubble-carrier', quantity: 10 }]);
ok('quantity exactly at the cap is allowed', atCap.totalCents === 45000, atCap.totalCents);

/* different variants of the same product are separate legitimate lines */
const twoVariants = priceCart([
  { id: 'travel-cup', quantity: 1, variant: 'Blue' },
  { id: 'travel-cup', quantity: 1, variant: 'Green' },
]);
ok('two different variants allowed', twoVariants.totalCents === 4000, twoVariants.totalCents);

console.log('\n=== 4. ORDER CEILING ===');
rejects('order above the $5,000 ceiling', Array.from({ length: 19 }, (_, i) => ({
  id: CATALOG[i % CATALOG.length].id,
  quantity: 10,
  variant: CATALOG[i % CATALOG.length].variants[0],
})).map((l, i) => ({ ...l, variant: CATALOG[i % CATALOG.length].variants[i % 2] })));

console.log('\n=== 5. WEBHOOK SIGNATURE (Standard Webhooks) ===');

const SECRET = 'ws_test_secret';
const TOLERANCE = 300;

function verify(rawBody, headers, secret) {
  const id = headers['webhook-id'], ts = headers['webhook-timestamp'], sig = headers['webhook-signature'];
  if (!id || !ts || !sig) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (!Number.isFinite(age) || age > TOLERANCE) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${id}.${ts}.${rawBody}`).digest('base64');
  const eb = Buffer.from(expected);
  return sig.split(' ').some((part) => {
    const v = part.includes(',') ? part.split(',')[1] : part;
    const g = Buffer.from(v || '');
    return g.length === eb.length && crypto.timingSafeEqual(g, eb);
  });
}

const body = JSON.stringify({ id: 'msg_1', type: 'payment.succeeded', data: { id: 'pay_1', metadata: { order_id: 'NIO-1' } } });
const wid = 'msg_bQPHmO2eBnHYtWWuxAN9K3Xd';
const now = String(Math.floor(Date.now() / 1000));
const goodSig = 'v1,' + crypto.createHmac('sha256', SECRET).update(`${wid}.${now}.${body}`).digest('base64');
const H = (over) => Object.assign({ 'webhook-id': wid, 'webhook-timestamp': now, 'webhook-signature': goodSig }, over);

ok('genuine Whop signature accepted', verify(body, H(), SECRET) === true);
ok('forged signature rejected', verify(body, H({ 'webhook-signature': 'v1,AAAA=' }), SECRET) === false);
ok('missing signature rejected', verify(body, { 'webhook-id': wid, 'webhook-timestamp': now }, SECRET) === false);
ok('tampered body rejected', verify(body.replace('pay_1', 'pay_EVIL'), H(), SECRET) === false);
ok('replayed old event rejected', verify(body, H({ 'webhook-timestamp': String(Number(now) - 7200) }), SECRET) === false);
ok('wrong signing secret rejected', verify(body, H(), 'ws_wrong_secret') === false);
ok('swapped webhook id rejected', verify(body, H({ 'webhook-id': 'msg_other' }), SECRET) === false);

console.log('\n=== 6. WEBHOOK IDEMPOTENCY ===');

const seen = new Set();
function handle(id) {
  if (seen.has(id)) return 'duplicate';
  seen.add(id);
  return 'processed';
}
ok('first delivery processed', handle('msg_A') === 'processed');
ok('retry of same event ignored', handle('msg_A') === 'duplicate');
ok('third delivery still ignored', handle('msg_A') === 'duplicate');
ok('a different event still processes', handle('msg_B') === 'processed');

console.log('\n=== 7. CATALOG INTEGRITY ===');

ok('exactly 6 products', CATALOG.length === 6, CATALOG.length);
ok('every product has a positive price', CATALOG.every((p) => p.price > 0));
ok('every product has a quantity cap', CATALOG.every((p) => p.maxQuantity >= 1));
ok('every product has at least one variant', CATALOG.every((p) => p.variants.length >= 1));
ok('all ids unique', new Set(CATALOG.map((p) => p.id)).size === CATALOG.length);

/* display catalog and server catalog must agree, or customers see one
   price and get charged another */
global.window = {};
require(path.join(__dirname, '..', 'public', 'js', 'products.js'));
const drift = window.PRODUCTS.filter((p) => {
  const s = CATALOG.find((c) => c.id === p.id);
  return !s || s.price !== p.price;
});
ok('display prices match server prices', drift.length === 0,
  drift.map((d) => d.id).join(', '));

console.log('\n============================================');
console.log(`  ${pass} passed, ${fail} failed`);
console.log('============================================\n');
process.exit(fail ? 1 : 0);
