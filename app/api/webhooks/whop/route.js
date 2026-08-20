import { NextResponse } from 'next/server';
import crypto from 'crypto';
import store from '../../../../lib/store.js';

const {
  seenWebhook,
  markWebhookSeen,
  saveOrder,
  getOrder,
} = store;

export const runtime = 'nodejs';

const WHOP_WEBHOOK_SECRET = process.env.WHOP_WEBHOOK_SECRET;
const WEB3FORMS_KEY = process.env.WEB3FORMS_KEY;
const ORDER_EMAILS = (process.env.ORDER_EMAILS || process.env.ORDER_EMAIL || 'info@niopets.online')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean);
const TOLERANCE_SECONDS = 300;

function verifySignature(rawBody, headers) {
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const sigHeader = headers.get('webhook-signature');

  if (!id || !ts || !sigHeader) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const signedPayload = `${id}.${ts}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', WHOP_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('base64');

  const expectedBuf = Buffer.from(expected);
  return sigHeader.split(' ').some((part) => {
    const value = part.includes(',') ? part.split(',')[1] : part;
    const given = Buffer.from(value || '');
    if (given.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(given, expectedBuf);
  });
}

function centsFromPayment(payment, meta) {
  if (meta && meta.total_cents) return Number(meta.total_cents);
  const amount = payment.final_amount ?? payment.amount ?? 0;
  return Math.round(Number(amount) * 100);
}

function formatOrder(payment, meta, heading) {
  let lines = [];
  try {
    lines = JSON.parse(meta.order_items || '[]');
  } catch {
    lines = [];
  }

  const itemText = lines.length
    ? lines
        .map(
          (i) =>
            `${i.name}${i.variant ? ' / ' + i.variant : ''} x ${i.quantity} = $${(
              i.line_total_cents / 100
            ).toFixed(2)}`
        )
        .join('\n')
    : '(no line items in metadata)';

  return [
    heading,
    'Order: ' + (meta.order_id || payment.id),
    'Whop payment ID: ' + payment.id,
    '',
    itemText,
    '',
    'Subtotal: $' + (Number(meta.subtotal_cents || 0) / 100).toFixed(2),
    'Shipping: $' + (Number(meta.shipping_cents || 0) / 100).toFixed(2),
    'Tax: $' + (Number(meta.tax_cents || 0) / 100).toFixed(2),
    'TOTAL PAID: $' + (centsFromPayment(payment, meta) / 100).toFixed(2),
    '',
    'SHIP TO',
    meta.ship_name || '',
    (meta.ship_address || '') + (meta.ship_address_2 ? ', ' + meta.ship_address_2 : ''),
    `${meta.ship_city || ''}, ${meta.ship_state || ''} ${meta.ship_zip || ''}`,
    'United States',
    '',
    'Phone: ' + (meta.ship_phone || '-'),
    'Email: ' + (meta.ship_email || '-'),
    'Order notes: ' + (meta.ship_notes || '-'),
  ].join('\n');
}

async function emailOwners(subject, message, replyTo) {
  if (!WEB3FORMS_KEY) {
    console.error('[webhook] WEB3FORMS_KEY missing, cannot send order email');
    throw new Error('Email not configured');
  }
  for (const recipient of ORDER_EMAILS) {
    const r = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject,
        from_name: 'NioPets store',
        name: 'NioPets order system',
        email: recipient,
        replyto: replyTo || recipient,
        message,
      }),
    });
    if (!r.ok) throw new Error('Web3Forms rejected the email for ' + recipient);
  }
}

export async function POST(request) {
  if (!WHOP_WEBHOOK_SECRET) {
    console.error('[webhook] WHOP_WEBHOOK_SECRET is not set. Refusing all events.');
    return new NextResponse('not configured', { status: 500 });
  }

  let raw;
  try {
    raw = await request.text();
    if (raw.length > 1_000_000) return new NextResponse('bad body', { status: 400 });
  } catch {
    return new NextResponse('bad body', { status: 400 });
  }

  if (!verifySignature(raw, request.headers)) {
    console.warn('[webhook] Rejected: bad or missing signature');
    return new NextResponse('invalid signature', { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse('bad json', { status: 400 });
  }

  const webhookId = request.headers.get('webhook-id');
  const type = event.type || event.action;
  const payment = event.data || {};
  const meta = payment.metadata || {};
  const orderRef = meta.order_id || payment.id;

  if (await seenWebhook(webhookId)) {
    console.log('[webhook] Duplicate ignored', webhookId, type);
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (type) {
      case 'payment.succeeded': {
        const existing = await getOrder(orderRef);
        if (existing && existing.status === 'paid') {
          console.log('[webhook] Order already paid, skipping', orderRef);
          break;
        }
        await emailOwners(
          `PAID - NioPets order ${orderRef} - $${(centsFromPayment(payment, meta) / 100).toFixed(2)}`,
          formatOrder(payment, meta, 'PAYMENT CONFIRMED. SHIP THIS ORDER.'),
          meta.ship_email
        );
        await saveOrder(orderRef, {
          order_ref: orderRef,
          status: 'paid',
          payment_status: 'paid',
          whop_payment_id: payment.id,
          paid_at: new Date().toISOString(),
          total_cents: centsFromPayment(payment, meta),
          subtotal_cents: Number(meta.subtotal_cents || existing?.subtotal_cents || 0),
          shipping_cents: Number(meta.shipping_cents || existing?.shipping_cents || 0),
          tax_cents: Number(meta.tax_cents || existing?.tax_cents || 0),
          lines: existing?.lines || (() => {
            try { return JSON.parse(meta.order_items || '[]'); } catch { return []; }
          })(),
          customer: existing?.customer || {
            first_name: (meta.ship_name || '').split(' ').slice(0, -1).join(' ') || meta.ship_name || '',
            last_name: (meta.ship_name || '').split(' ').slice(-1).join(' ') || '',
            email: meta.ship_email || '',
            phone: meta.ship_phone || '',
            address: meta.ship_address || '',
            address_2: meta.ship_address_2 || '',
            city: meta.ship_city || '',
            state: meta.ship_state || '',
            zip: meta.ship_zip || '',
            country: meta.ship_country || 'US',
            notes: meta.ship_notes || '',
          },
          metadata: meta,
        });
        console.log('[webhook] PAID', orderRef);
        break;
      }

      case 'payment.failed': {
        await saveOrder(orderRef, {
          order_ref: orderRef,
          status: 'failed',
          payment_status: 'pending',
          failed_at: new Date().toISOString(),
        });
        console.log('[webhook] FAILED', orderRef);
        break;
      }

      case 'payment.pending': {
        await saveOrder(orderRef, { order_ref: orderRef, status: 'pending', payment_status: 'pending', metadata: meta });
        console.log('[webhook] PENDING', orderRef);
        break;
      }

      case 'payment.created': {
        console.log('[webhook] CREATED', orderRef);
        break;
      }

      case 'refund.created':
      case 'refund.updated': {
        const status = payment.status || 'unknown';
        await emailOwners(
          `REFUND ${status} - NioPets order ${orderRef}`,
          [
            'Refund event: ' + type,
            'Refund status reported by Whop: ' + status,
            'Order: ' + orderRef,
            'Whop refund/payment ID: ' + (payment.id || '-'),
            '',
            'Do not tell the customer a refund is complete until Whop reports it as completed.',
          ].join('\n'),
          meta.ship_email
        );
        await saveOrder(orderRef, {
          order_ref: orderRef,
          status: 'refund_' + status,
          refund_seen_at: new Date().toISOString(),
        });
        console.log('[webhook] REFUND', type, status, orderRef);
        break;
      }

      default:
        console.log('[webhook] Unhandled event', type);
    }

    await markWebhookSeen(webhookId);
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[webhook] Handler failed', type, orderRef, e.message);
    return new NextResponse('handler failed', { status: 500 });
  }
}
