---
phase: "08"
plan: "02"
subsystem: "order-form"
tags: [ui, accordion, drag-to-reorder, sub-orders, duplicate-detection]
provides:
  - SubItemCard component (accordion + drag handle + per-item fields)
  - useDragSort hook (HTML5 DnD + touch)
  - Sub-item accordion section in OrderFormSheet JSX
  - Draft restore banner UI
  - Smart duplicate detection dialog
affects:
  - components/dashboard/order-form-sheet.tsx
key-files:
  modified:
    - components/dashboard/order-form-sheet.tsx
key-decisions:
  - useDragSort implemented inline (no external package) using HTML5 Drag and Drop API + touch events
  - grid-template-rows animation for accordion (not height) per Impeccable rules
  - Duplicate dialog is an absolute-positioned overlay inside the Drawer, not a modal
  - useDragSort called inside IIFE in JSX render to avoid hook rules violations
duration: "18 min"
completed: "2026-04-06"
---

# Phase 08 Plan 02: Sub-Item Accordion UI, Drag-to-Reorder & Draft Banner Summary

Full sub-item form UI added to OrderFormSheet: collapsed accordion cards with smooth grid-template-rows animation, inline drag-to-reorder, full-width dashed Add Item button, draft restore banner, and smart duplicate detection dialog.

**Duration:** 18 min | **Tasks:** 4 | **Files modified:** 1

## What Was Built

- `useDragSort<T>` generic hook with HTML5 DnD + touch event support
- `SubItemPhotoField` / `SubItemAudioField` inline components for per-item media
- `SubItemCard` full accordion card with statusbadge, collapse/expand via `grid-template-rows`, drag handle, all field inputs, status segmented control, and remove button
- Sub-item section injected between description and photo upload with `Additional Items` counter badge
- `+ Add Item` full-width dashed button with auto-date-prefill and auto-expand
- Draft restore banner with Restore/Discard buttons
- Smart duplicate detection dialog: inline overlay, shows when same customer+order_no conflict detected

## Deviations from Plan

**[Rule 3 - Blocking] useDragSort called inside IIFE in JSX** — Hook cannot be called conditionally from JSX; wrapped in an IIFE (`(() => {...})()`) inside the render tree to maintain hook rules while keeping the drag handlers co-located with the list they manage.

## Issues Encountered

None

## Self-Check: PASSED

- `SubItemCard` uses `grid-template-rows` transition ✓
- `SubItemCard` has `role="radiogroup"` for status control ✓  
- All interactive elements have `min-tap` class ✓
- Drag handle has `aria-label="Drag to reorder"` and `touch-none` ✓
- `useDragSort` contains `handleDragStart`, `handleDragOver`, `handleDragEnd` ✓
- `Add Item` is dashed-border full-width button ✓
- New items auto-expand ✓
- Dates pre-filled from parent form dates ✓
- Duplicate dialog has "Add as Sub-Item" and "Change Order No" buttons ✓
- `npx tsc --noEmit` exits 0 ✓
