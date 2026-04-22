# Testing

## Current State: No Tests

OrderFlow has **zero automated tests** — no unit tests, integration tests, or end-to-end tests exist in the codebase.

- No test runner is configured (no Jest, Vitest, Playwright, or Cypress).
- No test files exist anywhere in the project.
- No `test` script in `package.json`.
- No CI/CD pipeline configured.

## What Would Need Testing

### High Priority

1. **Auth flow** — login, session persistence, role-based access control, middleware redirects.
2. **Order CRUD** — create, update, delete via Supabase client with correct payloads.
3. **Realtime subscriptions** — INSERT/UPDATE/DELETE events updating local state correctly.
4. **RLS enforcement** — viewers cannot modify orders, admins can.
5. **Filter/sort logic** — `filteredOrders` and `sortedOrders` memos in `DashboardClient`.

### Medium Priority

6. **Photo/audio upload** — file upload to Supabase Storage, signed URL generation.
7. **PDF export** — correct data mapping, column layout.
8. **PNG export** — off-screen table rendering, `html-to-image` capture.
9. **Category management** — CRUD operations, color assignment, inline add.

### Lower Priority

10. **Dark mode toggle** — `localStorage` persistence, class toggling.
11. **Animations** — reduced motion override, flash/new timers.
12. **Form validation** — required field enforcement, error messages.

## Testing Considerations

- **Supabase mocking** — any test suite would need to mock `@supabase/ssr` and `@supabase/supabase-js` clients.
- **Realtime mocking** — Supabase channels would need to be simulated for realtime tests.
- **Server component testing** — `requireAuth()` and layout components use Next.js server APIs (`cookies()`, `redirect()`).
- **No pure utility functions to test easily** — most logic is embedded in React components or hooks.

## Manual QA

Currently all testing is manual:
- Mobile testing at 390px viewport width (iPhone 14).
- Admin vs. viewer role verification via Supabase dashboard.
- Realtime verification by opening multiple browser tabs.
- Dark mode toggle verification.
- PDF/PNG export visual verification.
