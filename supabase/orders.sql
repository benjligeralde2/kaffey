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
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists cashier_id uuid references auth.users(id);
alter table public.orders add column if not exists cashier_name text;
alter table public.orders add column if not exists status text not null default 'Pending';

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'orders'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint if exists %I', constraint_name);
  end loop;
end
$$;

update public.orders set status = 'Finished' where status = 'Approved';
alter table public.orders add constraint orders_status_check check (status in ('Pending', 'On process', 'Finished'));
create index if not exists orders_cashier_id_created_at_idx on public.orders (cashier_id, created_at desc);
create index if not exists orders_status_created_at_idx on public.orders (status, created_at desc);

alter table public.orders enable row level security;

drop policy if exists "Staff can read orders" on public.orders;
create policy "Staff can read orders"
  on public.orders
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'cashier'));

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;