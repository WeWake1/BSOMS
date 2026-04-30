# OrderFlow — Agent Context & Build Spec

## STEP 1 — INSTALL TOOLS (Do this first, before anything else)

### Install GSD for Antigravity
Run this in the terminal from your project root:

  npx get-shit-done-cc --antigravity --local

This installs GSD into ./.agent/ which is Antigravity's local skills
directory. Verify it worked by checking that .agent/ folder exists with
GSD files inside.

### Install Impeccable
Run this in the terminal from your project root:

  npx skills add pbakaus/impeccable

This auto-detects Antigravity and places files into .agents/ correctly.
Verify by checking that .agents/skills/ contains Impeccable skill files.

Do NOT proceed to Step 2 until both tools are confirmed installed.

---

## STEP 2 — BEGIN THE BUILD (GSD Workflow)

Start with: /gsd:new-project (feed the full spec below as context)

For each phase follow this sequence exactly:
  /gsd:discuss-phase   ← Lock in preferences and resolve ambiguities
  /gsd:plan-phase      ← Research, plan, and verify approach
  /gsd:execute-phase   ← Parallel execution of planned work
  /gsd:verify-work     ← Manual UAT checkpoint before moving on

At end of each milestone: /gsd:audit-milestone → /gsd:complete-milestone

For UI/design-heavy phases, run Impeccable commands after execution:
  /audit               ← Check design against anti-patterns
  /polish              ← Refine details, spacing, motion
  /typeset             ← Fix typography issues
  /arrange             ← Fix layout and spacing issues

---

## PROJECT SPEC

### Project Name
OrderFlow — Internal Order Management System

### One-liner
A mobile-first internal tool for a manufacturing/fulfillment company
to track real-time status of all current orders, accessible by ~10 team
members from their phones at any time.

---

## TECH STACK

- Framework: Next.js 14 (App Router)
- Backend & Auth: Supabase (Postgres + Auth + Storage + Realtime)
- Hosting: Vercel
- Component Library: 21st.dev — use ready-made components from
  https://21st.dev wherever appropriate. Install components via:
  npx shadcn@latest add "https://21st.dev/[component-url]"
  Prefer 21st.dev for: Buttons, Inputs, Badges/Chips, Cards,
  Dropdowns, Bottom Sheets/Drawers, Toasts, Modals, FABs
- Styling: Tailwind CSS
- Design Polish: Impeccable (installed in Step 1 — use its commands
  after each UI phase, especially /audit and /polish)
- PDF Export: @react-pdf/renderer or jsPDF (choose cleaner fit)
- Image Upload: Supabase Storage

---

## ROLES & AUTH

Two roles:

1. Admin / Editor (1 person)
   - Full CRUD on orders
   - Can manage Categories (add/rename via UI)
   - Can invite and manage viewer accounts

2. Viewer (~10 people)
   - Read-only access to dashboard and all orders
   - Can filter and search but cannot modify anything

Auth: Supabase Auth with individual email + password per user.
Roles stored in a profiles table (role: 'admin' | 'viewer').
All route and API protection enforced server-side.
On login, both roles land on /dashboard.

---

## DATABASE SCHEMA

Table: orders
  id              uuid, primary key
  order_no        text, unique, required
  customer_name   text, required
  category_id     uuid, FK → categories.id, required
  date            date, required (order placed date)
  due_date        date, required
  dispatch_date   date, nullable (set when dispatched)
  length          numeric, nullable
  width           numeric, nullable
  qty             integer, required
  description     text, nullable
  photo_url       text, nullable (single image in Supabase Storage)
  status          enum: 'Pending' | 'In Progress' | 'Packing' | 'Dispatched'
                  default: 'Pending'
  created_at      timestamptz, default now()
  updated_at      timestamptz, auto-updated via trigger

Table: categories
  id              uuid, primary key
  name            text, unique, required
  created_at      timestamptz

Table: profiles
  id              uuid, FK → auth.users.id
  full_name       text
  role            text: 'admin' | 'viewer'

RLS (Row Level Security) — enable on all tables:
  - Viewers: SELECT only on orders and categories
  - Admin: full CRUD on orders and categories
  - All authenticated users: SELECT on profiles

Supabase Storage bucket: order-photos
  - Admin: can upload and delete
  - All authenticated users: can read/view

---

## PAGES & FEATURES

### /login
- Centered, mobile-first login form
- Email + password using 21st.dev input components
- Inline error messages (not browser alerts)
- On success → redirect to /dashboard

### /dashboard ← MOST IMPORTANT SCREEN
Design goal: A user must understand the full state of all orders
within 3 seconds of opening the app on their phone.

- Top section: 4 status summary cards (tap to filter the list):
    Pending     → amber/yellow
    In Progress → blue
    Packing     → purple
    Dispatched  → green
  Each card shows the count of orders in that status.

- Sticky filter bar below cards:
    Filter by Status (dropdown)
    Filter by Customer Name (text search)
    Filter by Category (dropdown)
    Clear Filters button

- Orders list: compact mobile cards per order showing:
    Order No, Customer Name, Category, Status badge, Due Date
  Tapping a card opens the Order Detail bottom sheet.

- Order Detail bottom sheet shows all fields:
    Order No, Customer Name, Category, Date, Due Date,
    Dispatch Date, Length, Width, Qty, Status, Description,
    Photo (tappable to view full size)

- FAB (Floating Action Button): fixed bottom-right, always visible,
  labeled "+ Add Order", opens Add/Edit Order form.
  Visible to Admin only. Viewers do not see it.

