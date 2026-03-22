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
  status order_status not null default 'Pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Profiles table (role management)
create table profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  role text not null check (role in ('admin', 'viewer'))
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
```

#### Enable Realtime
Go to **Database → Replication** and enable the `orders` table. Or via SQL:
```sql
alter table orders replica identity full;
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

## Creating the First Admin User

> ⚠️ New signups default to `viewer` role. You must manually promote the first admin.

1. Open the app at `localhost:3000/login`
2. Sign up with your admin email and password
3. Go to **Supabase Dashboard → Table Editor → profiles**
4. Find your user row, click edit, change `role` from `viewer` to `admin`
5. ✅ You now have admin access — all subsequent features (CRUD, categories, etc.) unlocked

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
