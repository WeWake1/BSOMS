---
plan: 02
phase: 1
wave: 2
title: Configure Supabase — Schema, RLS, and Storage
depends_on: [01]
files_modified:
  - README.md
autonomous: true
requirements_addressed: [AUTH-05, AUTH-06, AUTH-07]
---

# Plan 02: Configure Supabase — Schema, RLS, and Storage

## Objective

Create the Supabase SQL schema, enable Row Level Security, set up the `order-photos` Storage bucket, and add a trigger for auto-creating viewer profiles. This lives outside the codebase (Supabase dashboard SQL editor), but the SQL must be documented in README.md for reproducibility.

## Context

<read_first>
- .planning/phases/01-project-setup-supabase-schema/01-CONTEXT.md (exact SQL defined here)
- AGENTS.md (schema section)
- .planning/REQUIREMENTS.md (AUTH-05, AUTH-06, AUTH-07)
</read_first>

## Tasks

### Task 2.1: Document Supabase Setup SQL in README.md

<action>
Create `README.md` in the project root with complete setup instructions:

```markdown
# OrderFlow

Internal order management system for manufacturing/fulfillment.

## Tech Stack
- Next.js 14 (App Router)
- Supabase (Postgres + Auth + Storage + Realtime)
- Tailwind CSS
- TypeScript

## Quick Start

### 1. Clone & Install
\`\`\`bash
git clone <repo>
cd orderflow
npm install
\`\`\`

### 2. Supabase Setup

#### Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key from **Settings > API**

#### Run Schema SQL
Open **SQL Editor** in your Supabase dashboard and run the following:

\`\`\`sql
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

-- Profiles table
create table profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  role text not null check (role in ('admin', 'viewer'))
);

-- Auto-update updated_at trigger
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
\`\`\`

#### Enable RLS and Add Policies
Still in SQL Editor, run:

\`\`\`sql
-- Enable RLS
alter table orders enable row level security;
alter table categories enable row level security;
alter table profiles enable row level security;

-- Helper to get user role
create or replace function get_user_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer;

-- Orders policies
create policy "Authenticated users can view orders" on orders
  for select using (auth.role() = 'authenticated');

create policy "Admin can insert orders" on orders
  for insert with check (get_user_role() = 'admin');

create policy "Admin can update orders" on orders
  for update using (get_user_role() = 'admin');

create policy "Admin can delete orders" on orders
  for delete using (get_user_role() = 'admin');

-- Categories policies
create policy "Authenticated users can view categories" on categories
  for select using (auth.role() = 'authenticated');

create policy "Admin can insert categories" on categories
  for insert with check (get_user_role() = 'admin');

create policy "Admin can update categories" on categories
  for update using (get_user_role() = 'admin');

create policy "Admin can delete categories" on categories
  for delete using (get_user_role() = 'admin');

-- Profiles policies
create policy "Authenticated users can view profiles" on profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);
\`\`\`

#### Create Storage Bucket
1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**
3. Name: `order-photos`
4. Public: **OFF** (private bucket)
5. Click **Save**

Then add storage policies via SQL Editor:

\`\`\`sql
-- Allow authenticated users to read photos
create policy "Authenticated users can view photos"
  on storage.objects for select
  using (bucket_id = 'order-photos' and auth.role() = 'authenticated');

-- Allow admin to upload photos
create policy "Admin can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'order-photos' and (select role from profiles where id = auth.uid()) = 'admin');

-- Allow admin to delete photos
create policy "Admin can delete photos"
  on storage.objects for delete
  using (bucket_id = 'order-photos' and (select role from profiles where id = auth.uid()) = 'admin');
\`\`\`

#### Enable Realtime (for Phase 3)
1. Go to **Database > Replication** in Supabase dashboard
2. Under "Source", enable the `orders` table
3. Or via SQL: \`alter table orders replica identity full;\`

### 3. Environment Variables
Copy `.env.example` to `.env.local` and fill in your values:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Fill in from Supabase **Settings > API**:
- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (keep secret!)

### 4. Run Development Server
\`\`\`bash
npm run dev
# Open http://localhost:3000
\`\`\`

### 5. Create First Admin User

1. Open the app at `localhost:3000/login`
2. Sign up with your email and password
3. Go to **Supabase Dashboard > Table Editor > profiles**
4. Find your user row and change `role` from `'viewer'` to `'admin'`
5. The user now has admin access

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key for client-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server-side only) |

## Deployment to Vercel

1. Push to GitHub
2. Import repo in [vercel.com](https://vercel.com)
3. Add all 3 environment variables in Vercel project settings
4. Deploy — Vercel auto-deploys on push to main
```

Write this complete content to `README.md`.
</action>

<acceptance_criteria>
- `README.md` exists in project root
- `README.md` contains `## Run Schema SQL` section
- `README.md` contains the `create table orders` SQL
- `README.md` contains `alter table orders enable row level security`
- `README.md` contains `order-photos` bucket creation instructions
- `README.md` contains `## Create First Admin User` section with manual role-setting instructions
- `README.md` contains `## Deployment to Vercel` section
</acceptance_criteria>

## Verification

```bash
# Verify README exists and has key sections
grep -l "order-photos\|Create First Admin\|row level security" README.md
# Should return: README.md
```

## must_haves

- [ ] Complete SQL schema documented in README.md (orders, categories, profiles tables)
- [ ] All RLS policies documented with exact SQL
- [ ] Storage bucket setup documented
- [ ] First-admin instructions are clear and correct
- [ ] Vercel deployment steps documented
