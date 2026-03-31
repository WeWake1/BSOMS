# Technology Stack

## Language & Runtime

- **Language:** TypeScript (~5.x)
- **Runtime:** Node.js 20+ (Next.js server)
- **Package Manager:** npm (lockfile: `package-lock.json`)

## Framework

- **Next.js 14.2.35** — App Router (`/app` directory)
  - Server Components by default, `'use client'` for interactive pages
  - Server Actions for auth (`app/(auth)/login/actions.ts`)
  - Middleware at `middleware.ts` for route protection + session refresh
  - PWA support via `next-pwa` (service worker disabled in dev)

## UI & Styling

- **Tailwind CSS 3.4.1** — utility-first, configured via `tailwind.config.ts`
  - Dark mode: `class`-based (toggled from settings drawer via `localStorage`)
  - Custom fluid type scale using `clamp()` (`text-fluid-xs` through `text-fluid-2xl`)
  - Custom `xs: 390px` breakpoint for iPhone 14 targeting
  - CSS variables in `app/globals.css` use **OKLCH** color functions
  - `tailwindcss-animate` plugin for animation utilities
- **PostCSS** via `postcss.config.mjs`
- **Font:** Plus Jakarta Sans (Google Fonts, loaded via `next/font`)
- **Design tokens:** OKLCH-based CSS custom properties in `:root` and `html.dark`
  - Brand: Electric Indigo (hue 265)
  - Status palette: Amber (Pending), Cerulean (In Progress), Fuchsia-Violet (Packing), Emerald (Dispatched)
- **Component system:** shadcn-compatible (21st.dev), `new-york` style
  - Config in `components.json`
  - React Aria Components for accessible primitives (`Select`, `ListBox`)

## Backend & Data

- **Supabase** (`@supabase/supabase-js` ^2.99.2, `@supabase/ssr` ^0.9.0)
  - **Postgres** — orders, categories, profiles tables
  - **Auth** — email/password, session cookies via SSR helpers
  - **Storage** — `order-photos` and `order-audio` buckets (private)
  - **Realtime** — postgres_changes subscription on `orders` and `categories` tables
  - **RLS** — Row Level Security on all tables (viewer=SELECT, admin=full CRUD)

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.2.35 | App framework |
| `react` / `react-dom` | ^18 | UI library |
| `@supabase/ssr` | ^0.9.0 | SSR cookie handling for Supabase |
| `@supabase/supabase-js` | ^2.99.2 | Supabase client SDK |
| `tailwindcss` | ^3.4.1 | CSS framework |
| `tailwindcss-animate` | ^1.0.7 | Animation plugin |
| `class-variance-authority` | ^0.7.1 | Component variant system |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^3.5.0 | Conditional class merging |
| `lucide-react` | ^0.577.0 | Icon library |
| `react-hot-toast` | ^2.6.0 | Toast notifications |
| `react-aria-components` | ^1.16.0 | Accessible UI primitives |
| `@radix-ui/react-slot` | ^1.2.4 | Component composition |
| `jspdf` + `jspdf-autotable` | ^4.2.1 / ^5.0.7 | PDF export |
| `html-to-image` | ^1.11.13 | PNG export |
| `html2canvas` | ^1.4.1 | Canvas-based export (may be unused) |
| `next-pwa` | ^5.6.0 | PWA / Service Worker |
| `dotenv` | ^17.3.1 | Env loading |

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5 | Type checking |
| `eslint` + `eslint-config-next` | ^8 / 14.2.35 | Linting |
| `@types/node`, `@types/react`, `@types/react-dom` | ^20 / ^18 / ^18 | Type definitions |
| `postcss` | ^8 | CSS processing |

## Build & Configuration

- **ESLint:** `next/core-web-vitals` + `next/typescript` with relaxed rules:
  - `no-explicit-any`: off
  - `no-require-imports`: off
  - `no-img-element`: off
- **TypeScript:** `tsconfig.json` with path alias `@/` → project root
- **Build ignores:** ESLint errors and TypeScript errors are ignored during build (`next.config.mjs`)
- **PWA:** `next-pwa` wraps the Next config; disabled in dev, outputs to `/public`

## Environment Variables

| Variable | Scope | Required |
|----------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Yes |
