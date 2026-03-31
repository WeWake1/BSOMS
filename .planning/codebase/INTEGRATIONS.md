# External Integrations

## Supabase (Primary Backend)

### Database (Postgres)

**Connection:** Via `@supabase/ssr` with cookie-based auth for SSR.

**Tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `orders` | Core order records | `id`, `order_no` (unique), `customer_name`, `category_id` (FK), `date`, `due_date`, `dispatch_date`, `length`, `width`, `qty`, `description`, `photo_url`, `audio_url`, `status` (enum), `created_at`, `updated_at` |
| `categories` | Order categorization | `id`, `name` (unique), `color`, `created_at` |
| `profiles` | User role management | `id` (FK → auth.users), `full_name`, `role` ('admin'\|'viewer') |

**Enum:** `order_status` — `'Pending'`, `'In Progress'`, `'Packing'`, `'Dispatched'`

**Triggers:**
- `update_updated_at()` — auto-sets `orders.updated_at` on row update
- `handle_new_user()` — auto-creates `profiles` row with `role='viewer'` on auth signup

**RLS Policies:**
- All tables require authenticated access
- Viewers: SELECT only
- Admin: full CRUD (checked via `get_user_role()` helper function)

### Authentication

**Type:** Email/password via Supabase Auth

**Flow:**
1. Login form posts to server action (`app/(auth)/login/actions.ts`)
2. `signInWithPassword()` called server-side
3. Session stored in cookies via `@supabase/ssr`
4. Middleware (`middleware.ts`) redirects:
   - Unauthenticated → `/login`
   - Authenticated on `/login` → `/dashboard`
5. Profile/role fetched via service client in `lib/auth.ts`

**Clients:**
- `lib/supabase/client.ts` — Browser client (`createBrowserClient`)
- `lib/supabase/server.ts` — Server client (`createServerClient` with cookies)
- `lib/supabase/server.ts` — Service role client (`createServiceClient`, no cookies, bypasses RLS)
- `lib/supabase/middleware.ts` — Middleware session refresh client

### Realtime

**Subscription:** Postgres Changes on `orders` and `categories` tables

**Implementation:** `hooks/useOrders.ts`
- Channel `public:orders` — listens for INSERT, UPDATE, DELETE
- Channel `public:categories` — listens for INSERT, UPDATE, DELETE
- On INSERT: fetches related category, prepends to list, triggers "new" animation
- On UPDATE: fetches related category, replaces in list, triggers "flash" animation
- On DELETE: removes from list

**Connection indicator:** `isConnected` state exposed from hook, displayed via live-pulse dot on status cards

### Storage

**Buckets:**

| Bucket | Purpose | Access |
|--------|---------|--------|
| `order-photos` | Single photo per order | Admin: upload/delete, All auth: read |
| `order-audio` | Voice notes per order | Admin: upload/delete, All auth: read |

**Upload flow:**
1. File selected or recorded in `OrderFormSheet`
2. Uploaded to Supabase Storage with random filename
3. Storage path saved to order record (`photo_url` / `audio_url`)
4. Signed URLs generated on-demand for viewing (1 hour expiry)

## Vercel (Hosting)

- Deployed from GitHub → Vercel
- Auto-deploys on push to `main`
- Environment variables configured in Vercel project settings
- No custom API routes — all backend via Supabase directly

## PWA

- Web app manifest at `app/manifest.ts`
- Service worker via `next-pwa` (disabled in dev)
- Icons: `public/icon-192x192.png`, `public/icon-512x512.png`
- `display: standalone`, `theme_color: #4f46e5` (indigo-600)

## No Other External APIs

The application does not currently integrate with:
- Email services
- Payment providers
- Analytics services
- Third-party webhooks
- Google Sheets sync (was explored but not implemented in codebase)
