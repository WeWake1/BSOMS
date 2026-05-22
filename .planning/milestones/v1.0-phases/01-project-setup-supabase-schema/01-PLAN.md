---
plan: 01
phase: 1
wave: 1
title: Initialize Next.js 14 Project with Tailwind and TypeScript
depends_on: []
files_modified:
  - package.json
  - tsconfig.json
  - tailwind.config.ts
  - postcss.config.js
  - app/layout.tsx
  - app/globals.css
  - next.config.ts
autonomous: true
requirements_addressed: []
---

# Plan 01: Initialize Next.js 14 Project with Tailwind and TypeScript

## Objective

Bootstrap a clean Next.js 14 App Router project with TypeScript and Tailwind CSS as the foundation for OrderFlow. Create the directory structure and base configuration.

## Context

<read_first>
- .planning/phases/01-project-setup-supabase-schema/01-CONTEXT.md (all decisions)
- AGENTS.md (full spec)
- .planning/PROJECT.md
</read_first>

## Tasks

### Task 1.1: Initialize Next.js 14 App

<action>
Run the following command to create the Next.js project in the current directory:

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

Answer prompts: Yes to TypeScript, Yes to ESLint, Yes to Tailwind, Yes to App Router, No to src/ directory, `@/*` for import alias.

After creation, verify:
- `package.json` contains `"next": "14` (or latest v14)
- `app/` directory exists with `layout.tsx` and `page.tsx`
- `tailwind.config.ts` exists
</action>

<acceptance_criteria>
- package.json contains `"next":` in dependencies
- `app/layout.tsx` file exists
- `app/globals.css` file exists
- `tailwind.config.ts` file exists
- `tsconfig.json` file exists with `paths: { "@/*": ["./"] }`
</acceptance_criteria>

---

### Task 1.2: Set Up Project Directory Structure

<action>
Create the required directory structure for OrderFlow:

```bash
mkdir -p app/(auth)
mkdir -p app/(dashboard)
mkdir -p components/ui
mkdir -p lib/supabase
mkdir -p lib/supabase/queries
mkdir -p hooks
mkdir -p types
```

Create placeholder files to establish structure:
- `types/.gitkeep`
- `hooks/.gitkeep`

Create `lib/supabase/queries/orders.ts` as empty module:
```typescript
// Order queries — implemented in Phase 3
export {};
```

Create `lib/supabase/queries/categories.ts` as empty module:
```typescript
// Category queries — implemented in Phase 4-5
export {};
```
</action>

<acceptance_criteria>
- `app/(auth)/` directory exists
- `app/(dashboard)/` directory exists
- `components/ui/` directory exists
- `lib/supabase/` directory exists
- `lib/supabase/queries/` directory exists
- `hooks/` directory exists
- `types/` directory exists
</acceptance_criteria>

---

### Task 1.3: Configure Tailwind for OrderFlow

<action>
Update `tailwind.config.ts` to add OrderFlow content paths and basic theme extensions:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Status colors — will be polished with OKLCH in Phase 7
        pending: {
          50: "#fffbeb",
          500: "#f59e0b",
          600: "#d97706",
        },
        progress: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
        },
        packing: {
          50: "#faf5ff",
          500: "#a855f7",
          600: "#9333ea",
        },
        dispatched: {
          50: "#f0fdf4",
          500: "#22c55e",
          600: "#16a34a",
        },
      },
      screens: {
        xs: "390px",
      },
    },
  },
  plugins: [],
};

export default config;
```

Update `app/globals.css` to add CSS custom properties:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --min-tap-target: 44px;
}

* {
  box-sizing: border-box;
}

body {
  min-height: 100dvh;
  overflow-x: hidden;
}
```
</action>

<acceptance_criteria>
- `tailwind.config.ts` contains `pending`, `progress`, `packing`, `dispatched` color keys
- `app/globals.css` contains `@tailwind base` and `--min-tap-target: 44px`
</acceptance_criteria>

---

### Task 1.4: Update Root Layout

<action>
Update `app/layout.tsx` to set proper metadata and base structure:

```typescript
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OrderFlow",
  description: "Internal order management system",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```
</action>

<acceptance_criteria>
- `app/layout.tsx` contains `title: "OrderFlow"`
- `app/layout.tsx` contains `viewport` export with `maximumScale: 1`
- `app/layout.tsx` contains `userScalable: false`
</acceptance_criteria>

---

### Task 1.5: Create .gitignore and .env Files

<action>
Create `.env.local` (gitignored, empty template):
```bash
cat > .env.local << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
EOF
```

Create `.env.example` (committed, shows required vars):
```
# Supabase — get values from Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Ensure `.gitignore` includes `.env.local`:
```
.env.local
```
(Add to existing .gitignore if not already present)
</action>

<acceptance_criteria>
- `.env.local` file exists
- `.env.example` file exists with `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=`, `SUPABASE_SERVICE_ROLE_KEY=`
- `.gitignore` contains `.env.local`
</acceptance_criteria>

## Verification

```bash
# Verify Next.js installs and dev server starts
npm run dev
# Should start on localhost:3000 without errors

# Verify directory structure
ls app/ lib/ components/ hooks/ types/
```

## must_haves

- [ ] Next.js 14 project created with App Router, TypeScript, Tailwind
- [ ] All required directories exist
- [ ] `.env.example` documents all 3 required variables
- [ ] `npm run dev` starts without errors