- PDF Export button: top-right of dashboard. Exports currently
  visible orders (respects active filters).

- Realtime: Subscribe to Supabase Realtime on the orders table.
  Dashboard updates automatically without refresh when any order
  is added or changed. Non-negotiable — all 10 viewers must always
  see the current live state.

### Add / Edit Order Form
- Opened via FAB (new) or Edit button in detail sheet (admin only)
- Large touch targets, correct mobile input types throughout
- Fields in this order:
    1.  Order No (text)
    2.  Customer Name (text)
    3.  Category (dropdown from categories table)
        Admin sees inline "+ Add Category" link
    4.  Date (date picker)
    5.  Due Date (date picker)
    6.  Dispatch Date (date picker, optional)
    7.  Length (number)
    8.  Width (number)
    9.  Qty (number)
    10. Status (segmented control or large dropdown):
          Pending | In Progress | Packing | Dispatched
    11. Description (textarea)
    12. Photo Attachment:
          Single image only
          On mobile: opens camera or gallery chooser
          Inline preview after selection
          Stored in Supabase Storage (order-photos bucket)
          In detail view: tappable to view full size

### Category Management (Admin only)
- Accessible from profile/settings menu
- List of existing categories
- Inline add new category
- Inline rename existing category
- Changes reflect immediately in the order form dropdown

### PDF Export
- Triggered by Export PDF button on dashboard
- Exports all orders currently visible (filtered or unfiltered)
- Layout:
    Header: "OrderFlow — Order Report" + export date
    Columns: Order No, Customer Name, Category, Status,
             Date, Due Date, Dispatch Date, Qty, Description
    Status as plain text label (no colour needed)
    Page numbers in footer
    Clean, simple, printable — no decorative elements

---

## MOBILE-FIRST DESIGN RULES

Design for 390px width first (iPhone 14). Scale up for tablet/desktop.

- Bottom sheets for detail views and forms (not full-page navigation)
- FAB fixed bottom-right for primary action
- Sticky filter bar always visible while scrolling
- Minimum tap target: 44×44px on ALL interactive elements
- Zero horizontal scroll anywhere in the app
- Status badges: large enough, high contrast, instantly readable
- No pagination (order count expected under 100 at any time)
- No dark mode needed initially

Impeccable design rules — enforce during all UI phases:
  DO: Use a modular type scale with fluid sizing (clamp())
  DO: Use OKLCH color functions for the status colour palette
  DO: Tint neutrals toward the brand hue
  DO: Vary font weights and sizes for clear visual hierarchy
  DO NOT: Use Inter, Roboto, Arial, or system default fonts
  DO NOT: Use gray text on coloured backgrounds
  DO NOT: Use pure #000 or #fff — always tint
  DO NOT: Cards nested inside cards
  DO NOT: Large rounded icons above every heading

Run /teach-impeccable before Phase 7.
Run /audit and /polish after completing every UI phase.

---

## PROJECT STRUCTURE

  /app                  Next.js App Router pages and layouts
  /components           Reusable UI components
  /components/ui        21st.dev and base UI primitives
  /lib                  Supabase client, helpers, PDF generator
  /lib/supabase         Typed Supabase queries per entity
  /hooks                Custom React hooks (useOrders, useRealtime, etc.)
  /types                TypeScript type definitions

Include:
  .env.example          All required environment variables documented
  README.md             Supabase setup SQL, how to create first admin
                        user (set role = 'admin' in profiles table
                        via Supabase dashboard), Vercel deploy steps

---

## ENVIRONMENT VARIABLES

  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY     (server-side only)

---

## BUILD ORDER (GSD Phases)

Phase 1 — Project setup + Supabase schema
  Configure Tailwind, run Supabase SQL, set up RLS, configure
  Storage bucket, set up typed Supabase client, .env.example

Phase 2 — Auth
  Login page, session handling, role detection, route protection,
  redirect logic for admin vs viewer

Phase 3 — Dashboard skeleton + Realtime
  Status summary cards, order list, sticky filter bar,
  Supabase Realtime subscription, all filter logic

Phase 4 — Order Detail + Add/Edit Form
  Bottom sheet for detail view, FAB, full form with all fields,
  photo upload to Supabase Storage, category inline-add

Phase 5 — Category Management
  Settings/profile menu, category CRUD, live reflection in dropdown

Phase 6 — PDF Export
  Export button, filtered list → PDF, clean printable layout

Phase 7 — UI Polish (Impeccable phase)
  Run /teach-impeccable first, then /audit on every page,
  then /polish, /typeset, /arrange as needed.
  Apply 21st.dev component upgrades wherever generic elements remain.
  Final mobile QA at 390px width.

---

## CRITICAL REMINDERS

- Follow GSD strictly: /gsd:discuss-phase → /gsd:plan-phase →
  /gsd:execute-phase → /gsd:verify-work for every phase.
  Do not skip discuss or verify steps.

- Run /teach-impeccable before Phase 7. Use /audit and /polish
  after every UI phase, not just at the end.

- Install 21st.dev components via:
  npx shadcn@latest add "https://21st.dev/[url]"
  Do not build from scratch what 21st.dev already provides.

- The first admin user: sign up via the app, then manually set
  role = 'admin' in the profiles table in Supabase dashboard.
  Document this clearly in README.md.

- Supabase Realtime is non-negotiable.

- No pagination. Keep the list simple and fast.