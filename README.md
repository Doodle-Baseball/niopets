# NioPets

Static HTML/CSS/vanilla-JS storefront. Six physical products, one cart, one payment through Whop.

---

# PHASE 1: AUDIT

You asked me not to agree with bad architecture. Here is what survived scrutiny and what did not.

## Your multi-product cart flow: SUPPORTED

Verified at `docs.whop.com/developer/api/getting-started`. Whop's `checkout_configurations.create` accepts an **inline plan** with `initial_price` and `plan_type: "one_time"`. You do not need six Whop products. Your server computes one total and creates one checkout for it.

```
POST https://api.whop.com/api/v1/checkout_configurations
Authorization: Bearer <WHOP_API_KEY>

{ "currency": "usd",
  "plan": { "initial_price": 179.96, "plan_type": "one_time",
            "company_id": "biz_xxx", "currency": "usd" },
  "metadata": { "order_id": "NIO-20260820-AB12CD" } }
```

Response gives `plan.id`. Checkout is `https://whop.com/checkout/<plan.id>`, or embedded on your own page.

**Correction to earlier advice:** the base URL is `api.whop.com/api/v1`, not `v5`. Whop's docs state v2 and v5 are legacy and do not use Standard Webhooks signatures. This code uses v1 only.

## Metadata: SUPPORTED

Checkout configuration metadata is inherited by the payment, so the `payment.succeeded` webhook can read exactly what was ordered and where to ship it.

## GitHub Pages for your backend: NOT POSSIBLE

GitHub Pages serves static files. It cannot run server code, cannot hold a secret, and cannot receive `POST /api/webhooks/whop`. There is no configuration that fixes this. Any tutorial claiming otherwise is wrong.

**You must move hosting.** Recommendation below.

## "No database": NOT SAFE AS STATED

This is the part I will not soften.

Serverless functions are stateless and are destroyed between invocations. A JavaScript `Map` does not survive a cold start, a second concurrent instance, or a redeploy. With no persistent store you lose:

| Problem | Consequence with no store |
|---|---|
| Whop delivers each event **at least once** and retries 12 times over ~71 hours | The same `payment.succeeded` is processed repeatedly. You ship one order twice. |
| Two webhooks arrive at two warm instances | Neither sees the other's dedupe entry |
| Payment succeeds, your email provider is down | Order vanishes with no record it existed |
| Refund arrives for an order | Nothing to update |

