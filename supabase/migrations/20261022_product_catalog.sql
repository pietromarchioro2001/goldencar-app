-- Catalogo condiviso dei prodotti usati nelle schede GOLDENCAR.
-- Eseguire in Supabase SQL Editor prima di testare il catalogo dalla Preview.
create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('TAGLIANDO', 'FRENI', 'RICAMBI')),
  name text not null check (length(trim(name)) between 1 and 120),
  normalized_name text generated always as (lower(trim(name))) stored,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_catalog_category_name_unique unique (category, normalized_name)
);

alter table public.product_catalog enable row level security;
revoke all on table public.product_catalog from anon, authenticated;
grant all on table public.product_catalog to service_role;
