-- Optional Postgres schema for NioPets.
-- Not required anymore: orders are stored in the Supabase Storage
-- bucket "niopets-data" using your SUPABASE_URL + SUPABASE_SECRET_KEY.
--
-- Run this in the SQL Editor only if you later want a real orders table.

create table if not exists public.orders (
  order_ref text primary key,
  status text not null default 'awaiting_payment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  plan_id text,
  session_id text,
  whop_payment_id text,
  subtotal_cents integer not null default 0,
  shipping_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  lines jsonb not null default '[]'::jsonb,
  customer jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_customer_email_idx on public.orders ((customer->>'email'));

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant all on public.orders to service_role;
