create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_name text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  payment_method text not null check (payment_method in ('Cash')),
  order_type text not null default 'Dine-in',
  table_number text not null default 'Counter',
  line_items jsonb not null default '[]'::jsonb,
  cashier_id uuid references auth.users(id),
  cashier_name text,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists cashier_id uuid references auth.users(id);
alter table public.orders add column if not exists cashier_name text;
create index if not exists orders_cashier_id_created_at_idx on public.orders (cashier_id, created_at desc);

alter table public.orders enable row level security;

drop policy if exists "Staff can read orders" on public.orders;
create policy "Staff can read orders"
  on public.orders
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'cashier'));