import { NextResponse } from 'next/server';
import crypto from 'crypto';
import catalog from '../../../lib/catalog.js';
import store from '../../../lib/store.js';

const { priceCart } = catalog;
const { rateLimit, saveOrder } = store;

const WHOP_API_KEY = process.env.WHOP_API_KEY;
const WHOP_COMPANY_ID = process.env.WHOP_COMPANY_ID;
const SITE_URL = process.env.SITE_URL || 'https://niopets.online';
const WHOP_SANDBOX =
  String(process.env.WHOP_SANDBOX || '').toLowerCase() === 'true' ||
  process.env.WHOP_SANDBOX === '1';
const WHOP_API_BASE =
  process.env.WHOP_API_BASE ||
  (WHOP_SANDBOX ? 'https://sandbox-api.whop.com/api/v1' : 'https://api.whop.com/api/v1');
const WHOP_CHECKOUT_BASE = (
  process.env.WHOP_CHECKOUT_BASE ||
  (WHOP_SANDBOX ? 'https://sandbox.whop.com' : 'https://whop.com')
).replace(/\/$/, '');

/** Prefer WHOP_CHECKOUT_BASE host even when Whop returns an absolute production URL. */
function buildCheckoutUrl(purchaseUrl, planId) {
  if (purchaseUrl) {
    try {
      const parsed = new URL(purchaseUrl, WHOP_CHECKOUT_BASE);
      return new URL(parsed.pathname + parsed.search + parsed.hash, WHOP_CHECKOUT_BASE).toString();
    } catch {
      /* fall through to plan fallback */
    }
  }
  return `${WHOP_CHECKOUT_BASE}/checkout/${planId}`;
}

const ALLOWED_ORIGINS = [
  'https://niopets.online',
  'https://www.niopets.online',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return headers;
}

function makeOrderRef() {
  const d = new Date();
  const day =
    d.getUTCFullYear() +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let tail = '';
  for (let i = 0; i < 6; i++) tail += alphabet[bytes[i] % alphabet.length];
  return `NIO-${day}-${tail}`;
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function validateCustomer(c) {
  const out = {
    first_name: str(c.first_name, 60),
    last_name: str(c.last_name, 60),
    email: str(c.email, 120).toLowerCase(),
    phone: str(c.phone, 40),
    address: str(c.address, 160),
    address_2: str(c.address_2, 120),
    city: str(c.city, 80),
    state: str(c.state, 60),
    zip: str(c.zip, 12),
    country: 'US',
    notes: str(c.notes, 500),
  };

  const problems = [];
  if (!out.first_name) problems.push('first_name');
  if (!out.last_name) problems.push('last_name');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(out.email)) problems.push('email');
  if (out.phone.replace(/\D/g, '').length < 7) problems.push('phone');
  if (!out.address) problems.push('address');
  if (!out.city) problems.push('city');
  if (!out.state) problems.push('state');
  if (!/^\d{5}(-\d{4})?$/.test(out.zip)) problems.push('zip');

  if (problems.length) {
    const err = new Error('Invalid shipping details');
    err.fields = problems;
    throw err;
  }
  return out;
}

export async function OPTIONS(request) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403, headers });
  }

  if (!WHOP_API_KEY || !WHOP_COMPANY_ID) {
    console.error('[checkout] Missing WHOP_API_KEY or WHOP_COMPANY_ID');
    return NextResponse.json({ error: 'Payment is not configured yet.' }, { status: 500, headers });
  }

  const ip =
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown';
  const allowed = await rateLimit('checkout:' + ip, 10, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Wait a minute and try again.' },
      { status: 429, headers }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers });
  }

  let priced;
  let customer;
  try {
    priced = priceCart(body.items);
    customer = validateCustomer(body.customer || {});
  } catch (e) {
    return NextResponse.json({ error: e.message, fields: e.fields }, { status: 400, headers });
  }

  const orderRef = makeOrderRef();
  const totalDollars = priced.totalCents / 100;
  const returnBase = origin && ALLOWED_ORIGINS.includes(origin) ? origin : SITE_URL;

  let whop;
  try {
    const resp = await fetch(`${WHOP_API_BASE}/checkout_configurations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currency: 'usd',
        plan: {
          initial_price: totalDollars,
          plan_type: 'one_time',
          company_id: WHOP_COMPANY_ID,
          currency: 'usd',
        },
        redirect_url: `${returnBase}/success.html?ref=${encodeURIComponent(orderRef)}`,
        metadata: {
          order_id: orderRef,
          order_items: JSON.stringify(priced.lines),
          subtotal_cents: String(priced.subtotalCents),
          shipping_cents: String(priced.shippingCents),
          tax_cents: String(priced.taxCents),
          total_cents: String(priced.totalCents),
          currency: 'usd',
          ship_name: `${customer.first_name} ${customer.last_name}`,
          ship_email: customer.email,
          ship_phone: customer.phone,
          ship_address: customer.address,
          ship_address_2: customer.address_2,
          ship_city: customer.city,
          ship_state: customer.state,
          ship_zip: customer.zip,
          ship_country: 'US',
          ship_notes: customer.notes,
        },
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error('[checkout] Whop rejected', resp.status, JSON.stringify(data).slice(0, 800));
      if (resp.status === 403) {
        return NextResponse.json(
          {
            error:
              'Whop API key lacks checkout permissions. Enable checkout_configuration:create, plan:create, access_pass:create, access_pass:update, and checkout_configuration:basic:read.',
          },
          { status: 502, headers }
        );
      }
      return NextResponse.json(
        { error: 'Could not start checkout. Please try again.' },
        { status: 502, headers }
      );
    }
    whop = data;
  } catch (e) {
    console.error('[checkout] Whop unreachable', e.message);
    return NextResponse.json(
      { error: 'Payment provider unreachable. Please try again.' },
      { status: 502, headers }
    );
  }

  const planId = whop?.plan?.id || whop?.plan_id || null;
  const sessionId = whop?.id || null;
  const checkoutUrl = buildCheckoutUrl(whop?.purchase_url, planId);

  if (!planId) {
    console.error('[checkout] No plan id in Whop response', JSON.stringify(whop).slice(0, 800));
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 502, headers }
    );
  }

  await saveOrder(orderRef, {
    order_ref: orderRef,
    status: 'awaiting_payment',
    created_at: new Date().toISOString(),
    plan_id: planId,
    session_id: sessionId,
    subtotal_cents: priced.subtotalCents,
    shipping_cents: priced.shippingCents,
    tax_cents: priced.taxCents,
    total_cents: priced.totalCents,
    lines: priced.lines,
    customer,
  });

  console.log(`[checkout] ${orderRef} created, ${priced.totalCents} cents, plan ${planId}`);

  return NextResponse.json(
    {
      order_ref: orderRef,
      plan_id: planId,
      session_id: sessionId,
      checkout_url: checkoutUrl,
      subtotal_cents: priced.subtotalCents,
      shipping_cents: priced.shippingCents,
      tax_cents: priced.taxCents,
      total_cents: priced.totalCents,
    },
    { status: 200, headers }
  );
}
