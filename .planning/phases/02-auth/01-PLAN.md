---
plan: 01
phase: 2
wave: 1
title: Auth Helpers and Route Protection
depends_on: []
files_modified:
  - lib/auth.ts
  - app/(dashboard)/layout.tsx
  - middleware.ts
autonomous: true
requirements_addressed: [AUTH-05, AUTH-06, AUTH-07]
---

# Plan 01: Auth Helpers and Route Protection

## Objective

Create server-side auth helpers that check user session and role, update middleware for auth redirects, and create the protected dashboard layout that requires authentication.

## Context

<read_first>
- .planning/phases/02-auth/02-CONTEXT.md
- lib/supabase/server.ts
- lib/supabase/middleware.ts
- middleware.ts
- types/database.ts
</read_first>

## Tasks

### Task 1.1: Create Auth Helper (`lib/auth.ts`)

<action>
Create `lib/auth.ts` with typed auth utilities:

```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';

export interface AuthUser {
  id: string;
  email: string | undefined;
  profile: Profile;
}

/**
 * Get the current authenticated user with their profile/role.
 * Returns null if not authenticated.
 */
export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) return null;

  return {
    id: user.id,
    email: user.email,
    profile,
  };
}

/**
 * Require authentication. Redirects to /login if not authenticated.
 * Returns AuthUser.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Require admin role. Redirects to /dashboard if authenticated but not admin.
 * Redirects to /login if not authenticated at all.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.profile.role !== 'admin') redirect('/dashboard');
  return user;
}

/**
 * Redirect to dashboard if already authenticated (for login page).
 */
export async function redirectIfAuthenticated(): Promise<void> {
  const user = await getUser();
  if (user) redirect('/dashboard');
}
```
</action>

<acceptance_criteria>
- `lib/auth.ts` exists
- `lib/auth.ts` exports `getUser`, `requireAuth`, `requireAdmin`, `redirectIfAuthenticated`
- `lib/auth.ts` imports `createClient` from `@/lib/supabase/server`
- `lib/auth.ts` exports `AuthUser` interface with `profile: Profile`
</acceptance_criteria>

---

### Task 1.2: Update Middleware for Auth Redirects

<action>
Update `middleware.ts` to handle auth redirects inline (redirect unauthenticated users away from protected routes, and authenticated users away from login):

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

const PROTECTED_ROUTES = ['/dashboard'];
const AUTH_ROUTES = ['/login'];

export async function middleware(request: NextRequest) {
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

  // IMPORTANT: Do not add any logic between createServerClient and getUser
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Redirect unauthenticated users away from protected routes
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login page
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```
</action>

<acceptance_criteria>
- `middleware.ts` contains `PROTECTED_ROUTES = ['/dashboard']`
- `middleware.ts` contains `AUTH_ROUTES = ['/login']`
- `middleware.ts` redirects unauthenticated users to `/login` when accessing `/dashboard`
- `middleware.ts` redirects authenticated users to `/dashboard` when accessing `/login`
- `middleware.ts` still calls `supabase.auth.getUser()` for session refresh
</acceptance_criteria>

---

### Task 1.3: Create Protected Dashboard Layout

<action>
Create `app/(dashboard)/layout.tsx` — server component that requires auth:

```typescript
import { requireAuth } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check — redirects to /login if not authenticated
  await requireAuth();

  return (
    <div className="min-h-dvh bg-gray-50">
      {children}
    </div>
  );
}
```

Create `app/(dashboard)/dashboard/page.tsx` as a placeholder (Phase 3 will fill this in):

```typescript
import { requireAuth } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="flex items-center justify-center min-h-dvh">
      <p className="text-gray-500">
        Welcome {user.email} ({user.profile.role}) — Dashboard coming in Phase 3
      </p>
    </div>
  );
}
```

Update `app/page.tsx` to redirect to dashboard:
```typescript
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/dashboard');
}
```
</action>

<acceptance_criteria>
- `app/(dashboard)/layout.tsx` exists and calls `requireAuth()`
- `app/(dashboard)/dashboard/page.tsx` exists
- `app/page.tsx` redirects to `/dashboard`
</acceptance_criteria>

## must_haves

- [ ] `lib/auth.ts` with `getUser`, `requireAuth`, `requireAdmin`, `redirectIfAuthenticated`
- [ ] Middleware redirects unauthenticated → /login, authenticated on /login → /dashboard
- [ ] Dashboard layout server-side protected with `requireAuth()`
