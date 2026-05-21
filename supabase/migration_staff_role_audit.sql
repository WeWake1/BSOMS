-- ════════════════════════════════════════════════════════════════════════
-- migration_staff_role_audit.sql
--
-- Adds:
--   1. New 'staff' role (status-change-only tier between admin and viewer)
--   2. update_order_status RPC — the single status-change path for staff
--   3. order_activity_logs table — tracks order create / status change / delete
--   4. Triggers that auto-populate the log on every orders insert/update/delete
--   5. RLS so only admins can read the log
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Loosen the role CHECK to allow 'staff' ─────────────────────────
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'viewer', 'staff'));


-- ─── 2. RPC: staff/admin can change status via this single function ────
--   Accepts optional dispatch_date so the dispatch flow stays atomic.
--   When new_status='Dispatched' use the provided date (or today);
--   otherwise clear dispatch_date.
-- Drop any earlier 2-arg version to avoid Postgres function overloading
-- (CREATE OR REPLACE only matches identical signatures).
drop function if exists update_order_status(uuid, order_status);
create or replace function update_order_status(
  p_order_id uuid,
  p_new_status order_status,
  p_dispatch_date date default null
) returns orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_row  public.orders;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role not in ('admin','staff') then
    raise exception 'Not authorised to change order status';
  end if;

  update public.orders
     set status = p_new_status,
         dispatch_date = case
           when p_new_status = 'Dispatched' then coalesce(p_dispatch_date, current_date)
           else null
         end,
         updated_at = now()
   where id = p_order_id
   returning * into v_row;

  if v_row.id is null then
    raise exception 'Order % not found', p_order_id;
  end if;

  return v_row;
end
$$;

grant execute on function update_order_status(uuid, order_status, date) to authenticated;


-- ─── 3. Activity log table (snapshot-only — no live FKs) ───────────────
do $$ begin
  create type order_event_type as enum ('created', 'status_changed', 'deleted');
exception
  when duplicate_object then null;
end $$;

create table if not exists order_activity_logs (
  id              uuid primary key default gen_random_uuid(),
  event_type      order_event_type not null,
  order_id        uuid,                  -- not an FK; survives order deletion
  order_no        text,                  -- snapshot
  customer_name   text,                  -- snapshot
  from_status     order_status,          -- null for 'created'
  to_status       order_status,          -- null for 'deleted'
  changed_by      uuid,                  -- not an FK; survives user deletion
  changed_by_name text,                  -- snapshot
  changed_by_role text,                  -- snapshot
  changed_at      timestamptz not null default now()
);

create index if not exists idx_activity_logs_changed_at
  on order_activity_logs (changed_at desc);
create index if not exists idx_activity_logs_order
  on order_activity_logs (order_id, changed_at desc);
create index if not exists idx_activity_logs_actor
  on order_activity_logs (changed_by);


-- ─── 4. Trigger function shared by all three events ────────────────────
create or replace function log_order_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_name  text;
  v_role  text;
begin
  select full_name, role into v_name, v_role
    from public.profiles where id = v_actor;

  if tg_op = 'INSERT' then
    insert into public.order_activity_logs
      (event_type, order_id, order_no, customer_name, to_status,
       changed_by, changed_by_name, changed_by_role)
    values
      ('created', new.id, new.order_no, new.customer_name, new.status,
       v_actor, coalesce(v_name, 'system'), coalesce(v_role, 'system'));
    return new;

  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.order_activity_logs
        (event_type, order_id, order_no, customer_name,
         from_status, to_status,
         changed_by, changed_by_name, changed_by_role)
      values
        ('status_changed', new.id, new.order_no, new.customer_name,
         old.status, new.status,
         v_actor, coalesce(v_name, 'system'), coalesce(v_role, 'system'));
    end if;
    return new;

  elsif tg_op = 'DELETE' then
    insert into public.order_activity_logs
      (event_type, order_id, order_no, customer_name, from_status,
       changed_by, changed_by_name, changed_by_role)
    values
      ('deleted', old.id, old.order_no, old.customer_name, old.status,
       v_actor, coalesce(v_name, 'system'), coalesce(v_role, 'system'));
    return old;
  end if;
end
$$;

drop trigger if exists trg_orders_log_insert on orders;
create trigger trg_orders_log_insert
  after insert on orders
  for each row execute function log_order_activity();

drop trigger if exists trg_orders_log_update on orders;
create trigger trg_orders_log_update
  after update of status on orders
  for each row execute function log_order_activity();

drop trigger if exists trg_orders_log_delete on orders;
create trigger trg_orders_log_delete
  after delete on orders
  for each row execute function log_order_activity();

-- Trigger functions should not be callable as RPCs. Postgres grants
-- EXECUTE to PUBLIC by default; revoke so /rest/v1/rpc/log_order_activity
-- isn't reachable.
revoke execute on function log_order_activity() from public, anon, authenticated;


-- ─── 5. Table GRANTs + RLS (admin SELECT only; only the trigger writes) ─
grant select on order_activity_logs to authenticated;
grant all    on order_activity_logs to service_role;

alter table order_activity_logs enable row level security;

drop policy if exists "Only admin can view activity logs" on order_activity_logs;
create policy "Only admin can view activity logs" on order_activity_logs
  for select using (get_user_role() = 'admin');
-- No insert/update/delete policies → only the SECURITY DEFINER trigger
-- function (which runs as the function owner, bypassing RLS) can write.
