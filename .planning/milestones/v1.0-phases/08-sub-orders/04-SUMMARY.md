---
phase: "08"
plan: "04"
subsystem: "status-display"
tags: [status, display, mixed-status, order-card, detail-sheet, dashboard]
provides:
  - getComputedStatus utility
  - getItemLevelCounts utility
  - getStatusDotClass utility
  - Mixed badge style in getStatusColor
  - Mixed-status dot row on OrderCard / OrderListItem
  - Sub-item status breakdown list in OrderDetailSheet
  - Item-level counts in StatusCards
affects:
  - lib/utils.ts
  - components/dashboard/order-card.tsx
  - components/dashboard/order-detail-sheet.tsx
  - app/(dashboard)/dashboard/DashboardClient.tsx
key-files:
  modified:
    - lib/utils.ts
    - components/dashboard/order-card.tsx
    - components/dashboard/order-detail-sheet.tsx
    - app/(dashboard)/dashboard/DashboardClient.tsx
key-decisions:
  - Mixed badge uses slate colour (neutral — distinct from all four statuses)
  - Status dots shown in canonical order (Pending/In Progress/Packing/Dispatched) not insertion order
  - Status card counts include parent + every sub-item individually
  - Sub-item breakdown uses getComputedStatus IIFE in JSX (hook rules safe)
  - sort_order used to sort sub-item rows in detail (nulls treated as 0)
duration: "12 min"
completed: "2026-04-08"
---

# Phase 08 Plan 04: Status Display Updates Summary

Item-level status system completed across all display surfaces: mixed-status badges, coloured dot indicators on cards, item-level counts on StatusCards, and sub-item status breakdown in the detail sheet.

**Duration:** 12 min | **Tasks:** 4 | **Files modified:** 4

## What Was Built

- `lib/utils.ts`: Added `Mixed` to `getStatusColor` (slate), `getStatusDotClass`, `getAllStatuses`, `getComputedStatus`, `getItemLevelCounts`
- `order-card.tsx`: Changed `OrderWithCategory` → `OrderWithCategoryAndItems`, added `isMixed` + `uniqueStatuses` + mixed badge + dot row below badge. `OrderListItem` also updated.
- `DashboardClient.tsx`: `counts` now computed with `getItemLevelCounts(orders)` (each item counted separately)
- `order-detail-sheet.tsx`: Top badge shows computed status (Mixed if items differ); new sub-item breakdown list shows parent row + each sub-item with colour dot, label, due date, badge; sorted by `sort_order`

## Deviations from Plan

None

## Self-Check: PASSED

- `getComputedStatus` returns 'Mixed' when parent + sub-items have > 1 unique status ✓
- `getItemLevelCounts` counts parent order status + each sub-item status ✓
- `getStatusDotClass` returns Tailwind bg class per status ✓
- Mixed badge shows slate colour ✓
- Dot row only renders when `isMixed && uniqueStatuses.length > 0` ✓
- Sub-item breakdown only renders when `order.order_items?.length > 0` ✓
- Sub-items sorted by `sort_order` (null-safe with ?? 0) ✓
- `npx tsc --noEmit` exits 0 ✓
- Commit: 4f5cac3 ✓
