create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in ('Coffee', 'Tea', 'Refreshers')),
  description text not null,
  price numeric(10, 2) not null check (price >= 0),
  image text not null,
  tag text,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists "Staff can read products" on public.products;
create policy "Staff can read products"
  on public.products
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
      and c.relname = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
end
$$;
