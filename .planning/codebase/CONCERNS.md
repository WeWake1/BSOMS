# Concerns & Technical Debt

## Critical Issues

### 1. Build Errors Suppressed
**Files:** `next.config.mjs` (lines 12-17)

Both ESLint and TypeScript errors are suppressed during production builds:
```js
eslint: { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true },
```
This means type errors and lint violations will silently pass into production. The two existing `@ts-ignore` comments in `DashboardClient.tsx` (lines 48, 59) are symptoms of this — Supabase `.update()` type inference issues that were suppressed rather than fixed.

**Risk:** Silent regressions. A type error in a critical auth path could ship to production unnoticed.

---

### 2. No Automated Tests
**See:** `TESTING.md`

Zero test coverage — no unit, integration, or E2E tests. No test runner installed. All verification is manual.

**Risk:** Regressions on every change. Particularly dangerous for auth/RLS logic where bugs are invisible until exploited.

---

### 3. Service Role Key Usage Pattern
**File:** `lib/supabase/server.ts` (lines 31-47), `lib/auth.ts` (lines 25-31)

The service role client bypasses all RLS policies. Currently used for profile fetching in `getUser()`. This is correct for auth checks but:
- Uses `require()` instead of ESM import (due to mixing SSR wrapper with base client).
- No cache or connection pooling — creates a new client per auth check.

**Risk:** If this pattern is copied for other operations, it could inadvertently bypass security.

---

## Moderate Issues

### 4. Supabase Client Stability in SettingsDrawer
**File:** `components/dashboard/settings-drawer.tsx` (line 47)

```tsx
const supabase = createClient(); // NOT in useState
```

Unlike `DashboardClient`, `OrderFormSheet`, and `OrderDetailSheet` which correctly use `useState(() => createClient())` for a stable reference, `SettingsDrawer` creates the client directly. This means a new client is created on every render.

**Risk:** Potential duplicate subscriptions or stale references. Inconsistency with the pattern used elsewhere.

---

### 5. Dark Mode Flash on Load
**File:** `components/dashboard/settings-drawer.tsx` (lines 81-85)

Dark mode is managed client-side via `localStorage` + class toggle. There is no SSR-aware dark mode (no cookie, no `<script>` in `<head>` to apply the class before paint).

**Risk:** Users in dark mode will see a brief flash of light mode on page load/refresh (FOUC).

---

### 6. Hardcoded Colors in SettingsDrawer
**File:** `components/dashboard/settings-drawer.tsx`

This component uses hardcoded Tailwind colors (`bg-gray-50`, `text-gray-900`, `bg-indigo-100`, etc.) instead of the semantic token system (`bg-muted`, `text-foreground`, etc.) used consistently everywhere else.

**Risk:** Inconsistency — these colors won't properly adapt to theme changes or future palette updates.

---

### 7. Stale SQL Migration Files
**File:** `supabase/` directory

Contains 3 SQL files related to the sub-orders feature that was added and then rolled back:
- `migration_order_items.sql` — creates `order_items` table (no longer exists)
- `migration_order_items_sort_order.sql` — adds sort order to `order_items`
- `migration_sub_orders_rollback.sql` — rolls back to flat order structure

These are historical artifacts. The current database schema does not include `order_items`.

**Risk:** Confusion for developers. Someone might accidentally run these migrations.

---

### 8. Backward Compatibility Type Alias
**File:** `types/database.ts` (line 34)

```tsx
export type OrderWithCategoryAndItems = OrderWithCategory;
```

This type alias exists for backward compatibility from the sub-orders removal. `OrderWithCategoryAndItems` is still referenced in `useOrders.ts`, `order-card.tsx`, `order-form-sheet.tsx`, etc.

**Risk:** Confusing naming — "Items" suggests sub-orders still exist when they don't.

---

### 9. Empty Queries Directory
**File:** `lib/supabase/queries/`

This directory exists but contains zero files. It was intended for typed Supabase query modules per the project spec but was never populated.

**Risk:** None currently. The project works fine with inline queries. But it's unused scaffolding.

---

### 10. Unused Font Files
**File:** `app/fonts/GeistVF.woff`, `app/fonts/GeistMonoVF.woff`

Geist fonts are bundled but the app uses Plus Jakarta Sans (loaded via Google Fonts). These files are dead weight.

**Risk:** ~134KB of unused assets shipped to the repo.

---

## Security Considerations

### RLS is Properly Configured
RLS is enabled on all three tables (`orders`, `categories`, `profiles`). The admin/viewer role separation is enforced server-side.

### No Exposed Secrets
`.env.local` is gitignored. `.env.example` contains placeholder values only. Service role key is server-side only.

### Authentication is Sound
The middleware + `requireAuth()` double-check pattern is robust. Profile lookup uses service role to bypass RLS, preventing auth deadlocks.

### Storage Access
Supabase Storage buckets (`order-photos`, `order-audio`) allow all authenticated users to read. Only admin can upload/delete. This is correct.

## Performance Considerations

### No Pagination
All orders are loaded at once. With expected <100 orders, this is fine. If order volume grows significantly, the flat list + client-side filtering will degrade.

### No Image Optimization
Order photos are loaded as raw Supabase Storage URLs via `<img>` tags. No `next/image`, no resizing, no WebP conversion. Large photos will impact mobile performance.

### Off-Screen Export DOM
The PNG export renders a full table off-screen (`absolute left-[-9999px]`). This DOM is always present, even when not exporting. With 100 orders, this adds ~100 table rows to the DOM permanently.
