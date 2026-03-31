# Directory Structure

## Top-Level Layout

```
BhaktiSales/
├── app/                          # Next.js App Router pages & layouts
│   ├── (auth)/                   # Auth route group
│   │   ├── layout.tsx            # Centered gradient layout
│   │   ├── login/
│   │   │   ├── page.tsx          # Login form (client component)
│   │   │   └── actions.ts        # Server actions: signIn, signOut
│   │   └── unauthorized/         # Error page for missing profiles
│   ├── (dashboard)/              # Dashboard route group
│   │   ├── layout.tsx            # Auth-protected layout wrapper
│   │   └── dashboard/
│   │       ├── page.tsx          # Server component (auth gate → DashboardClient)
│   │       └── DashboardClient.tsx  # Main interactive dashboard (client)
│   ├── fonts/                    # Custom font files (if any)
│   ├── globals.css               # Global CSS, design tokens, animations, keyframes
│   ├── layout.tsx                # Root layout (font, Toaster, metadata)
│   ├── manifest.ts               # PWA manifest generator
│   ├── page.tsx                  # Root redirect → /dashboard
│   └── favicon.ico
│
├── components/
│   ├── dashboard/                # Feature components
│   │   ├── filter-bar.tsx        # Sticky search + filter bar
│   │   ├── order-card.tsx        # Card + list-item views for orders
│   │   ├── order-detail-sheet.tsx    # Bottom sheet: order detail view
│   │   ├── order-form-sheet.tsx      # Bottom sheet: add/edit order form
│   │   ├── settings-drawer.tsx       # Settings + category management drawer
│   │   └── status-cards.tsx          # 4-card status summary row
│   └── ui/                      # Reusable UI primitives
│       ├── animated-number.tsx   # Count-up number animation
│       ├── badge.tsx             # Status badge component
│       ├── button.tsx            # Button with variants + loading state
│       ├── drawer.tsx            # Bottom sheet/drawer wrapper
│       ├── field.tsx             # Form field wrapper
│       ├── input.tsx             # Input with label + password toggle
│       ├── list-box.tsx          # React Aria ListBox
│       ├── popover.tsx           # React Aria Popover
│       ├── select.tsx            # React Aria Select
│       └── textfield.tsx         # React Aria TextField
│
├── hooks/
│   └── useOrders.ts              # Orders + categories fetch, realtime, animations
│
├── lib/
│   ├── auth.ts                   # Server auth helpers (getUser, requireAuth, requireAdmin)
│   ├── category-colors.ts        # 12-color palette for category badges
│   ├── pdf-export.ts             # jsPDF report generator
│   ├── utils.ts                  # cn(), formatDate(), getStatusColor()
│   └── supabase/
│       ├── client.ts             # Browser Supabase client
│       ├── server.ts             # Server Supabase client + service role client
│       ├── middleware.ts          # Middleware session update helper
│       └── queries/              # (empty — direct queries used instead)
│
├── types/
│   └── database.ts               # TypeScript types: Order, Category, Profile, Database
│
├── supabase/
│   └── migration_sub_orders_rollback.sql  # Rollback SQL for abandoned sub-orders feature
│
├── public/
│   ├── icon-192x192.png          # PWA icon
│   └── icon-512x512.png          # PWA icon
│
├── .planning/                    # GSD planning directory
│   └── codebase/                 # Codebase mapping (this document set)
│
├── .agent/                       # GSD agent skills & workflows
├── .agents/                      # Impeccable design skills
│
├── middleware.ts                  # Next.js middleware (root)
├── next.config.mjs               # Next config (PWA wrapper, build ignores)
├── tailwind.config.ts            # Tailwind config (tokens, fluid type, colors)
├── postcss.config.mjs            # PostCSS config
├── tsconfig.json                 # TypeScript config
├── components.json               # shadcn/21st.dev component config
├── .eslintrc.json                # ESLint config
├── .env.example                  # Environment variable template
├── .env.local                    # Local environment variables (gitignored)
├── .impeccable.md                # Impeccable design context
├── .gitignore                    # Git ignore rules
├── AGENTS.md                     # Agent build spec
├── README.md                     # Project documentation + Supabase SQL
├── check_profiles.js             # Utility script for profile debugging
├── package.json                  # Dependencies and scripts
└── package-lock.json             # Lockfile
```

## Naming Conventions

- **Files:** kebab-case for components and utilities (`order-card.tsx`, `filter-bar.tsx`)
- **Exceptions:** `DashboardClient.tsx` (PascalCase — main client component)
- **Route groups:** Parentheses `(auth)`, `(dashboard)` — Next.js route groups (no URL segment)
- **Type files:** lowercase (`database.ts`)
- **Config files:** standard names (`tailwind.config.ts`, `next.config.mjs`)

## Key Locations

| What | Where |
|------|-------|
| Design tokens (OKLCH colors, animations) | `app/globals.css` |
| Tailwind theme extension | `tailwind.config.ts` |
| Route protection | `middleware.ts` |
| Auth helpers (server) | `lib/auth.ts` |
| Supabase clients | `lib/supabase/` |
| Main dashboard orchestrator | `app/(dashboard)/dashboard/DashboardClient.tsx` |
| All dashboard components | `components/dashboard/` |
| UI primitives | `components/ui/` |
| Realtime + data hook | `hooks/useOrders.ts` |
| Database types | `types/database.ts` |
| PDF export logic | `lib/pdf-export.ts` |
| Category color system | `lib/category-colors.ts` |
| PWA manifest | `app/manifest.ts` |
| Database setup SQL | `README.md` (inline) |

## Patterns

- **Route groups:** `(auth)` and `(dashboard)` isolate layout wrapping without URL impact
- **Server → Client boundary:** Server components do auth checks, then render a single `'use client'` component (`DashboardClient`) that handles all interactivity
- **Bottom sheets over page navigation:** All detail/edit views open as drawers, not separate pages
- **Single hook for data:** `useOrders` provides all orders + categories + realtime to dashboard
- **No API routes:** All data access is direct Supabase client calls (browser or server)
- **Empty `queries/` directory:** Direct Supabase queries are embedded in components/hooks rather than extracted
