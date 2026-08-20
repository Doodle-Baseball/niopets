import { NextResponse } from 'next/server';
import store from '../../../lib/store.js';
import auth from '../../../lib/admin-auth.js';

const { listOrders, saveOrder } = store;
const { isAuthorizedRequest } = auth;

const ALLOWED_STATUSES = new Set([
  'pending',
  'shipping',
  'delivered',
  'done',
]);
const ALLOWED_PAYMENT_STATUSES = new Set(['pending', 'paid']);
const HIDDEN_ADMIN_ORDER_REFS = new Set([
  'NIO-20260820-6GAPTN',
  'NIO-20260820-TLSNFZ',
  'NIO-20260820-4RU38L',
  'NIO-20260820-4KRHR5',
  'NIO-20260820-EUUH9X',
  'NIO-20260820-LZ7Y9T',
  'NIO-20260820-82BY6R',
]);

function matchesSearch(order, q) {
  if (!q) return true;
  const c = order.customer || {};
  const haystack = [
    order.order_ref,
    order.status,
    order.whop_payment_id,
    order.session_id,
    c.email,
    c.phone,
    c.first_name,
    c.last_name,
    c.city,
    c.state,
    c.zip,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function inDateRange(order, from, to) {
  const created = new Date(order.created_at || 0).getTime();
  if (!Number.isFinite(created)) return false;
  if (from) {
    const start = new Date(from).getTime();
    if (Number.isFinite(start) && created < start) return false;
  }
  if (to) {
    const end = new Date(to);
    if (Number.isFinite(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      if (created > end.getTime()) return false;
    }
  }
  return true;
}

function metricsFor(orders) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const paid = orders.filter(
    (order) =>
      order.payment_status === 'paid' ||
      (!order.payment_status && ['paid', 'processing', 'shipped', 'shipping', 'delivered', 'done'].includes(order.status))
  );
  const sales = (since) =>
    paid
      .filter((order) => new Date(order.paid_at || order.created_at || 0).getTime() >= since)
      .reduce((sum, order) => sum + Number(order.total_cents || 0), 0);

  return {
    total_orders: orders.length,
    total_sales_cents: sales(0),
    sales_30_days_cents: sales(now - 30 * day),
    sales_7_days_cents: sales(now - 7 * day),
  };
}

export async function GET(request) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') || '').trim();
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const from = (searchParams.get('from') || '').trim();
    const to = (searchParams.get('to') || '').trim();

    let orders = (await listOrders()).filter((order) => !HIDDEN_ADMIN_ORDER_REFS.has(order.order_ref)).sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );

    const allMetrics = metricsFor(orders);

    if (status && status !== 'all') {
      orders = status === 'new'
        ? orders.filter((order) => !ALLOWED_STATUSES.has(order.status))
        : orders.filter((order) => order.status === status);
    }
    if (q) orders = orders.filter((order) => matchesSearch(order, q));
    if (from || to) orders = orders.filter((order) => inDateRange(order, from, to));

    return NextResponse.json({
      orders,
      metrics: allMetrics,
      filtered_count: orders.length,
      filters: { status: status || 'all', q, from, to },
    });
  } catch (error) {
    console.error('[admin] list failed', error.message);
    return NextResponse.json(
      {
        error: 'Could not load orders. Check Supabase connection (SUPABASE_URL + SUPABASE_SECRET_KEY).',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const orderRef = typeof body?.order_ref === 'string' ? body.order_ref.trim() : '';
  const status = typeof body?.status === 'string' ? body.status.trim() : '';
  const paymentStatus = typeof body?.payment_status === 'string' ? body.payment_status.trim() : '';
  if (!orderRef || (!ALLOWED_STATUSES.has(status) && !ALLOWED_PAYMENT_STATUSES.has(paymentStatus))) {
    return NextResponse.json({ error: 'Invalid order status update' }, { status: 400 });
  }

  try {
    const update = { admin_updated_at: new Date().toISOString() };
    if (ALLOWED_STATUSES.has(status)) update.status = status;
    if (ALLOWED_PAYMENT_STATUSES.has(paymentStatus)) update.payment_status = paymentStatus;
    await saveOrder(orderRef, update);
    return NextResponse.json({ ok: true, order_ref: orderRef, ...update });
  } catch (error) {
    console.error('[admin] update failed', error.message);
    return NextResponse.json({ error: 'Could not update order' }, { status: 500 });
  }
}
