---
phase: "08"
plan: "03"
subsystem: "order-form"
tags: [save-flow, sub-orders, atomic-save, duplicate-detection, upload-guard]
provides:
  - Atomic sub-item save (order upsert + delete removed + upsert remaining with sort_order)
  - Upload guard before any DB calls
  - Smart duplicate detection: same customer → add as sub-item
  - sort_order migration SQL
affects:
  - components/dashboard/order-form-sheet.tsx
  - supabase/migration_order_items_sort_order.sql
key-files:
  created:
    - supabase/migration_order_items_sort_order.sql
  modified:
    - components/dashboard/order-form-sheet.tsx
key-decisions:
  - sort_order managed client-side (array index) not DB-driven; simpler, context says preferred
  - upsert with onConflict: 'id' handles both inserts and updates for sub-items
  - Upload guard checks all four uploading states before committing
duration: "15 min"
completed: "2026-04-06"
---

# Phase 08 Plan 03: Sub-Item Atomic Save Logic Summary

handleSubmit replaced with 5-step atomic save; sub-item photo/audio upload handlers added; sort_order migration created; smart duplicate detection integrated.

**Duration:** 15 min | **Tasks:** 2 | **Files modified:** 2

## What Was Built

- `handleSubItemPhotoUpload`, `handleSubItemPhotoRemove`, `handleSubItemAudioRecord`, `handleSubItemAudioDelete` — per-item media handlers tracking uploading state in Sets
- `handleSubmit` fully replaced with atomic save:
  1. Upload guard: blocks if any photo/audio still uploading
  2. Build order payload (trimmed fields, null description)
  3. Upsert order (insert new OR update existing)
  4. Delete removed sub-items (diff existingDbIds vs currentDbIds)
  5. Upsert sub-items with sort_order = array index
  - Smart duplicate: on unique violation, queries existing order, compares customer name (case-insensitive), sets `duplicateOrder`/`pendingSubItemData` for inline dialog
- `supabase/migration_order_items_sort_order.sql` created with `ADD COLUMN IF NOT EXISTS sort_order integer default 0`

## Deviations from Plan

None

## Issues Encountered

⚠️ **User action required:** Run `supabase/migration_order_items_sort_order.sql` in the Supabase SQL Editor before using the sub-order form (adds `sort_order` column to `order_items`).

## Self-Check: PASSED

- `handleSubmit` checks `subItemPhotoUploadingIds.size > 0` before DB calls ✓
- Upload guard toast shown when uploading ✓
- `.delete().in('id', removedIds)` for removed sub-items ✓
- `.upsert(itemsPayload, { onConflict: 'id' })` for sub-items ✓
- `sort_order: idx` in upsert payload ✓
- `clearDraft` called on success ✓
- `supabase/migration_order_items_sort_order.sql` contains `ADD COLUMN IF NOT EXISTS sort_order integer` ✓
- `npx tsc --noEmit` exits 0 ✓
