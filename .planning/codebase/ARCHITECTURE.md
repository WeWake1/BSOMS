# Architecture

## Pattern

**Hybrid SSR/CSR with BaaS (Backend-as-a-Service)**

The app follows Next.js 14 App Router conventions:
- **Server-side:** Route protection, auth verification, profile fetching
- **Client-side:** Dashboard rendering, realtime subscriptions, form interactions
- **Backend:** Supabase handles all data persistence, auth, storage, and realtime — no custom API routes

## Layered Architecture

```
┌─────────────────────────────────────────────┐
│  Next.js Middleware (route protection)       │
├─────────────────────────────────────────────┤
│  Server Components (auth gates, metadata)    │
│  ├── app/(auth)/login/page.tsx  (client)     │
│  ├── app/(dashboard)/dashboard/page.tsx (srv)│
│  └── Layout wrappers (auth checks)          │
├─────────────────────────────────────────────┤
│  Client Components (interactive UI)          │
│  ├── DashboardClient.tsx  (main orchestrator)│
│  ├── Dashboard components (cards, forms...)  │
│  └── UI primitives (Button, Input, Drawer...) │
├─────────────────────────────────────────────┤
│  Custom Hooks (data + realtime)              │
│  └── useOrders.ts (fetch + subscribe)        │
├─────────────────────────────────────────────┤
│  Library Layer (auth, utils, export)         │
│  ├── lib/auth.ts (getUser, requireAuth)      │
│  ├── lib/utils.ts (formatting, status colors)│
│  ├── lib/pdf-export.ts (jsPDF report)        │
│  └── lib/category-colors.ts (color system)   │
├─────────────────────────────────────────────┤
│  Supabase Client Layer                       │
│  ├── lib/supabase/client.ts (browser)        │
│  ├── lib/supabase/server.ts (SSR + service)  │
│  └── lib/supabase/middleware.ts (session)     │
├─────────────────────────────────────────────┤
│  Supabase (Postgres, Auth, Storage, Realtime)│
└─────────────────────────────────────────────┘
```

## Data Flow

### Initial Load
1. User navigates to `/dashboard`
2. `middleware.ts` intercepts → creates Supabase client from cookies → `getUser()` → redirects if unauthenticated
3. `(dashboard)/layout.tsx` calls `requireAuth()` server-side
4. `(dashboard)/dashboard/page.tsx` calls `requireAuth()` → passes `AuthUser` to `DashboardClient`
5. `DashboardClient` renders, `useOrders()` hook fires:
   - Fetches categories via `supabase.from('categories')`
   - Fetches orders with join via `supabase.from('orders').select('*, categories(*)')`
   - Subscribes to Realtime channels

### Realtime Updates
1. Any client writes to `orders` or `categories` table
2. Supabase Realtime broadcasts postgres_changes event
3. `useOrders` channel callback fires:
   - INSERT → fetch category → prepend to state → trigger entry animation
   - UPDATE → fetch category → replace in state → trigger flash animation
   - DELETE → remove from state
4. All connected clients (~10) see instant updates

### Order CRUD (Admin)
1. Admin clicks FAB → `OrderFormSheet` opens as bottom sheet
2. Form submit → direct Supabase insert/update via browser client
3. Photo/audio uploads → Supabase Storage → path saved to order record
4. Realtime propagates change to all connected clients

### Authentication
1. Login form → Server Action → `signInWithPassword()`
2. Session cookie set automatically by `@supabase/ssr`
3. Server components read session via `createClient()` → `getUser()`
4. Profile fetched via service role client (bypasses RLS for reliable profile lookup)

## Key Abstractions

### `AuthUser` (`lib/auth.ts`)
Unified user object combining Supabase auth user + profile row:
```typescript
interface AuthUser {
  id: string;
  email: string | undefined;
  profile: Profile; // { full_name, role }
}
```

### `useOrders` Hook (`hooks/useOrders.ts`)
Single hook that manages all order/category data + realtime:
- Returns: `orders`, `categories`, `loading`, `error`, `flashIds`, `newIds`, `isConnected`
- Handles: initial fetch, realtime subscriptions, animation state management
- Cleanup: unsubscribes channels on unmount

### `OrderWithCategory` (`types/database.ts`)
Order row with joined category — the primary type used throughout the dashboard:
```typescript
interface OrderWithCategory extends Order {
  categories: Category | null;
}
```

### Category Color System (`lib/category-colors.ts`)
12-color palette with Tailwind classes for bg, text, border, dot, swatch.
Colors stored in DB per category. Falls back to deterministic UUID-hash for legacy entries.

## Entry Points

| Entry Point | Type | Purpose |
|-------------|------|---------|
| `middleware.ts` | Middleware | Route protection, session refresh |
| `app/page.tsx` | Page | Root redirect → `/dashboard` |
| `app/(auth)/login/page.tsx` | Page | Login form |
| `app/(auth)/login/actions.ts` | Server Action | signIn / signOut |
| `app/(dashboard)/dashboard/page.tsx` | Page | Dashboard entry (SSR auth gate) |
| `app/(dashboard)/dashboard/DashboardClient.tsx` | Client Component | Main interactive dashboard |

## Security Model

- **Middleware:** Blocks unauthenticated access to `/dashboard`
- **Server layouts:** Double-check auth via `requireAuth()`
- **RLS:** Supabase row-level security enforces viewer/admin permissions at DB layer
- **Service role client:** Used only server-side for profile lookups (bypasses RLS intentionally)
- **Storage policies:** Admin-only upload/delete, authenticated read
- **Auth actions:** Server-side only, no client-side auth calls
