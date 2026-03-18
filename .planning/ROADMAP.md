# OrderFlow — Roadmap

## Milestone 1: v1 Launch

**7 phases** | **31 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|-----------------|
| 1 | Project Setup + Supabase Schema | Foundation infrastructure | AUTH-05, AUTH-06, AUTH-07 (RLS) | 3 |
| 2 | Auth | Login, session, roles, routing | AUTH-01–07 | 4 |
| 3 | Dashboard + Realtime | Core UI + live data | DASH-01–09, RT-01 | 5 |
| 4 | Order Detail + Add/Edit Form | Full order CRUD + photo | ORD-01–11 | 5 |
| 5 | Category Management | Admin category CRUD | CAT-01–05 | 3 |
| 6 | PDF Export | Export filtered orders | PDF-01–05 | 3 |
| 7 | UI Polish (Impeccable) | Production-grade mobile UI | All UI | 4 |

---

## Phase 1: Project Setup + Supabase Schema

**Goal:** Working Next.js app connected to Supabase with schema, RLS, storage, and typed client

**Requirements:** AUTH-05 (role enforcement via RLS), AUTH-06, AUTH-07

**Plans:**
1. Initialize Next.js 14 project with Tailwind and TypeScript
2. Configure Supabase: run schema SQL, enable RLS, create storage bucket
3. Set up typed Supabase client and environment variables

**Success Criteria:**
1. `npm run dev` starts without errors
2. Supabase tables exist with RLS preventing viewer from writing
3. `order-photos` bucket accessible with correct permissions
4. `.env.example` documents all required variables
5. README.md includes setup SQL and first-admin instructions

---

## Phase 2: Auth

**Goal:** Secure login flow with role-based routing, all routes protected

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04

**Plans:**
1. Build /login page with 21st.dev components, inline error handling
2. Implement session management, role detection from profiles table
3. Apply route protection (middleware) and redirect logic

**Success Criteria:**
1. Admin and Viewer can log in with email/password
2. Invalid credentials show inline error (no browser alert)
3. Both roles redirect to /dashboard after login
4. Protected routes redirect unauthenticated users to /login
5. Server-side role check prevents viewers accessing admin routes

---

## Phase 3: Dashboard Skeleton + Realtime

**Goal:** Full-featured dashboard with filters, realtime, and order list

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08, DASH-09, RT-01

**Plans:**
1. Status summary cards (4 colors) with counts and tap-to-filter
2. Sticky filter bar (status dropdown, customer name search, category dropdown, clear)
3. Orders list with compact mobile cards
4. Supabase Realtime subscription on orders table
5. FAB (Admin only) and PDF Export button (top-right)

**Success Criteria:**
1. 4 status cards show correct counts and filter list on tap
2. Filter bar is sticky while scrolling
3. Order list shows correct fields per card
4. Dashboard updates without refresh when order added/changed (Realtime)
5. FAB visible only to Admin, PDF Export visible to all

---

## Phase 4: Order Detail + Add/Edit Form

**Goal:** Full order lifecycle — view detail, create, edit, photo upload

**Requirements:** ORD-01, ORD-02, ORD-03, ORD-04, ORD-05, ORD-06, ORD-07, ORD-08, ORD-09, ORD-10, ORD-11

**Plans:**
1. Order Detail bottom sheet with all fields + full-size photo tap
2. Add/Edit form with all fields, correct mobile input types, validation
3. Status segmented control (4 states)
4. Photo upload: camera/gallery chooser → Supabase Storage → inline preview
5. Inline "+ Add Category" link in category dropdown

**Success Criteria:**
1. Tapping order card opens bottom sheet with all field values
2. Photo tappable to full-size in detail sheet
3. FAB opens blank Add form; Edit button opens pre-filled Edit form
4. Photo upload works on mobile (camera/gallery) and shows preview
5. Form validation catches missing required fields with inline errors
6. Inline category add works without leaving the form

---

## Phase 5: Category Management

**Goal:** Admin CRUD for categories, live reflection in order form

**Requirements:** CAT-01, CAT-02, CAT-03, CAT-04, CAT-05

**Plans:**
1. Category management screen accessible from profile/settings menu
2. List + inline add + inline rename

**Success Criteria:**
1. Category management accessible from settings/profile menu
2. Admin can add a new category
3. Admin can rename an existing category
4. Changes reflect immediately in order form category dropdown

---

## Phase 6: PDF Export

**Goal:** Clean, printable PDF export of filtered orders

**Requirements:** PDF-01, PDF-02, PDF-03, PDF-04, PDF-05

**Plans:**
1. Choose and integrate PDF library (@react-pdf/renderer or jsPDF)
2. Implement export of currently visible orders with correct layout

**Success Criteria:**
1. Export button generates downloadable PDF
2. PDF contains correct header ("OrderFlow — Order Report" + date)
3. All required columns present
4. Page numbers appear in footer
5. Layout is clean/printable with no decorative elements

---

## Phase 7: UI Polish (Impeccable)

**Goal:** Production-grade, Impeccable-compliant mobile UI

**Requirements:** All UI requirements

**Plans:**
1. `/teach-impeccable` — establish design context
2. `/audit` on every page — generate issues report
3. `/polish`, `/typeset`, `/arrange` passes
4. Final mobile QA at 390px width

**Success Criteria:**
1. Typography uses non-default font with modular fluid scale
2. Status colors use OKLCH functions
3. All tap targets ≥ 44×44px
4. Zero horizontal scroll at 390px
5. /audit passes with no critical issues

---

## Milestone End
Run `/gsd:audit-milestone` → `/gsd:complete-milestone` after Phase 7.
