---
status: testing
phase: 08-sub-orders
source:
  - .planning/phases/08-sub-orders/01-SUMMARY.md
  - .planning/phases/08-sub-orders/02-SUMMARY.md
  - .planning/phases/08-sub-orders/03-SUMMARY.md
  - .planning/phases/08-sub-orders/04-SUMMARY.md
started: 2026-04-08T09:47:00Z
updated: 2026-04-09T05:04:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Add a Sub-Item to an Order
expected: |
  Open the Add/Edit Order form. Below the Description field, there should
  be a dashed-border "+ Add Item" button. Tapping it adds a new collapsible
  item card beneath it, auto-expanded, with its own Label, Date, Due Date,
  Dimensions, Qty, Status, Description, Photo, and Voice Note fields.
  A counter badge "Additional Items (1)" appears above the list.
awaiting: user response

## Tests

### 1. Add a Sub-Item to an Order
expected: Open the Add/Edit Order form. The main order fields (Order No, Customer, Category, Dates, Dimensions, Qty, Status, Description, Reference Photo, Voice Note) are all grouped together first. Below them is a dashed-border "+ Add Item" button. Tapping it adds a new collapsible item card auto-expanded with a Category dropdown (not a text label), plus Date, Due Date, Dimensions, Qty, Status, Description, and side-by-side Photo + Voice Note buttons. A counter badge "Additional Items (1)" appears above the item list.
result: pending

### 2. Sub-Item Accordion Expand / Collapse
expected: Each sub-item card shows a collapsed summary row (item label, dimensions, due date, status badge, chevron). Tapping the row or chevron smoothly expands/collapses the full fields using a CSS grid-template-rows animation (no jump/snap). Collapsing one item while another is open works independently.
result: pending

### 3. Drag to Reorder Sub-Items
expected: Each sub-item card has a 6-dot drag handle on the left. Dragging a card up or down reorders its position in the list in real time. On mobile, a touch-drag on the handle also reorders.
result: pending

### 4. Draft Auto-Save & Restore Banner
expected: Open an order form and make changes (add a sub-item, edit a field). Close the form WITHOUT saving. Re-open the same form. A "Unsaved draft found" banner appears at the top with "Restore draft" and "Discard" buttons. Tapping "Restore draft" reloads all previous field values including sub-items. Tapping "Discard" starts fresh.
result: pending

### 5. Duplicate Order Detection — Add as Sub-Item
expected: Open the New Order form. Enter an Order No that already exists in the system, with the SAME customer name. Submit. Instead of a generic duplicate error, an inline dialog appears saying "Order #X for [Customer] already exists. Would you like to add this as a new item to that order instead?" with "Add as Sub-Item" and "Change Order No" buttons. Tapping "Add as Sub-Item" adds a new row to the existing order and closes the form.
result: pending

### 6. Save Order with Sub-Items (Atomic Save)
expected: Create or edit an order with 2+ sub-items. Hit save. All items appear correctly when you reopen the order detail (parent fields intact, sub-item label/status/due date visible). No partial saves — either all items save or none do.
result: pending

### 7. Status Cards Count Individual Items
expected: Create an order with a parent "Pending" status and one sub-item set to "In Progress". The dashboard status summary cards should count BOTH separately — Pending goes up by 1 (for the parent) AND In Progress goes up by 1 (for the sub-item). A plain order with no sub-items still counts as 1.
result: pending

### 8. Mixed Status Badge on Order Card
expected: An order that has sub-items with DIFFERENT statuses from each other (e.g. parent = Pending, sub-item = In Progress) should show a grey "Mixed" badge on its dashboard card instead of a single status colour. Small coloured dots appear below the badge showing which statuses are present (amber for Pending, blue for In Progress, etc.).
result: pending

### 9. Sub-Item Status Breakdown in Detail Sheet
expected: Tap an order card that has sub-items to open the detail sheet. Below the photo/audio section, an "Items (N total)" section lists every item as a row: a coloured dot, item label, due date, and individual status badge. The top badge also shows "Mixed" if statuses differ. Items are sorted by their saved order.
result: pending

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0

## Gaps

[none yet]
