# OrderFlow — Claude Code Handoff

> Migrated from Antigravity → Claude Code on 2026-04-30.
> Read this before doing anything. It will save you from false starts.

---

## TL;DR — Where We Are

The app is **fully built and production-deployed**. All 7 original GSD phases are **complete**. Several additional features have been added beyond the original roadmap. The `.planning/STATE.md` file is **out of date** (still shows Phase 1 / Not Started) — ignore it and use this document instead.

**Current git HEAD:** `5b76116` — "fixed the sign-out button, list-view in mobile and added colored status in exported pdf&png"

---

## ✅ Completed Work

### Original 7 Phases — ALL DONE

| Phase | Name | Status |
|-------|------|--------|
| 1 | Project Setup + Supabase Schema | ✅ Complete |
| 2 | Auth | ✅ Complete |
| 3 | Dashboard Skeleton + Realtime | ✅ Complete |
| 4 | Order Detail + Add/Edit Form | ✅ Complete |
| 5 | Category Management | ✅ Complete |
| 6 | PDF + PNG Export | ✅ Complete |
| 7 | UI Polish (Impeccable) | ✅ Complete |

### Additional Features Built Beyond Original Roadmap

These were all built in subsequent sessions **after** the original 7 phases:

1. **Sub-orders feature** — Built (Phase 8), then **surgically removed** by user request. The `order_items` table was dropped, `order_no` uniqueness constraint was also removed (allows duplicate order numbers per user preference).

2. **Google Sheets Bi-Directional Sync** — Full two-way sync between Supabase orders table and a Google Sheet. Lives in `google-sheets-sync/Code.gs` (Google Apps Script).

3. **Dimensions: CM → Inches** — All dimension fields migrated from numeric CM to text-based inch format (e.g., `33"1`). Legacy DB data migrated.

4. **Search Autocomplete** — Customer name search with autocomplete in filter bar.

5. **Bulk Add Spreadsheet** — `components/dashboard/bulk-order-sheet.tsx` — allows pasting data from a spreadsheet to bulk-add orders.

6. **Multi-select Mode** — Select multiple orders, bulk delete with confirmation dialog.

7. **Attachment Indicators** — Visual indicators on order cards showing if a photo is attached.

8. **PDF + PNG Export Overhaul** — Color-coded status visualization in exports, new column structure with dimensions, standardized inch display.

9. **PWA Installation** — Custom "Install App" button in user settings, PWA manifest configured.

10. **Mobile UX Fixes** — Sign-out button feedback, date + dimension columns always visible in mobile list view.

---

## 🏗️ What We're Currently Working On

**Nothing is in progress.** The last session (b0e797d0) resolved these final UX issues:
- ✅ Sign-out button interactive feedback
- ✅ Date and dimension columns always visible in mobile list view
- ✅ Color-coded status in PDF/PNG exports
- ✅ PWA "Install App" button in user settings

The app is in a **clean, stable, production-ready state**.

---

## 🎯 What to Do Next

There is no mandatory next step — the original v1 milestone is complete. Possible next work:
1. **Milestone audit** — Run `/gsd-audit-milestone` to formally close Milestone 1
2. **Milestone 2 planning** — Start `/gsd-new-milestone` to plan v2 features
3. **Ongoing maintenance** — Bug fixes, UX tweaks as discovered

> **If you're unsure, ask the user what they want to do next.** Don't assume.

---

## 🔑 Environment Variables

Create `.env.local` in the project root with these values:

```env
# Supabase — get values from Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=https://eszktnsfpoqvbybtmxft.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzemt0bnNmcG9xdmJ5YnRteGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4OTM5MTMsImV4cCI6MjA4OTQ2OTkxM30.CHWKk96ZWW2Jc2gNaqxbchDiqOKzJgOpb_hXzfa2VVE
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzemt0bnNmcG9xdmJ5YnRteGZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg5MzkxMywiZXhwIjoyMDg5NDY5OTEzfQ.gNfX84vcyz8MUNtghKoaWmRpS0TdgRxxd8g1TXh82K0
```

