/* ============================================================
   NioPets — /api/checkout
   ------------------------------------------------------------
   Deploy this as a serverless function (Vercel, Netlify, Cloudflare)
   or an Express route. The store's index.html POSTs the cart here,
   this file prices it from the trusted PRICES table, creates ONE
   Whop checkout for the total, and returns the checkout URL.

   ⚠️  ROTATE the API key you shared — it has been exposed in chat.
       Then put the new one in an environment variable:

       WHOP_API_KEY=apik_xxxxxxxx
       WHOP_COMPANY_ID=biz_6liUhLWOIZ3ar7

   Never paste the key into index.html or any browser-side file.
============================================================ */

const WHOP_API_KEY    = process.env.WHOP_API_KEY;
const WHOP_COMPANY_ID = process.env.WHOP_COMPANY_ID; // biz_6liUhLWOIZ3ar7
const SUCCESS_URL     = process.env.SUCCESS_URL || 'https://niopets.online/#/success';

/* Trusted prices — the browser never decides what to charge. */
const PRICES = {
  'bubble-carrier':  45,
  'ball-launcher':   99,
  'water-dispenser': 35,
  'travel-bottle':   30,
  'travel-cup':      20,
  'cat-fountain':    49
};

const NAMES = {
  'bubble-carrier':  'Bubble Pet Carrier Backpack',
  'ball-launcher':   'Automatic Ball Launcher',
  'water-dispenser': 'Adjustable Pet Water Dispenser',
  'travel-bottle':   'Portable Dog Water Bottle',
  'travel-cup':      'Pet Water Feeder Travel Cup',
  'cat-fountain':    'Automatic Cat Water Fountain 2L'
};

function priceCart(items) {
  let total = 0;
  const lines = [];
  for (const raw of items || []) {
    const price = PRICES[raw.id];
    if (price === undefined) throw new Error('Unknown product: ' + raw.id);
    const qty = Math.max(1, Math.min(20, parseInt(raw.quantity, 10) || 1));
    total += price * qty;
    lines.push({ product_id: raw.id, name: NAMES[raw.id], variant: raw.variant || '', quantity: qty, unit_price: price });
  }
  if (!lines.length) throw new Error('Cart is empty');
  return { total: Math.round(total * 100) / 100, lines };
}

/* ---------- Vercel / Next.js App Router ---------- */
export async function POST(request) {
  try {
    const body = await request.json();
    const { total, lines } = priceCart(body.items);
    const c = body.customer || {};

    const res = await fetch('https://api.whop.com/api/v5/company/checkout_configurations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + WHOP_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        company_id: WHOP_COMPANY_ID,
        plan: {
          initial_price: total,
          plan_type: 'one_time',
          base_currency: 'usd'
        },
        redirect_url: SUCCESS_URL,
        metadata: {
          order_ref:  body.order_ref || '',
          items:      JSON.stringify(lines),
          first_name: c.first_name || '',
          last_name:  c.last_name  || '',
          email:      c.email      || '',
          phone:      c.phone      || '',
          address:    c.address    || '',
          address_2:  c.address_2  || '',
          city:       c.city       || '',
          state:      c.state      || '',
          zip:        c.zip        || '',
          country:    'United States (US)',
          notes:      c.notes      || ''
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: 'Whop rejected the checkout', detail: data }, { status: 502 });
    }

    /* Field names vary by Whop API version — hand back whichever is present. */
    const url = data.purchase_url || data.checkout_url || data.url ||
                (data.id ? 'https://whop.com/checkout/' + data.id : null);

    return Response.json({ checkout_url: url, session_id: data.id, total });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}

/* ---------- Express equivalent ----------
const express = require('express');
const app = express();
app.use(express.json());

app.post('/api/checkout', async (req, res) => {
  try {
    const { total, lines } = priceCart(req.body.items);
    const r = await fetch('https://api.whop.com/api/v5/company/checkout_configurations', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + WHOP_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: WHOP_COMPANY_ID,
        plan: { initial_price: total, plan_type: 'one_time', base_currency: 'usd' },
        redirect_url: SUCCESS_URL,
        metadata: { order_ref: req.body.order_ref, items: JSON.stringify(lines), ...req.body.customer }
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'Whop rejected the checkout', detail: data });
    res.json({ checkout_url: data.purchase_url || data.checkout_url || data.url, total });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.listen(3000);
------------------------------------------- */

/* ---------- Webhook: POST /api/webhooks/whop ----------
   Add this endpoint in Whop Dashboard → Developer → Webhooks
   and subscribe to payment.succeeded. Read the metadata you
   attached above to know exactly what was bought and where to
   ship it, then email your fulfilment address.

export async function webhook(request) {
  const event = await request.json();
  if (event.action === 'payment.succeeded') {
    const m = event.data.metadata || {};
    // m.order_ref, m.items, m.first_name, m.address, m.city, m.state, m.zip ...
    // send fulfilment email here
  }
  return new Response('ok');
}
------------------------------------------------------- */
