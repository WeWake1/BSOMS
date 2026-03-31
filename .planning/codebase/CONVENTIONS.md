# Coding Conventions

## Code Style

### TypeScript
- Strict mode implied but relaxed in practice (`@ts-ignore` and `any` are permitted)
- ESLint rules explicitly disable `no-explicit-any` and `no-require-imports`
- Path aliases: `@/` maps to project root
- Explicit type imports: `import type { ... }` used throughout

### React Patterns
- **Functional components only** — no class components
- **Named exports** for all components (no default exports except pages)
- **`'use client'`** directive on all interactive components
- **Server Actions** (`'use server'`) for auth operations only
- **`useState` for stable references:** Supabase client initialized via `useState(() => createClient())` to avoid re-creation
- **`useMemo`** for computed values (filtered orders, counts, sorted orders)
- **`useRef`** for DOM refs (file inputs, media recorders, timers)
- **`useEffect`** for side effects (data fetching, subscriptions, DOM sync)
- **`useCallback`** sparingly (only `handleCategorySelection`)

### Component Structure
```typescript
'use client';

import { ... } from 'react';
import { ... } from '@/components/ui/...';
import { ... } from '@/lib/...';
import type { ... } from '@/types/database';

interface ComponentProps {
  // typed props
}

export function ComponentName({ ...props }: ComponentProps) {
  // state declarations
  // effects
  // handlers
  // render
}
```

## Naming

| Entity | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `OrderCard`, `FilterBar`, `StatusCards` |
| Files (components) | kebab-case | `order-card.tsx`, `filter-bar.tsx` |
| Hooks | camelCase with `use` prefix | `useOrders` |
| Types/Interfaces | PascalCase | `OrderWithCategory`, `AuthUser` |
| Type files | lowercase | `database.ts` |
| CSS variables | kebab-case with `--` prefix | `--status-pending-bg` |
| Utility functions | camelCase | `formatDate`, `getStatusColor`, `getCategoryColor` |
| Server actions | camelCase | `signIn`, `signOut` |
| Form state | camelCase matching DB column | `customerName`, `categoryId`, `dueDate` |

## Component Patterns

### UI Primitives (`components/ui/`)
- Built on React Aria Components for accessibility
- Use `class-variance-authority` (CVA) for variant systems
- Accept `className` prop and merge via `cn()` (clsx + tailwind-merge)
- Follow shadcn/21st.dev patterns with `new-york` style

### Feature Components (`components/dashboard/`)
- Self-contained with their own state management
- Receive data and callbacks via props from `DashboardClient`
- Use Supabase client directly for mutations
- Bottom sheet/drawer pattern for detail and form views

### Dashboard Orchestrator (`DashboardClient.tsx`)
- Single large client component (~458 lines) that owns:
  - All filter state (`searchQuery`, `selectedCategory`, `selectedStatus`, `sortBy`, `viewMode`)
  - Order selection state
  - Form/sheet open states
  - Export functionality
- Delegates to child components for rendering

## Styling Conventions

### Token Usage
- **Semantic tokens preferred:** `text-foreground`, `bg-card`, `border-border`
- **Muted scale:** `text-muted-foreground`, `bg-muted` for secondary content
- **Status colors:** Via CSS variables (`var(--status-pending-bg)`) or utility functions
- **No raw colors in components:** All hardcoded grays/indigos extracted to tokens
- **Dark mode:** All tokens have `html.dark` overrides in `globals.css`

### Spacing & Layout
- Mobile-first responsive design (`390px` breakpoint)
- `gap-` utilities for spacing between elements
- `rounded-xl` / `rounded-2xl` for card/sheet corners
- `min-tap` utility class ensures 44×44px touch targets
- `pb-safe` utility for safe area inset on mobile

### Animation
- Custom entrance animations: `animate-fade-up`, `animate-scale-in`, `animate-spin-in`
- Stagger classes: `animate-stagger-1` through `animate-stagger-4`
- Realtime feedback: `animate-card-flash` (update), `animate-new-order` (insert)
- `@media (prefers-reduced-motion: reduce)` respected globally
- View Transitions API used for order card → detail sheet transition

## Error Handling

- **User-facing errors:** `react-hot-toast` for all toast notifications
- **Error messages:** Human-readable, never expose technical details
  - ✅ "Couldn't update the order status. Please try again."
  - ❌ "Error: 42501 insufficient_privilege"
- **Duplicate detection:** Check error message for 'duplicate' or 'unique' keywords
- **Auth errors:** Generic "Invalid email or password" (never reveal which field is wrong)
- **Inline errors:** Login page uses inline error div (not toast)
- **Delete confirmations:** Two-step inline confirmation (not `window.confirm`)
- **No global error boundary** — errors handled per-component

## State Management

- **No external state library** — all state is React `useState` / `useEffect`
- **Single data hook:** `useOrders` is the sole source of truth for orders + categories
- **Realtime as state sync:** No manual refetch — Supabase Realtime handles all updates
- **Form state:** Local to `OrderFormSheet` (no form library like React Hook Form)
- **Auth state:** Server-side only (no client-side auth context)
- **Dark mode:** `localStorage` + `document.documentElement.classList`
