-- Halloween Party Manager: schema and access controls
-- Run the whole script in Supabase Dashboard > SQL Editor.
-- Public can read names and parent relationships only through safe views.
-- Amounts are stored in base tables and available only to authenticated admin users.
-- Important: disable public sign-ups in Supabase Authentication settings.

create extension if not exists pgcrypto;

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  parent_id uuid null references public.guests(id) on delete cascade,
  amount_toman bigint not null default 0 check (amount_toman >= 0),
  sort_order bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.hosts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  amount_toman bigint not null default 0 check (amount_toman >= 0),
  sort_order bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists guests_parent_id_idx on public.guests(parent_id);
create index if not exists guests_sort_order_idx on public.guests(sort_order);
create index if not exists hosts_sort_order_idx on public.hosts(sort_order);

alter table public.guests enable row level security;
alter table public.hosts enable row level security;

-- No direct anonymous access to underlying tables.
revoke all on public.guests from anon, authenticated;
revoke all on public.hosts from anon, authenticated;
grant select, insert, update, delete on public.guests to authenticated;
grant select, insert, update, delete on public.hosts to authenticated;

drop policy if exists "admin users can manage guests" on public.guests;
create policy "admin users can manage guests"
on public.guests for all to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "admin users can manage hosts" on public.hosts;
create policy "admin users can manage hosts"
on public.hosts for all to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- Safe public views intentionally exclude amount_toman and created_at.
-- These views are owned by the migration/table owner; do not add sensitive columns.
drop view if exists public.guests_public;
create view public.guests_public
with (security_barrier = true)
as
select id, name, parent_id, sort_order
from public.guests;

drop view if exists public.hosts_public;
create view public.hosts_public
with (security_barrier = true)
as
select id, name, sort_order
from public.hosts;

revoke all on public.guests_public from public;
revoke all on public.hosts_public from public;
grant select on public.guests_public to anon, authenticated;
grant select on public.hosts_public to anon, authenticated;

-- Tell PostgREST to refresh its schema cache.
notify pgrst, 'reload schema';
