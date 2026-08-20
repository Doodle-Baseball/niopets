/* ============================================================
   api/_catalog.js
   THE TRUSTED CATALOG. This is the ONLY price source that matters.
   It runs on the server. The browser cannot read or change it.

   To change a price you edit it HERE and in js/products.js.
   If the two ever disagree, this file wins and the customer is
   charged this amount.
============================================================ */

const CATALOG = [
  {
    "id": "bubble-carrier",
    "name": "Bubble Pet Carrier Backpack",
    "price": 45,
    "maxQuantity": 10,
    "active": true,
    "variants": [
      "Black",
      "Red",
      "Dark green",
      "Yellow",
      "Gray",
      "Blue",
      "Pink",
      "Fruit green",
      "Lemon yellow",
      "Brown front shell",
      "Green blue cover",
      "Green brown light-proof",
      "Blue brown light-proof"
    ]
  },
  {
    "id": "ball-launcher",
    "name": "Automatic Ball Launcher",
    "price": 99,
    "maxQuantity": 10,
    "active": true,
    "variants": [
      "White"
    ]
  },
  {
    "id": "water-dispenser",
    "name": "Adjustable Pet Water Dispenser",
    "price": 35,
    "maxQuantity": 10,
    "active": true,
    "variants": [
      "Blue + 650ml bottle",
      "Pink + 650ml bottle",
      "Yellow riser + 640ml bottle"
    ]
  },
  {
    "id": "travel-bottle",
    "name": "Portable Dog Water Bottle",
    "price": 30,
    "maxQuantity": 10,
    "active": true,
    "variants": [
      "Mist pink",
      "Tiffany blue",
      "Mist pink (print)",
      "Tiffany blue (print)"
    ]
  },
  {
    "id": "travel-cup",
    "name": "Pet Water Feeder Travel Cup",
    "price": 20,
    "maxQuantity": 10,
    "active": true,
    "variants": [
      "Blue",
      "Green",
      "Black",
      "Orange"
    ]
  },
  {
    "id": "cat-fountain",
    "name": "Automatic Cat Water Fountain 2L",
    "price": 49,
    "maxQuantity": 10,
    "active": true,
    "variants": [
      "Blue",
      "Light green",
      "Grey",
      "Orange"
    ]
  }
];

const MAX_QTY_PER_LINE = 10;
const MAX_LINES = 20;
const MAX_ORDER_CENTS = 500000; // $5,000 hard ceiling per order

/** Money is handled in integer cents. Never in floats. */
function toCents(dollars) {
  return Math.round(Number(dollars) * 100);
}

/**
 * Prices a cart from ids + quantities ONLY.
 * Throws on anything suspicious. Returns integer cents.
 */
function priceCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cart is empty');
  }
  if (items.length > MAX_LINES) {
    throw new Error('Too many line items');
  }

  const seen = new Set();
  const lines = [];
  let subtotalCents = 0;

  for (const raw of items) {
    if (!raw || typeof raw.id !== 'string') throw new Error('Malformed line item');

    const product = CATALOG.find((p) => p.id === raw.id);
    if (!product) throw new Error('Unknown product: ' + raw.id);
    if (!product.active) throw new Error('Product unavailable: ' + raw.id);

    // quantity must be a clean positive integer within limits
    const qty = Number(raw.quantity);
    if (!Number.isInteger(qty)) throw new Error('Quantity must be a whole number');
    if (qty < 1) throw new Error('Quantity must be at least 1');
    if (qty > Math.min(product.maxQuantity, MAX_QTY_PER_LINE)) {
      throw new Error('Quantity above the limit for ' + product.name);
    }

    // variant, if supplied, must be one this product actually has
    let variant = '';
    if (raw.variant != null) {
      if (typeof raw.variant !== 'string') throw new Error('Malformed variant');
      if (!product.variants.includes(raw.variant)) {
        throw new Error('Unknown variant for ' + product.name);
      }
      variant = raw.variant;
    }

    // one line per product+variant, so quantity limits cannot be bypassed
    const key = product.id + '|' + variant;
    if (seen.has(key)) throw new Error('Duplicate line item: ' + key);
    seen.add(key);

    const unitCents = toCents(product.price);
    subtotalCents += unitCents * qty;

    lines.push({
      product_id: product.id,
      name: product.name,
      variant,
      quantity: qty,
      unit_price_cents: unitCents,
      line_total_cents: unitCents * qty,
    });
  }

  const shippingCents = toCents(process.env.SHIPPING_FEE || 0);
  const taxRate = Number(process.env.TAX_RATE || 0);
  const taxCents = Math.round(subtotalCents * taxRate);
  const totalCents = subtotalCents + shippingCents + taxCents;

  if (totalCents <= 0) throw new Error('Invalid order total');
  if (totalCents > MAX_ORDER_CENTS) throw new Error('Order total above the limit');

  return { lines, subtotalCents, shippingCents, taxCents, totalCents };
}

module.exports = { CATALOG, priceCart, toCents };
