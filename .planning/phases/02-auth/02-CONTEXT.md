# Phase 2: Auth — Context

**Gathered:** 2026-03-19
**Status:** Ready for planning
**Source:** AGENTS.md spec

<domain>
## Phase Boundary

This phase delivers the complete authentication system:
- `/login` page — mobile-first, email + password, inline errors, 21st.dev components
- Session management — Supabase Auth via `@supabase/ssr`, cookies, auto-refresh
- Role detection — reads `profiles.role` from Supabase after login
- Route protection — server-side middleware + server component guards
- Redirect logic — both roles land on `/dashboard` after login; unauthenticated redirected to `/login`

Does NOT include: any dashboard UI, order data, categories, realtime
</domain>

<decisions>
## Implementation Decisions

### Login Page (`/app/(auth)/login/page.tsx`)
- Centered single-card layout, works on 390px width
- Logo/brand mark at top: "OrderFlow" text
- Email input with label
- Password input with label + show/hide toggle
- Primary CTA button: "Sign In"
- Inline error display below form (no browser alerts, no toast)
- Loading state on button while submitting
- All form fields have `id` attributes for accessibility and testing

### Auth Flow (Server Action)
- Use Next.js Server Actions in `app/(auth)/login/actions.ts`
- Call `supabase.auth.signInWithPassword({ email, password })`
- On success: `redirect('/dashboard')`
- On error: return error string to client component for inline display
- No redirect on error — stay on login page

### Session Management
- `@supabase/ssr` handles cookie-based sessions (set up in Phase 1)
- `middleware.ts` already calls `updateSession()` on every request
- No additional session logic needed

### Route Protection Strategy
- **Middleware** (`middleware.ts`): refresh session only (no redirect logic there — avoids infinite loops with Supabase)
- **Server layout** (`app/(dashboard)/layout.tsx`): check `supabase.auth.getUser()` → redirect to `/login` if null
- **Login page**: if already authenticated, redirect to `/dashboard`
- **Role detection**: `getUser()` + query `profiles` table for `role` field in dashboard layout (Phase 3 uses this)

### Role Helper
Create `lib/auth.ts` with:
```typescript
getUser() - returns { user, profile } or null
requireAuth() - redirects to /login if not authenticated
requireAdmin() - redirects to /dashboard if not admin
```

### Page Structure
```
app/
  (auth)/
    login/
      page.tsx        Login page (client component)
      actions.ts      Server action for sign in
  (dashboard)/
    layout.tsx        Protected layout — requires auth
    page.tsx          Redirect to /dashboard proper (Phase 3)
```

### Styling
- Full-height centered layout using `min-h-dvh flex items-center justify-center`
- Card: white background, subtle shadow, rounded-2xl, max-w-sm, padding 6
- Brand header: large "OrderFlow" text + subtitle
- Input fields: full width, border, rounded-lg, focus ring
- Button: full width, primary color (indigo-600), hover state
- Error: red-50 background, red-700 text, rounded-lg, padding 3
- Minimum 44px tap targets on all interactive elements

### 21st.dev Component Strategy
- The spec says to use 21st.dev for Buttons and Inputs
- Rather than waiting for specific 21st.dev components, build clean custom components in `components/ui/` that match the spec's quality bar
- 21st.dev upgrades happen in Phase 7 (UI Polish)
</decisions>

<canonical_refs>
## Canonical References

- `AGENTS.md` — Full project specification, roles, auth requirements
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-07
- `lib/supabase/client.ts` — Browser client (for client components)
- `lib/supabase/server.ts` — Server client (for server components and actions)
- `middleware.ts` — Already set up for session refresh
- `types/database.ts` — Profile type with role field
</canonical_refs>

<specifics>
## Specific Ideas

- Error messages to show: "Invalid email or password" (generic, don't reveal which is wrong)
- Loading state: disable button + show spinner or "Signing in..." text
- The profiles table auto-creates on signup (trigger from Phase 1 SQL) with role='viewer'
- Admin promotion is manual via Supabase dashboard (documented in README)
</specifics>

<deferred>
## Deferred Ideas

- Password reset flow — v2
- Invite viewer accounts UI — v2
- OAuth/social login — out of scope
</deferred>

---
*Phase: 02-auth*
*Context gathered: 2026-03-19*
