---
plan: 03
phase: 1
wave: 2
title: Set Up Typed Supabase Client and TypeScript Types
depends_on: [01]
files_modified:
  - lib/supabase/client.ts
  - lib/supabase/server.ts
  - lib/supabase/middleware.ts
  - types/database.ts
  - middleware.ts
autonomous: true
requirements_addressed: [AUTH-05, AUTH-06, AUTH-07]
---

# Plan 03: Set Up Typed Supabase Client and TypeScript Types

## Objective

Create the typed Supabase client files for browser, server, and middleware usage. Create TypeScript type definitions matching the database schema. Set up Next.js middleware for auth session refreshing.

## Context

<read_first>
- .planning/phases/01-project-setup-supabase-schema/01-CONTEXT.md (exact schema and types)
- AGENTS.md (database schema section)
</read_first>

## Tasks

### Task 3.1: Install Supabase Packages

<action>
Install the required Supabase packages:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Verify installation by checking `package.json` for both packages in dependencies.
</action>

<acceptance_criteria>
- `package.json` contains `"@supabase/supabase-js"` in dependencies
- `package.json` contains `"@supabase/ssr"` in dependencies
</acceptance_criteria>

---

### Task 3.2: Create TypeScript Database Types

<action>
Create `types/database.ts` with exact TypeScript types matching the Supabase schema:

```typescript
export type OrderStatus = 'Pending' | 'In Progress' | 'Packing' | 'Dispatched';

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  category_id: string;
  date: string;
  due_date: string;
  dispatch_date: string | null;
  length: number | null;
  width: number | null;
  qty: number;
  description: string | null;
  photo_url: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface OrderWithCategory extends Order {
  categories: Category | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: 'admin' | 'viewer';
}

export type Database = {
  public: {
    Tables: {
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Order, 'id' | 'created_at'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Category, 'id' | 'created_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Profile;
        Update: Partial<Profile>;
      };
    };
    Enums: {
      order_status: OrderStatus;
    };
  };
};
```
</action>

<acceptance_criteria>
- `types/database.ts` exists
- `types/database.ts` contains `OrderStatus` type with all 4 status values
- `types/database.ts` contains `Order` interface with all fields from schema
- `types/database.ts` contains `Profile` interface with `role: 'admin' | 'viewer'`
- `types/database.ts` contains `Database` type with `Tables` for orders, categories, profiles
</acceptance_criteria>

---

### Task 3.3: Create Browser Supabase Client

<action>
Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```
</action>

<acceptance_criteria>
- `lib/supabase/client.ts` exists
- `lib/supabase/client.ts` contains `createBrowserClient`
- `lib/supabase/client.ts` imports `Database` from `@/types/database`
- `lib/supabase/client.ts` exports `createClient` function
</acceptance_criteria>

---

### Task 3.4: Create Server Supabase Client

<action>
Create `lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — cookies can't be set, handled by middleware
          }
        },
      },
    }
  );
}

// Service role client for admin operations (server-side only)
export function createServiceClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
```
</action>

<acceptance_criteria>
- `lib/supabase/server.ts` exists
- `lib/supabase/server.ts` contains `createServerClient` from `@supabase/ssr`
- `lib/supabase/server.ts` exports `createClient` async function
- `lib/supabase/server.ts` exports `createServiceClient` function using `SUPABASE_SERVICE_ROLE_KEY`
</acceptance_criteria>

---

### Task 3.5: Create Middleware Supabase Client and Next.js Middleware

<action>
Create `lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/database';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must not contain app logic
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

Create `middleware.ts` in the project root:

```typescript
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```
</action>

<acceptance_criteria>
- `lib/supabase/middleware.ts` exists
- `lib/supabase/middleware.ts` exports `updateSession` function
- `middleware.ts` exists in project root
- `middleware.ts` imports `updateSession` from `@/lib/supabase/middleware`
- `middleware.ts` exports `config` with `matcher` pattern
</acceptance_criteria>

---

### Task 3.6: Create Shared Helper Utilities

<action>
Create `lib/utils.ts` with shared utilities:

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'Pending': 'bg-amber-100 text-amber-800 border-amber-200',
    'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
    'Packing': 'bg-purple-100 text-purple-800 border-purple-200',
    'Dispatched': 'bg-green-100 text-green-800 border-green-200',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-800 border-gray-200';
}
```

Install required peer dependencies:
```bash
npm install clsx tailwind-merge
```
</action>

<acceptance_criteria>
- `lib/utils.ts` exists
- `lib/utils.ts` exports `cn` function using `clsx` and `twMerge`
- `lib/utils.ts` exports `formatDate` function
- `lib/utils.ts` exports `getStatusColor` with all 4 status strings mapped
- `package.json` contains `"clsx"` in dependencies
- `package.json` contains `"tailwind-merge"` in dependencies
</acceptance_criteria>

## Verification

```bash
# TypeScript compilation check
npx tsc --noEmit

# Verify all client files exist
ls lib/supabase/client.ts lib/supabase/server.ts lib/supabase/middleware.ts middleware.ts types/database.ts lib/utils.ts

# Verify npm run dev still works
npm run dev
```

## must_haves

- [ ] `types/database.ts` defines all OrderFlow types (Order, Category, Profile, Database)
- [ ] Browser, server, and middleware Supabase clients exist with `<Database>` generic
- [ ] Next.js `middleware.ts` in project root to refresh sessions
- [ ] `lib/utils.ts` with `cn`, `formatDate`, `getStatusColor` utilities
- [ ] TypeScript compiles without errors
