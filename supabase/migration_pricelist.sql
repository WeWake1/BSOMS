-- ════════════════════════════════════════════════════════════════════════
-- migration_pricelist.sql
--
-- Adds the Pricelist module:
--   1. pricelist_suppliers — reusable "where it's sourced from" directory
--   2. pricelist_node_kind enum — 'group' (folder) | 'product' (priced leaf)
--   3. pricelist_nodes — self-referencing tree (uneven depth per branch)
--   4. pricelist_prices — one product → many rate tiers (Retail/Wholesale/…)
--   5. updated_at triggers, grants, RLS (all auth SELECT; admin writes), realtime
--
-- Read access: admin / staff / viewer (everyone signed in).
-- Write access: admin only (reuses the existing get_user_role() helper).
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Suppliers directory ───────────────────────────────────────────
create table if not exists pricelist_suppliers (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  location     text,            -- city / area / address
  contact_name text,
  phone        text,            -- stored as entered (free text)
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── 2. Node kind: a node is either a folder or a priced item ──────────
do $$ begin
  create type pricelist_node_kind as enum ('group', 'product');
exception
  when duplicate_object then null;
end $$;

-- ─── 3. Nodes — self-referencing tree ─────────────────────────────────
--   group   → a folder (Plywood, Duraflame, …); holds children, no price
--   product → a priced leaf (303, 710 18mm, …); holds size + rate tiers
create table if not exists pricelist_nodes (
  id          uuid primary key default uuid_generate_v4(),
  parent_id   uuid references pricelist_nodes(id) on delete cascade,
  kind        pricelist_node_kind not null default 'group',
  name        text not null,
  -- structured size (products only; all optional)
  length      numeric,
  width       numeric,
  thickness   numeric,
  unit        text,            -- default unit label, e.g. 'per sheet'
  supplier_id uuid references pricelist_suppliers(id) on delete set null,
  sort_order  integer not null default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_pricelist_nodes_parent
  on pricelist_nodes(parent_id, sort_order);
create index if not exists idx_pricelist_nodes_kind
  on pricelist_nodes(kind);
create index if not exists idx_pricelist_nodes_supplier
  on pricelist_nodes(supplier_id);

-- ─── 4. Rate tiers — one product can carry multiple prices ────────────
create table if not exists pricelist_prices (
  id         uuid primary key default uuid_generate_v4(),
  node_id    uuid references pricelist_nodes(id) on delete cascade not null,
  label      text not null default 'Standard',  -- e.g. Retail / Wholesale
  rate       numeric not null,
  unit       text,            -- per sheet / sq.ft. / piece / kg
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_pricelist_prices_node
  on pricelist_prices(node_id, sort_order);

-- ─── 5a. updated_at triggers (reuse existing update_updated_at()) ──────
drop trigger if exists pricelist_nodes_updated_at on pricelist_nodes;
create trigger pricelist_nodes_updated_at
  before update on pricelist_nodes
  for each row execute function update_updated_at();

drop trigger if exists pricelist_suppliers_updated_at on pricelist_suppliers;
create trigger pricelist_suppliers_updated_at
  before update on pricelist_suppliers
  for each row execute function update_updated_at();

-- ─── 5b. Grants (RLS below restricts writes to admin) ─────────────────
grant select, insert, update, delete on pricelist_suppliers to authenticated;
grant select, insert, update, delete on pricelist_nodes      to authenticated;
grant select, insert, update, delete on pricelist_prices     to authenticated;
grant all on pricelist_suppliers, pricelist_nodes, pricelist_prices to service_role;

-- ─── 5c. RLS: all authenticated SELECT, admin-only writes ─────────────
alter table pricelist_suppliers enable row level security;
alter table pricelist_nodes     enable row level security;
alter table pricelist_prices    enable row level security;

-- suppliers
drop policy if exists "Authenticated can view suppliers" on pricelist_suppliers;
create policy "Authenticated can view suppliers" on pricelist_suppliers
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admin can insert suppliers" on pricelist_suppliers;
create policy "Admin can insert suppliers" on pricelist_suppliers
  for insert with check (get_user_role() = 'admin');
drop policy if exists "Admin can update suppliers" on pricelist_suppliers;
create policy "Admin can update suppliers" on pricelist_suppliers
  for update using (get_user_role() = 'admin');
drop policy if exists "Admin can delete suppliers" on pricelist_suppliers;
create policy "Admin can delete suppliers" on pricelist_suppliers
  for delete using (get_user_role() = 'admin');

-- nodes
drop policy if exists "Authenticated can view pricelist nodes" on pricelist_nodes;
create policy "Authenticated can view pricelist nodes" on pricelist_nodes
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admin can insert pricelist nodes" on pricelist_nodes;
create policy "Admin can insert pricelist nodes" on pricelist_nodes
  for insert with check (get_user_role() = 'admin');
drop policy if exists "Admin can update pricelist nodes" on pricelist_nodes;
create policy "Admin can update pricelist nodes" on pricelist_nodes
  for update using (get_user_role() = 'admin');
drop policy if exists "Admin can delete pricelist nodes" on pricelist_nodes;
create policy "Admin can delete pricelist nodes" on pricelist_nodes
  for delete using (get_user_role() = 'admin');

-- prices
drop policy if exists "Authenticated can view pricelist prices" on pricelist_prices;
create policy "Authenticated can view pricelist prices" on pricelist_prices
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admin can insert pricelist prices" on pricelist_prices;
create policy "Admin can insert pricelist prices" on pricelist_prices
  for insert with check (get_user_role() = 'admin');
drop policy if exists "Admin can update pricelist prices" on pricelist_prices;
create policy "Admin can update pricelist prices" on pricelist_prices
  for update using (get_user_role() = 'admin');
drop policy if exists "Admin can delete pricelist prices" on pricelist_prices;
create policy "Admin can delete pricelist prices" on pricelist_prices
  for delete using (get_user_role() = 'admin');

-- ─── 5d. Realtime (idempotent — skip if already in the publication) ────
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'pricelist_suppliers'
  ) then
    alter publication supabase_realtime add table pricelist_suppliers;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'pricelist_nodes'
  ) then
    alter publication supabase_realtime add table pricelist_nodes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'pricelist_prices'
  ) then
    alter publication supabase_realtime add table pricelist_prices;
  end if;
end $$;
