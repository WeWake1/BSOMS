# External Integrations

## Supabase (Primary Backend)

Supabase provides ALL backend services for OrderFlow: database, authentication, storage, and realtime.

### Authentication

- **Method:** Email + password via `supabase.auth.signInWithPassword()`.
- **Login flow:** Server Action in `app/(auth)/login/actions.ts` → validates credentials → redirects to `/dashboard`.
- **Session management:** Cookie-based via `@supabase/ssr`. Middleware at `middleware.ts` refreshes session on every request.
- **Role detection:** After auth, profile is fetched from `profiles` table using service role client (bypasses RLS). Role is `admin` or `viewer`.
- **Route protection:** Dual layer:
  1. `middleware.ts` — redirects unauthenticated users from `/dashboard` to `/login`, and authenticated users from `/login` to `/dashboard`.
  2. `lib/auth.ts` — `requireAuth()` and `requireAdmin()` server-side helpers used in layouts and pages.

### Database Tables

| Table        | Purpose                           | RLS |
|--------------|-----------------------------------|-----|
| `orders`     | All order records                 | Yes |
| `categories` | Order categories with colors      | Yes |
| `profiles`   | User profiles with roles          | Yes |

**RLS Policy:** Viewers get SELECT only; Admin gets full CRUD. All authenticated users can SELECT on profiles.

### Supabase Realtime

- **Two channels subscribed** in `hooks/useOrders.ts`:
  1. `public:orders` — listens for INSERT, UPDATE, DELETE on `orders` table.
  2. `public:categories` — listens for INSERT, UPDATE, DELETE on `categories` table.
- On INSERT: fetches the category for the new order, prepends to local state, triggers `animate-new-order` animation.
- On UPDATE: replaces order in local state, triggers `animate-card-flash` animation.
- On DELETE: removes from local state.
- Connection status exposed via `isConnected` state — displayed as a live/connecting indicator in the status cards.

### Supabase Storage

Two buckets:

| Bucket         | Purpose             | Upload  | Read     |
|----------------|---------------------|---------|----------|
| `order-photos` | Order reference images | Admin   | All auth |
| `order-audio`  | Voice note recordings  | Admin   | All auth |

- File upload happens directly from browser in `order-form-sheet.tsx`.
- File paths stored in `orders.photo_url` and `orders.audio_url`.
- Signed URLs generated for display (1-hour TTL via `createSignedUrl(path, 3600)`).
- Photo preview shows immediately using local `URL.createObjectURL()` while upload is in progress.

### Supabase Client Architecture

Three client variants in `lib/supabase/`:

| File            | Type     | Auth      | Usage                              |
|-----------------|----------|-----------|------------------------------------|
| `client.ts`     | Browser  | Anon key  | Client components, realtime        |
| `server.ts`     | Server   | Anon key  | Server components (cookie-based)   |
| `server.ts`     | Service  | Service key | Admin operations (bypass RLS)    |
| `middleware.ts` | Middleware | Anon key | Session refresh in middleware      |

**Service client** is created via `createServiceClient()` in `lib/supabase/server.ts` — uses `require('@supabase/supabase-js')` directly (not SSR wrapper) with `SUPABASE_SERVICE_ROLE_KEY`. Used exclusively in `lib/auth.ts` for profile fetching.

## Export Integrations

### PDF Export (`lib/pdf-export.ts`)
- Uses `jsPDF` + `jspdf-autotable`.
- Generates landscape A4 PDF with indigo-600 header.
- Exports currently filtered orders with all columns.
- Triggered from export dropdown in dashboard header.

### PNG Export (DashboardClient.tsx)
- Uses `html-to-image` (`toPng()`).
- Renders an off-screen HTML table (fixed 1200px width, white background).
- Captures with `devicePixelRatio` for retina quality.
- Triggered from export dropdown in dashboard header.

## Environment Variables

| Variable                       | Scope       | Required |
|--------------------------------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL`     | Client+Server | Yes    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Client+Server | Yes    |
| `SUPABASE_SERVICE_ROLE_KEY`    | Server only   | Yes    |

## No Other External APIs

The application does not integrate with any third-party APIs, payment providers, analytics, or external services beyond Supabase. It is a self-contained internal tool.
