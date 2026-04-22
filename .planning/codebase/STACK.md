# Technology Stack

## Runtime & Framework

| Layer       | Technology                    | Version  |
|-------------|-------------------------------|----------|
| Runtime     | Node.js (implied)             | ≥18      |
| Framework   | Next.js (App Router)          | 14.2.35  |
| Language    | TypeScript (strict mode)      | ^5       |
| React       | React 18                      | ^18      |
| Module Res. | Bundler (tsconfig)            | esnext   |

- **App Router** — all routes under `app/` using route groups `(auth)` and `(dashboard)`.
- **Strict TypeScript** — enabled in `tsconfig.json`, though ESLint relaxes `no-explicit-any` and `no-require-imports`.
- **ESLint build errors are suppressed** in `next.config.mjs` (`ignoreDuringBuilds: true`), same for TypeScript build errors (`ignoreBuildErrors: true`).

## Styling

| Tool              | Version | Notes                                           |
|-------------------|---------|------------------------------------------------|
| Tailwind CSS      | ^3.4.1  | Configured via `tailwind.config.ts`             |
| tailwindcss-animate | ^1.0.7 | Plugin for enter/exit animations               |
| PostCSS           | ^8      | Minimal config, only `tailwindcss` plugin       |

**Design System:**
- **Font:** Plus Jakarta Sans (Google Fonts, loaded via `next/font/google`), assigned to `--font-plus-jakarta` CSS variable.
- **Colors:** OKLCH-based CSS custom properties in `app/globals.css`. Neutrals tinted toward hue 265 (electric indigo).
- **Status Colors:** Four status palettes (Pending=amber, In Progress=blue, Packing=fuchsia, Dispatched=green), each with bg/border/text variants.
- **Dark Mode:** Full dark theme via `html.dark` class. Toggled client-side with `localStorage`, NOT a system preference media query.
- **Fluid Typography:** `clamp()`-based fluid font sizes defined in Tailwind config (`fluid-xs` through `fluid-2xl`).
- **Custom breakpoint:** `xs: 390px` for iPhone 14 targeting.

## Dependencies (Production)

| Package                 | Purpose                                      |
|-------------------------|----------------------------------------------|
| `@supabase/ssr`         | SSR-compatible Supabase client               |
| `@supabase/supabase-js` | Core Supabase JS client                      |
| `@radix-ui/react-slot`  | Polymorphic component slot (used by Button)  |
| `class-variance-authority` | Component variant API (CVA)               |
| `clsx` + `tailwind-merge` | Conditional class merging utility (`cn()`) |
| `react-aria-components` | Accessible UI primitives (Select, ListBox)   |
| `lucide-react`          | Icon library (imported but primarily inline SVG used) |
| `react-hot-toast`       | Toast notification system                    |
| `jspdf` + `jspdf-autotable` | PDF export generation                   |
| `html-to-image`         | PNG export via `toPng()`                     |
| `html2canvas`           | Alternative image export (installed, used for fallback) |
| `next-pwa`              | Progressive Web App support (service worker) |
| `dotenv`                | Environment variable loading                 |

## Dev Dependencies

| Package              | Purpose                |
|----------------------|------------------------|
| `eslint`             | Linting                |
| `eslint-config-next` | Next.js ESLint rules   |
| `typescript`         | TypeScript compiler    |
| `@types/node`, `@types/react`, `@types/react-dom` | Type defs |

## Configuration Files

| File                 | Purpose                                               |
|----------------------|-------------------------------------------------------|
| `tsconfig.json`      | TypeScript config — strict, bundler module resolution, `@/*` path alias |
| `tailwind.config.ts` | Tailwind config — dark mode via class, OKLCH CSS vars, fluid type scale |
| `postcss.config.mjs` | PostCSS — only tailwindcss plugin                     |
| `next.config.mjs`    | Next.js config — PWA wrapper, ESLint/TS errors suppressed in builds |
| `.eslintrc.json`     | ESLint — extends core-web-vitals + typescript, disables strict type rules |
| `components.json`    | shadcn/ui config — new-york style, `@/components` alias |
| `.impeccable.md`     | Design system guidelines — brand personality, aesthetic direction |
| `.env.example`       | 3 env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

## PWA

- Configured via `next-pwa` in `next.config.mjs`.
- Disabled in development (`process.env.NODE_ENV === "development"`).
- `app/manifest.ts` exports web manifest with indigo-600 theme color and icons.
- Service worker and Workbox files in `public/`.