> **Security note:** These are already committed in `.env.local` (which is gitignored). No action needed — just don't commit these values.

---

## 🗂️ Key Files & Structure

```
/app/(auth)/login/          Login page
/app/(dashboard)/dashboard/ Dashboard (main screen)
/components/dashboard/      All dashboard UI components
  ├── filter-bar.tsx         Sticky search/filter bar
  ├── order-card.tsx         Order list cards
  ├── order-detail-sheet.tsx Bottom sheet for order details
  ├── order-form-sheet.tsx   Add/Edit order form
  ├── settings-drawer.tsx    User settings + category mgmt + PWA install
  ├── status-cards.tsx       4 status summary cards
  └── bulk-order-sheet.tsx   Bulk paste-in order creation
/components/ui/             shadcn/21st.dev primitives
/lib/                       Supabase clients, PDF/PNG export, helpers
/hooks/                     useOrders, useRealtime, etc.
/types/                     TypeScript definitions
/google-sheets-sync/Code.gs Google Apps Script for Sheets ↔ Supabase sync
/supabase/                  Supabase migrations
```

---

## ⚠️ Gotchas & Important Context

### 1. STATE.md is Stale — Don't Trust It
`.planning/STATE.md` shows "Phase 1 / Not Started". This is completely wrong. The full app is built. Use this HANDOFF.md and the git log for truth.

### 2. Sub-Orders Were Removed
Phase 08 built a sub-orders feature (order items with their own status, drag-to-reorder, etc.). The user then decided to **remove it entirely**. The `order_items` table no longer exists. If you see references to sub-orders or `order_items` anywhere in old plan files, they are obsolete.

### 3. Dimensions Are Text, Not Numeric
Dimensions (length/width) are stored as **text** in the format `33"1` (meaning 33 inches, 1/something). They are NOT numeric. Do not attempt to do math on them or convert them.

### 4. `order_no` Is NOT Unique
The original schema had `order_no` as unique. This constraint was **removed** by user request to allow duplicate order numbers.

### 5. Google Sheets Sync Is Separate Infrastructure
The `google-sheets-sync/Code.gs` file is a Google Apps Script — it runs in Google Workspace, not in this Next.js app. It reads from Supabase via REST API and syncs to a Google Sheet. It is NOT a Next.js API route.

### 6. PWA Is Configured
The app has a PWA manifest (`/app/manifest.ts`). The "Install App" button lives inside the settings drawer and uses the browser's `beforeinstallprompt` event.

### 7. Dark Mode Is Fully Supported
Despite the original spec saying "no dark mode initially", dark mode was implemented during the UI polish phase. The `.impeccable.md` design context confirms this.

### 8. Admin User Setup
The first admin must sign up via the app, then **manually** set `role = 'admin'` in the Supabase dashboard → Table Editor → `profiles` table. This is the only way to create an admin account.

---

## 🛠️ Tech Stack (Actual, Not Original Plan)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) |
| Styling | Tailwind CSS |
| Components | shadcn/ui + 21st.dev components |
| PDF Export | jsPDF (implemented) |
| PNG Export | html2canvas (implemented) |
| Sheets Sync | Google Apps Script (Code.gs) |
| Font | DM Sans (not Inter/Roboto — Impeccable rule) |
| Colors | OKLCH for status palette |

---

## 🚀 Running Locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## 📋 GSD Workflow Reference (for Claude Code)

GSD is now installed in `.claude/` (Claude Code's expected location).
Impeccable skills are in `.claude/skills/`.
Use these commands going forward:

```
/gsd-progress          — Check current state
/gsd-audit-milestone   — Audit Milestone 1 before closing
/gsd-complete-milestone — Archive completed milestone
/gsd-new-milestone     — Start planning Milestone 2 (v2)
/gsd-discuss-phase     — Gather context before planning a phase
/gsd-plan-phase        — Create detailed phase plan
/gsd-execute-phase     — Execute planned work
/gsd-verify-work       — UAT checkpoint
/audit                 — Impeccable design audit
/polish                — Impeccable polish pass
```

---

*Generated: 2026-04-30 | Migration: Antigravity → Claude Code*
