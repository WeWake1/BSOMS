# Concerns & Technical Debt

## High Severity

### 1. Build Errors Suppressed
**Location:** `next.config.mjs`
```javascript
eslint: { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true },
```
Both ESLint and TypeScript errors are silently ignored during production builds. This means broken code can be deployed to production without any compile-time safety net.

**Risk:** Shipping runtime errors to production.

### 2. No Automated Tests
**Location:** Entire codebase
No unit tests, integration tests, or E2E tests exist. All verification is manual. See `TESTING.md` for full assessment.

**Risk:** Regressions go undetected. Refactors are unsafe.

### 3. Service Role Key Exposure Risk
**Location:** `lib/supabase/server.ts`
The service role client uses `process.env.SUPABASE_SERVICE_ROLE_KEY` and is only used in server-side code (`lib/auth.ts`). However, the `require()` call for `@supabase/supabase-js` is unusual:
```typescript
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
```
This pattern works but could be fragile in edge runtime or future Next.js versions.

**Risk:** Build/runtime breakage on Next.js upgrade. Security is currently OK (server-only).

### 4. Monolithic Dashboard Component
**Location:** `app/(dashboard)/dashboard/DashboardClient.tsx` (458 lines)
This single component manages:
- Filter state (5 filters + sort + view mode)
- Order selection and sheet open/close state
- Export functionality (PDF + PNG)
- Status change with dispatch date modal
- Off-screen export table rendering

**Risk:** Hard to maintain, test, and extend. Single re-render affects everything.

## Medium Severity

### 5. Direct Supabase Queries in Components
**Location:** `DashboardClient.tsx`, `order-form-sheet.tsx`, `order-detail-sheet.tsx`, `settings-drawer.tsx`
Supabase queries are embedded directly in components rather than extracted to a data layer. There is an empty `lib/supabase/queries/` directory that was never populated.

**Risk:** Duplicated query logic, harder to refactor data access patterns.

### 6. Type Assertions and Casts
**Location:** Multiple files
```typescript
// Examples from the codebase:
(supabase.from('orders') as any).update(...)
(supabase.from('categories') as any).insert(...)
newOrder as OrderWithCategory
(ords as unknown as OrderWithCategory[])
```
Supabase client methods are frequently cast to `any` to avoid type mismatches.

**Risk:** Silent type errors, no compile-time safety on query shapes.

### 7. Abandoned Sub-Orders Feature
**Location:** `supabase/migration_sub_orders_rollback.sql`
A sub-orders/line-items feature was attempted and fully rolled back. The rollback SQL exists as documentation but the feature was never completed.

**Risk:** Confusion about data model capabilities. Schema migration is in an unusual state.

### 8. Audio Feature Not in Original Spec
**Location:** `types/database.ts` (`audio_url`), `order-form-sheet.tsx`, `order-detail-sheet.tsx`
Voice note recording/playback was added beyond the original AGENTS.md spec. The `order-audio` Supabase Storage bucket and associated RLS policies exist but may not be fully tested.

**Risk:** Feature may have edge cases. Not part of the spec's test coverage.

### 9. Category Color Not in Original Schema
**Location:** `types/database.ts` (`color` field on Category), `lib/category-colors.ts`
The `categories` table has a `color` column that's not in the README SQL schema, suggesting it was added after initial setup. The code handles legacy entries without colors gracefully (UUID hash fallback).

**Risk:** Schema drift between README documentation and actual database.

## Low Severity

### 10. `html2canvas` May Be Unused
**Location:** `package.json`
Both `html2canvas` and `html-to-image` are installed. The codebase only imports from `html-to-image` (`toPng`). The `html2canvas` package may be a leftover from an earlier implementation.

**Risk:** Unnecessary bundle size.

### 11. Dead Utility File
**Location:** `check_profiles.js` (root)
A standalone Node.js script for debugging profile issues. Not part of the app's runtime or build. Should be in a `scripts/` directory or removed.

**Risk:** Minor clutter.

### 12. Empty `queries/` Directory
**Location:** `lib/supabase/queries/`
Created during initial project setup as part of the planned architecture but never populated. All queries are inline in components.

**Risk:** Misleading directory structure.

### 13. Hardcoded Colors in Export Table
**Location:** `DashboardClient.tsx` (lines 400-453)
The off-screen PNG export container uses hardcoded Tailwind colors (`bg-white`, `text-gray-900`, `bg-indigo-600`) instead of design tokens. This is intentional (exports should always be light with consistent colors) but breaks the token convention.

**Risk:** None functionally, but inconsistent with design token philosophy.

### 14. Date Formatting Locale Hardcoded
**Location:** `lib/utils.ts`, `lib/pdf-export.ts`
Date formatting is hardcoded to `en-IN` locale:
```typescript
new Date(date).toLocaleDateString('en-IN', { ... })
```

**Risk:** Not localization-ready if deployed outside India.

## Security Observations

- ✅ RLS enabled on all tables with appropriate policies
- ✅ Auth enforced at middleware, layout, and database layers
- ✅ Service role key is server-only
- ✅ Storage buckets are private with admin-only write
- ✅ No secrets in client-side code
- ✅ Generic auth error messages (no email enumeration)
- ⚠️ Session tokens managed by Supabase (no custom token handling needed)
- ⚠️ No CSRF protection beyond Next.js defaults
- ⚠️ No rate limiting on auth attempts (relies on Supabase defaults)

## Performance Notes

- Order count is expected to stay under 100 → no pagination needed
- No Server-Side Rendering for order data (all client-fetched after auth gate)
- Realtime subscription creates persistent WebSocket per connected client
- PNG export renders a hidden 1200px-wide table for capture
- Font: single Google Font (Plus Jakarta Sans) loaded via `next/font` (optimized)
