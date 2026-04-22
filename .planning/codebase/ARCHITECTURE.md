# Architecture

## Pattern: Server-Client Hybrid (Next.js App Router)

OrderFlow follows the Next.js 14 App Router pattern where server components handle authentication and data fetching, while client components manage interactivity and realtime subscriptions.

```
Request → Middleware (session refresh, route guards)
       → Server Component (auth check, user profile)
       → Client Component (realtime data, UI interactions)
```

## Layers

### 1. Middleware Layer (`middleware.ts`)
- Intercepts ALL requests (except static assets).
- Refreshes Supabase auth session cookies.
- Redirects unauthenticated users away from `/dashboard`.
- Redirects authenticated users away from `/login`.
- Does NOT check roles — that's handled by the auth helpers.

### 2. Auth Layer (`lib/auth.ts`)
- Server-side only.
- `getUser()` — fetches auth user + profile. Uses service client to bypass RLS for profile lookup.
- `requireAuth()` — redirects to `/login` if unauthenticated. Used in dashboard layout.
- `requireAdmin()` — redirects to `/dashboard` if not admin role.
- `redirectIfAuthenticated()` — for login page (currently unused, middleware handles this).

### 3. Server Component Layer (Pages + Layouts)
- `app/(dashboard)/layout.tsx` — calls `requireAuth()`, renders children.
- `app/(dashboard)/dashboard/page.tsx` — calls `requireAuth()`, passes `user` to `DashboardClient`.
- `app/(auth)/login/page.tsx` — client component with server action for sign-in.

### 4. Client Component Layer (Dashboard + Forms)
- `DashboardClient.tsx` — **THE main component** (456 lines). Orchestrates:
  - Realtime order data via `useOrders()` hook
  - Filter/sort/search state
  - Export functionality (PDF + PNG)
  - Status change mutations
  - Dispatch date prompt modal
  - Settings drawer, order detail sheet, order form sheet
- All mutations go directly through Supabase client (no API routes or server actions for order CRUD).

### 5. Data Layer (`hooks/useOrders.ts`)
- Single hook managing all order + category data.
- Initial fetch: `orders` with `categories(*)` join, `categories` standalone.
- Realtime: Two Supabase channels for live updates.
- Visual feedback: `flashIds` (update animation) and `newIds` (insert animation) tracked with timers.

## Data Flow

### Read Path
```
useOrders() → supabase.from('orders').select('*, categories(*)') → setOrders()
           → supabase.channel('public:orders').subscribe() → live updates
```

### Write Path (Admin only)
```
DashboardClient → supabase.from('orders').update() → Realtime triggers → useOrders updates state
OrderFormSheet  → supabase.from('orders').insert/update() → Realtime triggers → useOrders updates state
OrderDetailSheet → supabase.from('orders').delete() → Realtime triggers → useOrders updates state
```

No API routes or server actions are used for order/category CRUD — all mutations happen via the browser Supabase client, and RLS enforces permissions.

### Auth Flow
```
Login page → Server Action (signIn) → supabase.auth.signInWithPassword()
          → Cookie set → Redirect to /dashboard
          → Middleware refreshes cookie on each request
```

## Key Architectural Decisions

1. **No API routes for CRUD** — Relies entirely on Supabase RLS + client-side mutations. Simplifies architecture but means all business logic is in client components.

2. **Service role client for profile fetch** — `lib/auth.ts` uses service role key to bypass RLS when reading profiles. This ensures auth checks never fail due to missing RLS policies on the profiles table.

3. **Single monolithic hook** — `useOrders()` manages all data (orders, categories, realtime, animations). Everything re-renders together.

4. **Bottom sheets over page navigation** — Detail views and forms use a `Drawer` component instead of separate routes. No URL changes for detail/edit views.

5. **Client-side dark mode** — Toggled via `html.dark` class and `localStorage`. Not SSR-aware (may flash on initial load).

6. **Off-screen DOM for PNG export** — A hidden table is rendered off-screen and captured via `html-to-image` for the PNG export feature.

## Component Hierarchy

```
RootLayout (server — font, toaster)
├── AuthLayout (server — gradient background)
│   ├── LoginPage (client — login form)
│   └── UnauthorizedPage (server — error display)
└── DashboardLayout (server — requireAuth)
    └── DashboardPage (server — passes user)
        └── DashboardClient (client — THE app)
            ├── StatusCards
            ├── FilterBar
            ├── OrderCard / OrderListItem (×N)
            ├── OrderDetailSheet (Drawer)
            ├── OrderFormSheet (Drawer)
            ├── SettingsDrawer (Drawer)
            ├── Dispatch Date Modal
            └── Off-screen Export Table
```
