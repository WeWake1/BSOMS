# OrderFlow

## Overview

**What:** An internal order management system for a manufacturing/fulfillment company. Enables ~10 team members to track real-time status of all current orders from their phones at any time.

**Who:** Two roles — one Admin/Editor with full CRUD access, and ~10 Viewers with read-only access. All access via individual email/password accounts.

**Core Value:** Team members can open the app on their phone and understand the full state of all orders within 3 seconds.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Backend & Auth | Supabase (Postgres + Auth + Storage + Realtime) |
| Hosting | Vercel |
| Components | 21st.dev (shadcn-compatible) |
| Styling | Tailwind CSS |
| PDF Export | @react-pdf/renderer or jsPDF |
| Image Upload | Supabase Storage |
| Design Polish | Impeccable |

## Roles & Auth

- **Admin/Editor (1 person):** Full CRUD on orders, category management, invite viewers
- **Viewer (~10 people):** Read-only — filter/search, no modify
- Auth: Supabase Auth (email + password)
- Roles stored in `profiles` table (`role: 'admin' | 'viewer'`)
- Both roles land on `/dashboard` on login

## Database Schema

### orders
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| order_no | text | unique, required |
| customer_name | text | required |
| category_id | uuid | FK → categories.id |
| date | date | order placed date |
| due_date | date | required |
| dispatch_date | date | nullable |
| length | numeric | nullable |
| width | numeric | nullable |
| qty | integer | required |
| description | text | nullable |
| photo_url | text | nullable |
| status | enum | 'Pending' \| 'In Progress' \| 'Packing' \| 'Dispatched' |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | auto-updated via trigger |

### categories
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | unique, required |
| created_at | timestamptz | — |

### profiles
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | FK → auth.users.id |
| full_name | text | — |
| role | text | 'admin' \| 'viewer' |

## RLS Policy Summary
- Viewers: SELECT only on orders and categories
- Admin: full CRUD on orders and categories
- All authenticated users: SELECT on profiles
- Supabase Storage bucket `order-photos`: Admin uploads/deletes, all auth users can read

## Pages & Features

### /login
- Centered, mobile-first login form
- Email + password (21st.dev input components)
- Inline error messages, redirect to /dashboard on success

### /dashboard (Most Important)
- **4 status cards** (Pending=amber, In Progress=blue, Packing=purple, Dispatched=green) — tap to filter
- **Sticky filter bar:** filter by Status, Customer Name (text), Category; Clear Filters button
- **Orders list:** compact mobile cards (Order No, Customer Name, Category, Status badge, Due Date)
- **Order Detail:** bottom sheet with all fields + tappable photo
- **FAB:** "+ Add Order" fixed bottom-right, Admin only
- **PDF Export:** top-right button, exports currently visible orders
- **Realtime:** Supabase Realtime subscription — live updates without refresh

### Add/Edit Order Form
- Opened via FAB (new) or Edit button in detail sheet (Admin only)
- All fields with correct mobile input types
- Photo: single image, camera/gallery chooser on mobile, inline preview
- Status: segmented control (Pending | In Progress | Packing | Dispatched)
- Admin sees inline "+ Add Category" link in category dropdown

### Category Management (Admin only)
- Accessible from profile/settings menu
- List existing categories, inline add, inline rename

### PDF Export
- Header: "OrderFlow — Order Report" + export date
- Columns: Order No, Customer Name, Category, Status, Date, Due Date, Dispatch Date, Qty, Description
- Page numbers in footer, clean printable layout

## Mobile-First Design Rules
- Design for 390px (iPhone 14) first
- Bottom sheets for detail/forms (not full-page navigation)
- FAB fixed bottom-right
- Sticky filter bar
- Minimum 44×44px tap targets
- Zero horizontal scroll
- No pagination (under 100 orders expected)
- No dark mode initially
- Font: NOT Inter/Roboto/Arial/system defaults
- Colors: OKLCH functions for status palette, tinted neutrals, no pure #000/#fff

## Project Structure

```
/app                  Next.js App Router pages and layouts
/components           Reusable UI components
/components/ui        21st.dev and base UI primitives
/lib                  Supabase client, helpers, PDF generator
/lib/supabase         Typed Supabase queries per entity
/hooks                Custom React hooks
/types                TypeScript type definitions
```

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 14 App Router | Established in spec | ✓ |
| Supabase for all backend | Auth + DB + Storage + Realtime in one | ✓ |
| 21st.dev components | Premium mobile-friendly UI out of box | ✓ |
| Realtime non-negotiable | All 10 viewers must see live state | ✓ |
| No pagination | Under 100 orders, keep list simple | ✓ |
| Role-based access in profiles table | Simple, Supabase-native approach | ✓ |

## Requirements

### Validated
(None yet — ship to validate)

### Active

**Auth**
- [ ] User can log in with email/password
- [ ] Session persists across page reloads
- [ ] Admin role and Viewer role enforced server-side
- [ ] Redirect to /dashboard on login

**Dashboard**
- [ ] Status summary cards with counts (Pending, In Progress, Packing, Dispatched)
- [ ] Tapping a status card filters the order list
- [ ] Sticky filter bar (status, customer name, category)
- [ ] Orders list renders as compact mobile cards
- [ ] Order detail opens in bottom sheet
- [ ] FAB visible to Admin only
- [ ] Dashboard updates in realtime without refresh

**Orders**
- [ ] Admin can create a new order with all fields
- [ ] Admin can edit an existing order
- [ ] Admin can upload a photo (stored in Supabase Storage)
- [ ] Photo is viewable full-size by tapping in detail sheet
- [ ] Status can be changed from the edit form
- [ ] Order list filtered/searched by status, customer name, category

**Categories**
- [ ] Admin can add a new category inline from the order form
- [ ] Admin can manage (add/rename) categories from settings menu
- [ ] Category dropdown in order form reflects current categories

**PDF Export**
- [ ] Export button generates PDF of currently visible orders
- [ ] PDF includes all required columns and page numbers

**Realtime**
- [ ] Dashboard auto-updates when any order is added or changed

### Out of Scope
- Dark mode — not needed initially
- Pagination — order count under 100
- OAuth/social login — email+password only
- Multiple photos per order — single image only
- Push notifications

---
*Last updated: 2026-03-18 after initialization*
