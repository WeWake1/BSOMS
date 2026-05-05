// All functions accept the Supabase client (browser or server) and run
// read-only queries through RLS — the user's session determines access.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function getOrdersSummary(client: DB) {
  const { data, error } = await client.from('orders').select('status');
  if (error) throw new Error(error.message);
  const totals: Record<string, number> = { Pending: 0, 'In Progress': 0, Packing: 0, Dispatched: 0 };
  for (const o of data) totals[o.status] = (totals[o.status] ?? 0) + 1;
  return totals;
}

export async function getOrdersByStatus(client: DB, status: string) {
  const { data, error } = await client
    .from('orders')
    .select('order_no, customer_name, status, due_date, qty, categories(name)')
    .eq('status', status)
    .order('due_date', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function getOrdersByCustomer(client: DB, customer_name: string) {
  const { data, error } = await client
    .from('orders')
    .select('order_no, customer_name, status, due_date, qty, categories(name)')
    .ilike('customer_name', `%${customer_name}%`)
    .order('due_date', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function getOrdersByCategory(client: DB, category_name: string) {
  const { data: cats, error: catErr } = await client
    .from('categories')
    .select('id')
    .ilike('name', `%${category_name}%`);
  if (catErr) throw new Error(catErr.message);
  if (!cats?.length) return [];
  const { data, error } = await client
    .from('orders')
    .select('order_no, customer_name, status, due_date, qty, categories(name)')
    .in('category_id', cats.map((c: any) => c.id))
    .order('due_date', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function getOverdueOrders(client: DB) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await client
    .from('orders')
    .select('order_no, customer_name, status, due_date, qty, categories(name)')
    .lt('due_date', today)
    .neq('status', 'Dispatched')
    .order('due_date', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function getOrdersDueSoon(client: DB, days: number) {
  const today = new Date();
  const future = new Date(today);
  future.setDate(future.getDate() + days);
  const { data, error } = await client
    .from('orders')
    .select('order_no, customer_name, status, due_date, qty, categories(name)')
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', future.toISOString().split('T')[0])
    .neq('status', 'Dispatched')
    .order('due_date', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function getOrderDetail(client: DB, order_no: string) {
  const { data, error } = await client
    .from('orders')
    .select('*, categories(name)')
    .eq('order_no', order_no)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getDispatchSummary(client: DB, start_date: string, end_date: string) {
  const { data, error } = await client
    .from('orders')
    .select('id, qty, dispatch_date')
    .eq('status', 'Dispatched')
    .gte('dispatch_date', start_date)
    .lte('dispatch_date', end_date);
  if (error) throw new Error(error.message);
  return {
    count: data.length,
    total_qty: data.reduce((s: number, o: any) => s + (o.qty || 0), 0),
    start_date,
    end_date,
  };
}
