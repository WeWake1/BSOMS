# Coding Conventions

## TypeScript

- **Strict mode** enabled (`"strict": true` in tsconfig).
- **ESLint relaxations:** `no-explicit-any` is OFF, `no-require-imports` is OFF, `no-img-element` is OFF.
- **Build errors suppressed** — both ESLint and TypeScript errors are ignored during production builds (`ignoreDuringBuilds: true`, `ignoreBuildErrors: true`).
- **Two `@ts-ignore` comments** exist in `DashboardClient.tsx` (lines 48, 59) for Supabase `.update()` calls where TypeScript can't infer the correct type.

## Code Style

### Component Patterns

- **'use client' directive** — explicitly declared at top of every client component. Server components have no directive.
- **State initialization** — Supabase client is created via `useState(() => createClient())` to ensure a stable reference across renders. This is consistent across `DashboardClient`, `OrderDetailSheet`, `OrderFormSheet`.
- **Props interfaces** — defined inline above each component, not exported separately.
- **Form state** — individual `useState` per field (not a form object or useReducer). Example in `order-form-sheet.tsx`: 15+ individual `useState` calls.
- **No form library** — forms use raw React state + native form events. Login uses `useFormState` with server actions.

### Import Style

```tsx
// External packages first
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

// Internal modules with @/ alias
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus } from '@/types/database';
```

### Naming

| Item          | Convention      | Example                         |
|---------------|-----------------|----------------------------------|
| Components    | PascalCase      | `StatusCards`, `OrderFormSheet`  |
| Files         | kebab-case      | `order-card.tsx`, `filter-bar.tsx` |
| Hooks         | camelCase        | `useOrders.ts`                  |
| Types         | PascalCase      | `OrderWithCategory`, `AuthUser` |
| CSS variables | kebab-case      | `--status-pending-bg`           |
| Server actions| camelCase       | `signIn`, `signOut`             |

### CSS / Styling Patterns

- **`cn()` utility** from `lib/utils.ts` — combines `clsx` + `tailwind-merge` for conditional class composition.
- **Inline SVG** preferred over icon library imports. Most icons are raw SVG elements.
- **OKLCH colors** defined as CSS custom properties in `globals.css`, referenced in Tailwind config as `var(--token-name)`.
- **Status colors** accessed via helper functions `getStatusColor()` and `getStatusCardColor()` in `lib/utils.ts`, which return Tailwind class strings.
- **Category colors** accessed via `getCategoryColor()` in `lib/category-colors.ts`, which maps stored color keys to Tailwind class objects.
- **Dark mode** — uses `dark:` Tailwind variants. Some components (notably `settings-drawer.tsx`) still use hardcoded `dark:bg-slate-900/50` instead of semantic tokens.

### Animations

- Entrance animations defined as custom utility classes in `globals.css`: `animate-fade-up`, `animate-scale-in`, `animate-spin-in`, etc.
- Stagger delays via `animate-stagger-1` through `animate-stagger-4` classes.
- Realtime-specific animations: `animate-card-flash` (update glow), `animate-new-order` (insert slide-in), `animate-live-pulse` (connection indicator).
- View Transitions API used for order card → detail sheet morph (`viewTransitionName`).
- `prefers-reduced-motion` respected with global override.
- Custom easing variables: `--ease-out-quart`, `--ease-out-quint`, `--ease-out-expo`.

## Error Handling

- **User-facing errors** use `react-hot-toast` with conversational, non-technical messages:
  ```tsx
  toast.error("Couldn't update the order status. Please try again.");
  ```
- **No generic error boundaries** — errors are handled per-component.
- **Login errors** use `useFormState` to display inline error messages with shake animation.
- **Delete confirmation** — two-step inline confirmation (not `window.confirm()`). Consistent across `OrderDetailSheet` and `SettingsDrawer`.
- **Upload failures** — caught silently with toast notification, preview image revoked.

## Accessibility

- **Minimum tap target:** 44×44px enforced via `min-tap` CSS utility class.
- **ARIA attributes:** `role="radiogroup"` on status segmented control, `role="switch"` on dark mode toggle, `aria-pressed` on filter buttons, `aria-label` on icon-only buttons.
- **Focus management:** Photo modal traps focus, handles Escape key, auto-focuses close button.
- **Screen reader text:** `<span className="sr-only">` used for icon-only button labels.
- **Reduced motion:** Global CSS rule disables all animations when `prefers-reduced-motion: reduce`.
- **Semantic headings:** Single `<h1>` on each page.

## Data Patterns

- **Realtime-first:** No manual refresh mechanisms. Data updates automatically via Supabase Realtime subscriptions.
- **Optimistic rendering:** Photo preview shows immediately via `createObjectURL()` while upload is in progress.
- **No caching layer:** Data is fetched once on mount, then kept in sync via realtime. No SWR/React Query.
- **No pagination:** Full order list loaded at once (expected <100 orders).
- **Filtering is client-side:** All filters (status, category, search) are applied via `useMemo` on the already-fetched order list.
