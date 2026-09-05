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
