ORDER MANAGEMENT SYSTEM

# OrderFlow

Internal order management system for manufacturing/fulfillment companies. Enables ~10 team members to track real-time order status from their phones.

## Tech Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime)
- **Hosting:** Vercel
- **Components:** 21st.dev (shadcn-compatible)

## Quick Start

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd BhaktiSales
npm install
```

### 2. Supabase Setup

#### Create Supabase Project
1. Go to [supabase.com](https://supabase.com) → **New project**
2. Note your project URL and anon key from **Settings → API**

#### Run Schema SQL
Open **SQL Editor** in Supabase dashboard and run:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Categories table
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

-- Order status enum
create type order_status as enum ('Pending', 'In Progress', 'Packing', 'Dispatched');

-- Orders table
create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_no text unique not null,
  customer_name text not null,
  category_id uuid references categories(id) not null,
  date date not null,
  due_date date not null,
  dispatch_date date,
  length numeric,
  width numeric,
  qty integer not null,
  description text,
  photo_url text,
  audio_url text,
  status order_status not null default 'Pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Profiles table (role management)
-- Three role tiers:
--   admin  — full CRUD on orders + categories, sees Activity Log
--   staff  — read everything, change order status only (via update_order_status RPC)
--   viewer — read-only
create table profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  role text not null check (role in ('admin', 'viewer', 'staff'))
);

-- Order items table (sub-orders within a single order)
create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade not null,
  item_label text,
  date date not null,
  due_date date not null,
  dispatch_date date,
  length numeric,
  width numeric,
  qty integer not null default 1,
  description text,
  photo_url text,
  audio_url text,
  created_at timestamptz default now()
);

-- Auto-update timestamp trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at
  before update on orders
  for each row execute function update_updated_at();

-- Auto-create profile on user signup (defaults to viewer)
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'viewer');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

#### Grant Data API Access
> Required as of Supabase's Oct 30, 2026 change — new tables in `public` are no longer auto-exposed to the Data API. RLS policies don't run unless the table-level GRANTs exist first.

OrderFlow is auth-only (no anonymous access), so we grant to `authenticated` and `service_role` only. RLS policies below further restrict writes to admins.

```sql
-- Grant table access to authenticated users (RLS restricts writes to admins)
grant select, insert, update, delete on categories    to authenticated;
grant select, insert, update, delete on orders        to authenticated;
grant select, insert, update, delete on order_items   to authenticated;
grant select, update                  on profiles     to authenticated;

-- Service role bypasses RLS (used by server-side code with the service key)
grant all on categories, orders, order_items, profiles to service_role;
```

#### Enable Row Level Security (RLS)
Still in SQL Editor, run:

```sql
-- Enable RLS on all tables
alter table orders enable row level security;
alter table categories enable row level security;
alter table profiles enable row level security;

-- Helper function to get current user's role
create or replace function get_user_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer;

-- Orders: SELECT for all authenticated, full CRUD for admin
create policy "Authenticated users can view orders" on orders
  for select using (auth.role() = 'authenticated');

create policy "Admin can insert orders" on orders
  for insert with check (get_user_role() = 'admin');

create policy "Admin can update orders" on orders
  for update using (get_user_role() = 'admin');

create policy "Admin can delete orders" on orders
  for delete using (get_user_role() = 'admin');

-- Categories: SELECT for all authenticated, full CRUD for admin
create policy "Authenticated users can view categories" on categories
  for select using (auth.role() = 'authenticated');

create policy "Admin can insert categories" on categories
  for insert with check (get_user_role() = 'admin');

create policy "Admin can update categories" on categories
  for update using (get_user_role() = 'admin');

create policy "Admin can delete categories" on categories
  for delete using (get_user_role() = 'admin');

-- Order items (sub-orders): SELECT for all authenticated, full CRUD for admin
alter table order_items enable row level security;

create policy "Authenticated users can view order items" on order_items
  for select using (auth.role() = 'authenticated');

