# Testing

## Current State

**No automated tests exist in the project.**

- No test framework configured (no Jest, Vitest, Playwright, or Cypress)
- No test files in the source tree (only in `node_modules/next/`)
- No test scripts in `package.json`
- No CI/CD pipeline for tests
- No `coverage/` directory

## Verification Approach

Testing and verification have been performed through:

1. **Manual testing** — direct interaction via browser at localhost:3000
2. **GSD verify-work** — conversational UAT checkpoints via agent workflow
3. **Build validation** — `next build` (with errors ignored)
4. **Browser-based audits** — Impeccable design audits (/audit, /polish)

## Existing Quality Checks

| Check | Tool | Notes |
|-------|------|-------|
| Linting | ESLint | `next/core-web-vitals` + `next/typescript` (relaxed rules) |
| Type checking | TypeScript | `tsc` (but `ignoreBuildErrors: true` in next.config) |
| Build | Next.js | Both ESLint and TS errors are ignored during build |
| Accessibility | React Aria | Accessible primitives (Select, ListBox) used in forms |
| Reduced motion | CSS | `@media (prefers-reduced-motion)` globally respected |

## Testing Gaps

### High Priority
- **No unit tests** for utility functions (`formatDate`, `getStatusColor`, `getCategoryColor`, `cn`)
- **No integration tests** for Supabase queries / RLS policies
- **No auth flow tests** (login, session, role-based access)
- **No form validation tests** (order creation/editing)
- **No realtime subscription tests**

### Medium Priority
- **No component tests** for UI primitives (Button variants, Input states)
- **No E2E tests** for critical flows (login → dashboard → create order → see update)
- **No visual regression tests** (design system consistency)

### Low Priority
- **No PDF export tests** (output correctness)
- **No PWA tests** (service worker, offline behavior)
- **No accessibility tests** (automated WCAG checks)

## Recommended Test Setup

If tests were to be added, the likely configuration would be:

- **Unit/Integration:** Vitest (Next.js compatible, fast)
- **Component:** Testing Library + Vitest
- **E2E:** Playwright (cross-browser, mobile viewport testing)
- **Visual:** Playwright screenshots or Chromatic
- **CI:** GitHub Actions on PR
