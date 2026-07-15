-- ════════════════════════════════════════════════════════════════════════
-- migration_pricelist_margin.sql          (run AFTER migration_pricelist.sql)
--
-- Purchase vs Selling pricelist:
--   1. pricelist_prices.margin_pct — per-tier selling margin (null = default)
--   2. pricelist_settings — single row holding the global default margin %
--   3. RLS lockdown — raw purchase rates + margins become ADMIN-ONLY
--   4. pricelist_prices_selling view — computed selling rate for everyone
--      (staff/viewer read ONLY this; purchase & margin never leave the DB)
--   5. Touch triggers — keep staff realtime alive despite the RLS lockdown
--
-- Selling price = round( rate × (1 + coalesce(margin_pct, default)/100) )
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Per-tier margin ────────────────────────────────────────────────
alter table pricelist_prices add column if not exists margin_pct numeric;

-- ─── 2. Global default margin (single-row settings table) ──────────────
create table if not exists pricelist_settings (
  id                 int primary key default 1 check (id = 1),
  default_margin_pct numeric not null default 0,
  updated_at         timestamptz default now()
);
insert into pricelist_settings (id) values (1) on conflict do nothing;

drop trigger if exists pricelist_settings_updated_at on pricelist_settings;
create trigger pricelist_settings_updated_at
  before update on pricelist_settings
  for each row execute function update_updated_at();

grant select, update on pricelist_settings to authenticated;
grant all on pricelist_settings to service_role;

alter table pricelist_settings enable row level security;

-- Margin data is admin-only: selling + default margin ⇒ purchase is derivable,
-- so staff/viewer must not read this table.
drop policy if exists "Admin can view pricelist settings" on pricelist_settings;
create policy "Admin can view pricelist settings" on pricelist_settings
  for select using (get_user_role() = 'admin');
drop policy if exists "Admin can update pricelist settings" on pricelist_settings;
create policy "Admin can update pricelist settings" on pricelist_settings
  for update using (get_user_role() = 'admin');

-- ─── 3. Lock raw prices (purchase rate + margin) to admin only ─────────
drop policy if exists "Authenticated can view pricelist prices" on pricelist_prices;
drop policy if exists "Admin can view pricelist prices" on pricelist_prices;
create policy "Admin can view pricelist prices" on pricelist_prices
  for select using (get_user_role() = 'admin');

-- ─── 4. Selling-price view (all authenticated users) ──────────────────
-- INTENTIONALLY owner-rights (security_invoker = false): the view must bypass
-- the admin-only RLS on pricelist_prices, but it exposes ONLY the derived
-- selling rate — never the purchase rate or margin. Column is named `rate`
-- so client code can consume either source with the same shape.
create or replace view pricelist_prices_selling
with (security_invoker = false) as
select
  p.id,
  p.node_id,
  p.label,
  round(
    p.rate * (1 + coalesce(
      p.margin_pct,
      (select default_margin_pct from pricelist_settings limit 1),
      0
    ) / 100)
  ) as rate,
  p.unit,
  p.sort_order,
  p.created_at
from pricelist_prices p;

-- Supabase default privileges grant new objects to anon — revoke explicitly.
revoke all on pricelist_prices_selling from anon;
grant select on pricelist_prices_selling to authenticated;
grant select on pricelist_prices_selling to service_role;

-- ─── 5. Touch triggers so staff realtime survives the lockdown ────────
-- Staff can't receive realtime events on pricelist_prices (RLS filters them),
-- but they CAN see pricelist_nodes. Bump the parent node's updated_at whenever
-- a price changes so every client refetches. Invoker rights are fine: only
-- admin / service_role can write prices in the first place.
create or replace function touch_pricelist_node()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update pricelist_nodes
     set updated_at = now()
   where id = coalesce(new.node_id, old.node_id);
  return coalesce(new, old);
end $$;

drop trigger if exists pricelist_prices_touch_node on pricelist_prices;
create trigger pricelist_prices_touch_node
  after insert or update or delete on pricelist_prices
  for each row execute function touch_pricelist_node();

-- Default-margin change reprices everything ⇒ touch all nodes.
create or replace function touch_all_pricelist_nodes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update pricelist_nodes set updated_at = now();
  return new;
end $$;

drop trigger if exists pricelist_settings_touch_nodes on pricelist_settings;
create trigger pricelist_settings_touch_nodes
  after update on pricelist_settings
  for each row execute function touch_all_pricelist_nodes();

-- ─── 6. Realtime for settings (admin dashboards refresh live) ─────────
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'pricelist_settings'
  ) then
    alter publication supabase_realtime add table pricelist_settings;
  end if;
end $$;
