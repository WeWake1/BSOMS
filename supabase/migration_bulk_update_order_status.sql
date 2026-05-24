-- ════════════════════════════════════════════════════════════════════════
-- migration_bulk_update_order_status.sql
--
-- Bulk variant of update_order_status. Lets staff/admin flip status on
-- many orders in a single round-trip from the multi-select action bar.
-- Same dispatch_date semantics as the single-row RPC:
--   * to_status='Dispatched' → use provided date, else current_date
--   * any other status       → clear dispatch_date
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.bulk_update_order_status(
  p_order_ids   uuid[],
  p_new_status  order_status,
  p_dispatch_date date default null
) returns setof public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role not in ('admin','staff') then
    raise exception 'Not authorised to change order status';
  end if;

  return query
  update public.orders
     set status = p_new_status,
         dispatch_date = case
           when p_new_status = 'Dispatched' then coalesce(p_dispatch_date, current_date)
           else null
         end,
         updated_at = now()
   where id = any(p_order_ids)
   returning *;
end
$$;

grant execute on function public.bulk_update_order_status(uuid[], order_status, date) to authenticated;
