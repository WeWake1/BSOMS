# Phase 1: Project Setup + Supabase Schema — Context

**Gathered:** 2026-03-18
**Status:** Ready for planning
**Source:** AGENTS.md spec (full project specification provided)

<domain>
## Phase Boundary

This phase delivers the foundational infrastructure:
- Next.js 14 (App Router) project with Tailwind CSS and TypeScript
- Supabase Postgres schema (orders, categories, profiles tables)
- Row Level Security policies for all tables
- Supabase Storage bucket `order-photos` with correct access policies
- Typed Supabase client in `/lib/supabase/`
- Environment variable scaffolding (`.env.local`, `.env.example`)
- README.md with setup SQL and first-admin instructions

Does NOT include: auth implementation, any UI pages, any data fetching logic
</domain>

<decisions>
## Implementation Decisions

### Framework & Tooling
- Next.js 14 with App Router (not Pages Router)
- TypeScript strict mode
- Tailwind CSS v3
- `npx create-next-app@latest` for initialization

### Supabase Schema (exact SQL)
```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Categories table
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamptz default now()
);

-- Orders table
create type order_status as enum ('Pending', 'In Progress', 'Packing', 'Dispatched');

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

-- Auto-create profile on user signup
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

### RLS Policies
```sql
-- Enable RLS on all tables
alter table orders enable row level security;
alter table categories enable row level security;
alter table profiles enable row level security;

-- Helper function to get role
create or replace function get_user_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer;

-- Orders: viewers can SELECT, admin full CRUD
create policy "Authenticated users can view orders" on orders
  for select using (auth.role() = 'authenticated');

create policy "Admin can insert orders" on orders
  for insert with check (get_user_role() = 'admin');

create policy "Admin can update orders" on orders
  for update using (get_user_role() = 'admin');

create policy "Admin can delete orders" on orders
  for delete using (get_user_role() = 'admin');

-- Categories: viewers can SELECT, admin full CRUD
create policy "Authenticated users can view categories" on categories
  for select using (auth.role() = 'authenticated');

create policy "Admin can insert categories" on categories
  for insert with check (get_user_role() = 'admin');

create policy "Admin can update categories" on categories
  for update using (get_user_role() = 'admin');

create policy "Admin can delete categories" on categories
  for delete using (get_user_role() = 'admin');

-- Profiles: all authenticated users SELECT only
create policy "Authenticated users can view profiles" on profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);
```

### Supabase Storage
- Bucket name: `order-photos`
- Public bucket: false (authenticated access only)
- Admin: can upload and delete
- All authenticated: can read/view (download)

### Typed Supabase Client
- Use `@supabase/supabase-js` v2
- Create browser client: `/lib/supabase/client.ts`
- Create server client (with cookies): `/lib/supabase/server.ts`
- Create middleware client: `/lib/supabase/middleware.ts`
- Database types file: `/types/database.ts` (manual types matching schema)

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Project Structure to Create
```
/app
  layout.tsx           Root layout
  globals.css          Global styles + Tailwind
/lib/supabase
  client.ts            Browser Supabase client
  server.ts            Server-side Supabase client
  middleware.ts        Auth middleware client
/types
  database.ts          TypeScript types for all tables
.env.local             (gitignored - user fills in)
.env.example           Template with all variable names
README.md              Setup instructions
```

### Claude's Discretion
- Tailwind config color tokens (set up for Impeccable phase later)
- Font configuration (placeholder, Impeccable will finalize)
- Component folder structure can be minimal stubs for now
</decisions>

<canonical_refs>
## Canonical References

Downstream agents MUST read these before planning or implementing.

### Project Spec
- `AGENTS.md` — Full project specification including schema, roles, stack decisions
- `.planning/PROJECT.md` — Project context summary
- `.planning/REQUIREMENTS.md` — Full requirements with REQ-IDs

### Phase 1 Scope
- Phase goal: AUTH-05, AUTH-06, AUTH-07 (RLS enforcement) are the requirements
- The delivered artifact is the working foundation, not any UI
</canonical_refs>

<specifics>
## Specific Ideas

- First admin user: sign up via app → manually set `role = 'admin'` in profiles table in Supabase dashboard. Document this in README.md.
- Supabase Realtime will be enabled on the `orders` table in Phase 3 — no need to handle now
- The `order_status` enum must match exactly: `'Pending' | 'In Progress' | 'Packing' | 'Dispatched'`
- Photo URL stored as text pointing to Supabase Storage path
</specifics>

<deferred>
## Deferred Ideas

- Supabase Realtime subscription — Phase 3
- Auth UI (/login page) — Phase 2
- Any UI components — Phase 3+
- 21st.dev component installation — Phase 3+
</deferred>

---

*Phase: 01-project-setup-supabase-schema*
*Context gathered: 2026-03-18 via AGENTS.md spec (fully specified project)*
