/* ============================================================
   lib/store.js

   Durable store for orders + webhook idempotency.

   Priority:
     1. Supabase Storage bucket "niopets-data" (works with your API keys
        even when no Postgres tables exist yet)
     2. Upstash Redis (optional)
     3. In-memory (local only; lost on cold start)

   Rate limiting always uses in-memory or Upstash — never Postgres —
   so a missing table cannot break checkout.
============================================================ */

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HAS_KV = Boolean(URL_ && TOKEN);

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
const STORAGE_BUCKET = 'niopets-data';

const memory = new Map();
let warned = false;
let storageReady = null;

function warnOnce() {
  if (HAS_KV || HAS_SUPABASE || warned) return;
  warned = true;
  console.warn(
    '[store] NO DURABLE STORE CONFIGURED. Using in-memory fallback. ' +
      'Set SUPABASE_URL + SUPABASE_SECRET_KEY (or Upstash) before going live.'
  );
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    ...extra,
  };
}

/** Ensure the private storage bucket exists (created once per process). */
async function ensureStorageBucket() {
  if (!HAS_SUPABASE) return false;
  if (storageReady != null) return storageReady;

  try {
    const list = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: supabaseHeaders(),
    });
    if (!list.ok) throw new Error('list buckets ' + list.status);
    const buckets = await list.json();
    const exists = Array.isArray(buckets) && buckets.some((b) => b.name === STORAGE_BUCKET || b.id === STORAGE_BUCKET);

    if (!exists) {
      const create = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: STORAGE_BUCKET,
          name: STORAGE_BUCKET,
          public: false,
          file_size_limit: 1048576,
        }),
      });
      if (!create.ok && create.status !== 409) {
        const body = await create.text();
        throw new Error('create bucket ' + create.status + ' ' + body.slice(0, 200));
      }
    }

    storageReady = true;
    return true;
  } catch (e) {
    console.error('[store] storage bucket setup failed', e.message);
    storageReady = false;
    return false;
  }
}

async function storagePut(path, value) {
  const ok = await ensureStorageBucket();
  if (!ok) throw new Error('Supabase Storage is not available');

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: supabaseHeaders({
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    }),
    body: JSON.stringify(value),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('Storage put failed: ' + res.status + ' ' + body.slice(0, 200));
  }
}

async function storageGet(path) {
  const ok = await ensureStorageBucket();
  if (!ok) return null;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
    headers: supabaseHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Storage get failed: ' + res.status);
  return res.json();
}

