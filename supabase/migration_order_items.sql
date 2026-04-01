-- =============================================================
-- MIGRATION: Add order_items table for sub-orders
-- Run this ENTIRE script in Supabase SQL Editor (Dashboard → SQL)
-- =============================================================

-- Step 1: Create order_items table
create table order_items (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid references orders(id) on delete cascade not null,
  item_label      text,
  date            date not null,
  due_date        date not null,
  dispatch_date   date,
  length          numeric,
  width           numeric,
  qty             integer not null default 1,
  description     text,
  photo_url       text,
  audio_url       text,
  created_at      timestamptz default now()
);

-- Step 2: Enable RLS
alter table order_items enable row level security;

create policy "Authenticated users can view order items" on order_items
  for select using (auth.role() = 'authenticated');

create policy "Admin can insert order items" on order_items
  for insert with check (get_user_role() = 'admin');

create policy "Admin can update order items" on order_items
  for update using (get_user_role() = 'admin');

create policy "Admin can delete order items" on order_items
  for delete using (get_user_role() = 'admin');

-- Step 3: Enable Realtime
alter table order_items replica identity full;

-- Step 4: Add order_items to Supabase Realtime publication
-- (This makes postgres_changes events fire for this table)
alter publication supabase_realtime add table order_items;