**You do not need Postgres.** You need one key-value store. [Upstash Redis](https://upstash.com) has a free tier and a plain HTTPS API, so it works from any serverless runtime with no driver and no connection pool. Two environment variables and it works.

`api/_store.js` uses it when configured and falls back to memory with a loud warning when not. **The fallback is for local testing, not for taking real money.**

## Whop for physical goods: PAYMENT ONLY

Whop is a payment processor. It is not a fulfilment system. It does not calculate shipping rates, does not print labels, does not track parcels, and does not manage inventory.

Whop's embedded checkout **can** collect a shipping address (`data-whop-checkout-collect-shipping`). But relying only on that means your order data lives in Whop's dashboard in a shape you have not verified. So this build collects the address on **your** site, validates it server-side, and passes it through as metadata. The Whop address form stays on as a second capture, prefilled from what the customer already typed.

**Test this on one real order before advertising.** Confirm the address arrives intact in your PAID email.

## Inventory: REAL LIMITATION

With no inventory system, two customers can buy your last unit at the same time. Both get charged. You refund one and apologise. At six products and low volume this is survivable, but it is a real risk you are accepting, not a solved problem.

---

# PHASE 2: ARCHITECTURE

```
                       CUSTOMER
                          |
                https://niopets.online
                          |
        Static HTML / CSS / vanilla JS  (Vercel)
                          |
              POST /api/create-checkout
              body: ids + quantities ONLY
                          |
                 SERVERLESS FUNCTION
                 - validates every id
                 - validates every quantity
                 - prices from api/_catalog.js
                 - integer cents, never floats
                          |
                 POST api.whop.com/api/v1
                 checkout_configurations
                 (WHOP_API_KEY, server only)
                          |
              WHOP EMBEDDED CHECKOUT (iframe)
                          |
                    CUSTOMER PAYS
                          |
       +------------------+------------------+
       |                                     |
  redirect to                     POST /api/webhooks/whop
  success.html                    - verify HMAC signature
  (receipt only,                  - reject replays
   proves NOTHING)                - dedupe by webhook-id
                                  - email you the paid order
                                          |
                                    YOU SHIP IT
```

**Hosting recommendation: put everything on Vercel.**

Frontend and API on one domain means no CORS complexity, no second deployment, and `/api/webhooks/whop` just works. A separate `api.niopets.online` subdomain adds moving parts and buys you nothing here. Keep GitHub as your repository; Vercel deploys from it on every push.

---

# PHASE 3: WHAT IS BUILT

```
index.html  products.html  product.html  cart.html
checkout.html  success.html  cancel.html  about.html  contact.html
css/style.css
js/config.js       public settings, no secrets
js/products.js     display catalog
js/cart.js         localStorage cart, ids and quantities only
js/app.js          header, drawer, animations, forms
js/checkout.js     validation, API call, Whop embed
api/_catalog.js    TRUSTED PRICES. the only price source that matters
api/_store.js      KV store, idempotency, rate limiting
api/create-checkout.js
api/webhooks/whop.js
test/run-tests.js  42 automated tests
.env.example  .gitignore  vercel.json
```

## The security rule, enforced

The browser sends this and only this:

```json
{ "items": [ { "id": "bubble-carrier", "variant": "Black", "quantity": 2 } ] }
```

`api/_catalog.js` then: rejects unknown ids, rejects non-integer/negative/oversized quantities, rejects unknown variants, rejects duplicate lines that would bypass the quantity cap, caps at 20 line items and $5,000, and computes everything in **integer cents**.

Prices are never read from the request. Extra fields like `price` or `total` are ignored entirely. Test 2 proves a request carrying `price: 0.01` on the $99 launcher still totals 9900 cents.

## Webhook verification

Whop uses the [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks) spec:

- Headers: `webhook-id`, `webhook-timestamp`, `webhook-signature` (`v1,<base64>`)
- Signature: `HMAC-SHA256(secret, "{id}.{timestamp}.{raw body}")`, base64
- Verified against the **raw body**, before any parsing. Parsing first changes the bytes and breaks valid deliveries.
- Timestamps older than 5 minutes are rejected (replay protection)
- Comparison is constant-time via `crypto.timingSafeEqual`
- Duplicate `webhook-id` values are ignored
- A handler failure returns 500 so Whop retries rather than losing the order

Events handled: `payment.created`, `payment.pending`, `payment.succeeded`, `payment.failed`, `refund.created`, `refund.updated`. All six confirmed to exist in Whop's current event table.

---

# PHASE 4: TESTING

```bash
npm test
```

42 tests covering pricing, tampering, malicious input, order ceilings, signature forgery, replay, idempotency and catalog drift. All passing.

## Manual tests before you launch

**Cart:** add one product, add several, increase quantity, remove, refresh the page, empty the cart, try to check out empty, type `-5` and `99999` into the quantity box.

**Security:** open devtools, edit `localStorage` to `[{"id":"bubble-carrier","quantity":999}]`, reload, try to check out. It must be rejected. Then `curl` the API directly:

```bash
curl -X POST https://niopets.online/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"items":[{"id":"ball-launcher","quantity":1,"price":0.01}],
       "customer":{"first_name":"T","last_name":"T","email":"t@t.com",
       "phone":"5551234567","address":"1 Main","city":"Austin",
       "state":"Texas","zip":"78701"}}'
```

The returned `total_cents` must be `9900`.

**Payments (use Whop sandbox first):** set `whopEnvironment: 'sandbox'` in `js/config.js`, create sandbox plans at `sandbox.whop.com/dashboard`, then test success, decline, duplicate webhook (send the same test event twice, confirm only one email), and a refund.

---

# PHASE 5: DEPLOYMENT

**1. Rotate your Whop API key.** The key you shared in chat is compromised. Delete it in Whop → Developer → API keys and create a new one.

**2. Push to GitHub**, then import the repo at [vercel.com/new](https://vercel.com/new). Framework preset: **Other**. No build command.

**3. Add environment variables** in Vercel → Settings → Environment Variables:

```
WHOP_API_KEY              (your NEW key)
WHOP_COMPANY_ID           biz_...
WHOP_WEBHOOK_SECRET       (step 5)
WEB3FORMS_KEY
ORDER_EMAILS              wahabilyas205@gmail.com,wahabilyas206@gmail.com
SITE_URL                  https://niopets.online
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
SHIPPING_FEE              0
TAX_RATE                  0
```

**4. Point the domain.** In Vercel → Settings → Domains add `niopets.online`. In Namecheap → Advanced DNS, remove the GitHub Pages records and add what Vercel shows you:

| Type | Host | Value |
|---|---|---|
| A | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |

Use the exact values from your Vercel dashboard; they change. Propagation takes up to 24 hours.

**5. Create the webhook** in Whop → Developer → Webhooks:

- URL `https://niopets.online/api/webhooks/whop`
- Events: the six payment and refund events
- API version **v1**
- Copy the signing secret into `WHOP_WEBHOOK_SECRET` and redeploy
- Send a test event and confirm a 200

**6. Set up Upstash.** Create a free Redis database, copy the REST URL and token into Vercel, redeploy.

---

# PHASE 6: LIMITATIONS YOU ARE ACCEPTING

**Tax is set to 0.** US sales tax depends on economic nexus, which varies by state and by your sales volume, and you are selling into the US from Pakistan. I am not able to give you legal certainty here. Talk to a US sales tax accountant before you scale. When you have an answer, set `TAX_RATE` and the checkout picks it up.

**No customer order history.** No accounts, no "my orders" page. Records live in your inbox, in Upstash, and in the Whop dashboard.

**No inventory control.** Overselling is possible under concurrent orders.

**Refunds are issued in the Whop dashboard**, not on your site. The site never claims a refund is complete; it only records what Whop reports.

**Returns.** All return promises have been removed from the site at your request. The site now says: message us within 48 hours if an item arrives damaged or wrong. Check your local consumer-law obligations for US sales, because a stated policy of no returns is not always enforceable.

---

# FINAL VERDICT

## READY FOR SANDBOX TESTING. NOT READY FOR LIVE PAYMENTS.

Implemented and verified:

- Server-side pricing in integer cents, tested against 15 attack inputs
- Webhook signature verification, replay rejection, constant-time comparison
- Idempotency by `webhook-id`
- CORS locked to your origins, rate limiting, no secrets in frontend
- Success page is a receipt, not a payment check

**Four things block go-live, and all four are yours to do:**

1. **Rotate the exposed API key.** Non-negotiable.
2. **Configure Upstash.** Without it, duplicate webhooks will double-ship orders.
3. **Complete one full sandbox payment**, then one real low-value order. Confirm the shipping address arrives intact in the PAID email.
4. **Move off GitHub Pages.** The webhook endpoint cannot exist there.

Do those four and this is ready. Skip number 2 and you will eventually ship an order twice and not know why.