async function storageList(prefix) {
  const ok = await ensureStorageBucket();
  if (!ok) return [];

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${STORAGE_BUCKET}`, {
    method: 'POST',
    headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
    }),
  });
  if (!res.ok) throw new Error('Storage list failed: ' + res.status);
  const rows = await res.json();
  return Array.isArray(rows) ? rows.filter((r) => r.name && !r.name.endsWith('/')) : [];
}

/* ---------- Upstash ---------- */

async function kv(command) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error('KV command failed: ' + res.status);
  const json = await res.json();
  return json.result;
}

/* ---------- generic get/set (webhooks + helpers) ---------- */

async function get(key) {
  warnOnce();

  if (HAS_SUPABASE) {
    const value = await storageGet(`kv/${encodeURIComponent(key)}.json`);
    if (!value) return null;
    if (value.__expires && value.__expires < Date.now()) return null;
    return value.__payload !== undefined ? value.__payload : value;
  }

  if (!HAS_KV) {
    const hit = memory.get(key);
    if (!hit) return null;
    if (hit.expires && hit.expires < Date.now()) {
      memory.delete(key);
      return null;
    }
    return hit.value;
  }

  const raw = await kv(['GET', key]);
  return raw ? JSON.parse(raw) : null;
}

async function set(key, value, ttlSeconds) {
  warnOnce();

  if (HAS_SUPABASE) {
    const wrapped = {
      __payload: value,
      __expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    };
    await storagePut(`kv/${encodeURIComponent(key)}.json`, wrapped);
    return;
  }

  if (!HAS_KV) {
    memory.set(key, {
      value,
      expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
    return;
  }

  const cmd = ['SET', key, JSON.stringify(value)];
  if (ttlSeconds) cmd.push('EX', String(ttlSeconds));
  await kv(cmd);
}

/* ---------- webhook idempotency ---------- */

async function seenWebhook(webhookId) {
  if (!webhookId) return false;
  const hit = await get('wh:' + webhookId);
  return Boolean(hit);
}

async function markWebhookSeen(webhookId) {
  if (!webhookId) return;
  await set('wh:' + webhookId, { at: Date.now() }, 60 * 60 * 24 * 7);
}

/* ---------- orders ---------- */

function orderPath(orderRef) {
  return `orders/${orderRef}.json`;
}

async function saveOrder(orderRef, data) {
  if (!orderRef) return;

  let existing = {};
  try {
    existing = (await getOrder(orderRef)) || {};
  } catch {
    existing = {};
  }

  const merged = {
    ...existing,
    ...data,
    order_ref: orderRef,
    customer: {
      ...(existing.customer || {}),
      ...(data.customer || {}),
    },
    updated_at: new Date().toISOString(),
  };

  if (!merged.created_at) merged.created_at = new Date().toISOString();

  if (HAS_SUPABASE) {
    await storagePut(orderPath(orderRef), merged);
    return;
  }

  await set('order:' + orderRef, merged, 60 * 60 * 24 * 180);
}

async function getOrder(orderRef) {
  if (!orderRef) return null;

  if (HAS_SUPABASE) {
    return storageGet(orderPath(orderRef));
  }

  return get('order:' + orderRef);
}

async function listOrders() {
  warnOnce();

  if (HAS_SUPABASE) {
    const files = await storageList('orders');
    const orders = [];
    for (const file of files) {
      const name = file.name.endsWith('.json') ? file.name : `${file.name}`;
      const order = await storageGet(`orders/${name}`);
      if (order) orders.push(order);
    }
    return orders;
  }

  if (!HAS_KV) {
    return Array.from(memory.entries())
      .filter(([key, hit]) => key.startsWith('order:') && (!hit.expires || hit.expires >= Date.now()))
      .map(([, hit]) => hit.value);
  }

  const keys = [];
  let cursor = '0';
  do {
    const result = await kv(['SCAN', cursor, 'MATCH', 'order:*', 'COUNT', '100']);
    cursor = String(result[0]);
    keys.push(...result[1]);
  } while (cursor !== '0');

  const orders = [];
  for (const key of keys) {
    const order = await get(key);
    if (order) orders.push(order);
  }
  return orders;
}

/* ---------- rate limiting (never touches Supabase tables) ---------- */

async function rateLimit(key, limit, windowSeconds) {
  warnOnce();
  const bucket = 'rl:' + key + ':' + Math.floor(Date.now() / 1000 / windowSeconds);

  if (HAS_KV) {
    try {
      const count = await kv(['INCR', bucket]);
      if (count === 1) await kv(['EXPIRE', bucket, String(windowSeconds)]);
      return count <= limit;
    } catch (e) {
      console.error('[store] rate limit check failed, allowing request', e.message);
      return true;
    }
  }

  const hit = memory.get(bucket);
  const current = hit && (!hit.expires || hit.expires >= Date.now()) ? hit.value : 0;
  if (current >= limit) return false;
  memory.set(bucket, {
    value: current + 1,
    expires: Date.now() + windowSeconds * 1000,
  });
  return true;
}

module.exports = {
  HAS_KV,
  HAS_SUPABASE,
  get,
  set,
  seenWebhook,
  markWebhookSeen,
  saveOrder,
  getOrder,
  listOrders,
  rateLimit,
};