create policy "Admin can insert order items" on order_items
  for insert with check (get_user_role() = 'admin');

create policy "Admin can update order items" on order_items
  for update using (get_user_role() = 'admin');

create policy "Admin can delete order items" on order_items
  for delete using (get_user_role() = 'admin');

-- Profiles: SELECT for all authenticated, users can update own
create policy "Authenticated users can view profiles" on profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);
```

#### Create Storage Bucket
1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**, name it: `order-photos`, set **Public: OFF**
3. Add storage policies via SQL Editor:

```sql
-- Authenticated users can view (download) photos
create policy "Authenticated users can view photos"
  on storage.objects for select
  using (bucket_id = 'order-photos' and auth.role() = 'authenticated');

-- Admin can upload photos
create policy "Admin can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'order-photos' and get_user_role() = 'admin');

-- Admin can delete photos
create policy "Admin can delete photos"
  on storage.objects for delete
  using (bucket_id = 'order-photos' and get_user_role() = 'admin');

-- Audio storage policies (Bucket: order-audio)
create policy "Authenticated users can view audio"
  on storage.objects for select
  using (bucket_id = 'order-audio' and auth.role() = 'authenticated');

create policy "Admin can upload audio"
  on storage.objects for insert
  with check (bucket_id = 'order-audio' and get_user_role() = 'admin');

create policy "Admin can delete audio"
  on storage.objects for delete
  using (bucket_id = 'order-audio' and get_user_role() = 'admin');
```

#### Enable Realtime
Go to **Database → Replication** and enable the `orders` and `order_items` tables. Or via SQL:
```sql
alter table orders replica identity full;
alter table order_items replica identity full;
```

### 3. Configure Environment Variables
```bash
cp .env.example .env.local
```

Fill in from **Supabase → Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (**server-side only — keep secret!**)

### 4. Run Development Server
```bash
npm run dev
# Open http://localhost:3000
```

## Roles

| Role     | Capabilities |
|----------|---|
| `admin`  | Full CRUD on orders + categories. Sees the Activity Log under Settings. |
| `staff`  | Read-only on everything **except** order status — they can change status (and dispatch date when marking Dispatched). Cannot create, edit, or delete orders. |
| `viewer` | Read-only. |

Staff status changes route through the `update_order_status(uuid, order_status, date)` RPC. Admin updates use direct UPDATE (RLS allows it). Both paths are caught by the same DB trigger and logged to `order_activity_logs`.

## Promoting Users

> ⚠️ New signups default to `viewer` role. You must manually promote.

1. User signs up via the app at `localhost:3000/login`
2. Go to **Supabase Dashboard → Table Editor → profiles**
3. Find the user row, click edit, change `role` to one of:
   - `admin` — full access + Activity Log
   - `staff` — can only change order status
   - `viewer` — read-only (default)

## Activity Log

Every order create, status change, and delete is logged to `order_activity_logs`. The log is admin-only and viewable at `/logs` (entry point: Settings drawer → Activity Log). A per-order timeline is also available inside each order's detail sheet for admins.

The log table denormalizes the order number, customer name, actor name, and role at the moment of the event — so entries stay readable even if the order or user is later deleted.

See `supabase/migration_staff_role_audit.sql` for the schema, RPC, triggers, and RLS policies that ship the staff role + audit log together.

## Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Full access key (never expose to client) |

## Deployment to Vercel

1. Push repository to GitHub
2. Import repo at [vercel.com](https://vercel.com) → **New Project**
3. Add all 3 environment variables in **Vercel → Project → Settings → Environment Variables**
4. Deploy — Vercel auto-deploys on every push to `main`

## Project Structure

```
app/
  (auth)/         Login/auth pages
  (dashboard)/    Main dashboard
components/
  ui/             21st.dev + base UI components
lib/
  supabase/       Client, server, middleware clients
  supabase/queries/ Typed DB queries per entity
  utils.ts        Shared utilities
hooks/            Custom React hooks
types/
  database.ts     TypeScript types matching Supabase schema
```
