# Phase 8 — Sub-Orders Feature: Form UI, Status System & Smart Duplicate Detection

## Context Summary

This phase adds sub-order line items to the existing order system. The database (`order_items` table, RLS, Realtime) was completed in a prior Phase 1 extension. This phase covers all UI across the form, dashboard, and detail sheet. No further schema changes are needed.

**Core Mental Model (locked):** An order is an *envelope/container* — a named group of equal line items for a customer. Item 1's data lives on the `orders` row. Additional items live in `order_items`. Neither is more "parent" than the other; all items are equal peers.

---

## Area 1: Sub-Item Row Layout in the Form

### Decision: Collapsed accordion by default, expanded on tap

Sub-item rows render as compact summary cards. Tapping expands them to reveal all fields. This keeps the form scannable on mobile when multiple sub-items exist.

**Collapsed card shows:**
```
Item 2  —  100×50cm · Qty: 5 · Due: 15 Apr     ▼
```
Format: `{label} — {L}×{W}cm · Qty: {qty} · Due: {DD Mon}`
Fields are omitted from summary if empty (e.g., no dimensions → skip that part).

**Expanded card shows all fields:**
- Item label (editable text input)
- Date, Due Date, Dispatch Date (pre-filled from parent order dates, editable)
- Length, Width, Qty
- Status (own segmented control — same 4 options as main order)
- Description (textarea)
- Photo upload (camera/gallery, inline preview)
- Audio recording (same voice note UI as main form)
- Remove (×) button — top-right of expanded card

**Item label:** Auto-generated as "Item 2", "Item 3" etc. User can edit the label inline. If user clears it, it stays blank (not re-generated).

**Sub-item status:** Each sub-item has its own independent Status field. This is separate from Item 1's status (on the orders row). Item 1's status field is still in the main form section, relabeled contextually as "Item 1 Status" when sub-items exist.

---

## Area 2: "+ Add Item" Trigger & Ordering

### Decision: Full-width button above photo/audio section

The "+ Add Item" button is a full-width horizontal dashed-border button, positioned:
- Below all sub-item rows (if any exist)
- Above the main order's photo/audio attachment section
- Above the Save/Cancel buttons

**Date pre-fill on add:** When a new sub-item row is added, Date and Due Date are pre-filled from the parent order's values. All dates are editable.

**Reordering:** Sub-items are drag-to-reorder. Use touch-friendly drag handles (grip icon, ≥44px tap target) on the left side of each collapsed card. Order of `order_items` rows is determined by a `sort_order` integer column (already in the plan; needs to be added to the migration or handled client-side via array index on save).

> **Note for planner:** `order_items` does not currently have a `sort_order` column. Either add it via a small SQL migration or manage ordering entirely by re-saving all items on each submit (array index → position). Client-side ordering management on save is simpler and preferred.

---

## Area 3: Save Flow, Draft Auto-Save & Upload Guard

### Decision: All-or-nothing atomic save

Save sequence:
1. Validate all required fields across ALL items (including sub-items)
2. If any photo/audio is still uploading → block save, show toast: *"A photo or voice note is still uploading. Please wait a moment and try again."*
3. `upsert` the `orders` row (Item 1 status, dates, dimensions etc.)
4. Delete any `order_items` rows that were removed from the form
5. Upsert remaining `order_items` in order (position = array index)
6. If any step fails → show toast error, do NOT close the form
7. On success → close form (Realtime propagates changes to all clients)

### Decision: localStorage draft auto-save

- Auto-save interval: every 3 seconds while user is actively typing
- Draft key: `orderflow_draft_new` (new order) or `orderflow_draft_{orderId}` (edit)
- Saved state: full form state including all sub-item rows
- On form open: check localStorage for existing draft
  - If draft found → show inline banner: *"You have an unsaved draft from [time]. Restore it?"* with [Restore] [Discard] buttons
  - If no draft → initialize normally
- On successful save → clear the draft key from localStorage
- On form close (cancel) → leave draft in localStorage (user may have closed by accident)

---

## Area 4: Smart Duplicate Order No Detection

### Decision: Intercept duplicate error, offer "Add as Sub-Item"

When submit returns a unique constraint violation on `order_no`:

1. Look up the existing order with that `order_no` via Supabase query
2. **If same customer name:** Show inline confirmation dialog (not a browser alert):
   > *"Order #1001 for XYZ Customer already exists.*
   > *Want to add this as a new item to that order instead?"*
   > [ Add as Sub-Item ]   [ Change Order No ]
3. **If different customer:** Show toast: *"Order No 1001 is already used by a different customer. Please use a different Order No."*

**"Add as Sub-Item" action:** Takes all the data the user typed in the current form (dates, L/W/qty, description, status, photo path, audio path) and creates a new `order_items` row linked to the existing order. Then closes the form. User never has to find the order manually.

---

## Area 5: Status System — Complete Specification

### Per-Item Status (Form)
Every item (Item 1 on `orders` row + each `order_items` row) has its own `status` field. Standard 4 options: Pending / In Progress / Packing / Dispatched.

### Dashboard Card — Status Display

**Case A — No sub-items (all existing orders):**
Single status badge — identical to today. Zero change.

**Case B — All items share the same status:**
Single status badge + subtle count indicator:
```
[ ● Dispatched · All 3 ]
```

**Case C — Mixed statuses:**
Row of colored dots with counts:
```
🟡3  🔵2  🟢1  · 6 items
```
- 🟡 amber = Pending
- 🔵 cerulean = In Progress
- 🟣 purple/fuchsia = Packing
- 🟢 emerald = Dispatched

On **hover (desktop) / press-and-hold (mobile):** Show mini vertical tooltip:
```
Pending       · 3
In Progress   · 2
Dispatched    · 1
```

**Quick-status-change on card (tapping the badge):**
- Single-item order → works exactly as today (tap badge → pick status)
- Multi-item order → dots are display-only; tapping the card body opens the detail sheet to change individual item statuses

### Status Summary Cards (Top of Dashboard) — Reworked

Cards count **individual items** (not orders). Each item from `orders` and each row from `order_items` contributes 1 to its status count.

Example: Order #1001 with 3 items (1 Pending, 1 In Progress, 1 Dispatched) contributes 1 to each of the three cards.

**Tapping a status card:** Filters the order list to show all orders that have **at least one item** in that status. (Not order-level status matching — item-level.)

### Detail Sheet — Status Breakdown

Below the order information, show a summary footer:
```
Total Qty: 13  across 3 items
Pending: 5 ·  In Progress: 3 ·  Dispatched: 5
```
The breakdown shows **qty summed by status** (pieces/units), not item count. This is the most useful for manufacturing context ("how many pieces are still pending dispatch").

---

## Code Context

### Files to modify (Phase 8)
- `components/dashboard/order-form-sheet.tsx` — major rewrite; add sub-item accordion, draft autosave, smart duplicate detection
- `components/dashboard/order-detail-sheet.tsx` — add sub-items section, status breakdown footer
- `components/dashboard/order-card.tsx` — computed status display (badge / dots / tooltip)
- `components/dashboard/status-cards.tsx` — recount logic (items not orders)
- `app/(dashboard)/dashboard/DashboardClient.tsx` — pass item data through, update filter logic for status cards
- `hooks/useOrders.ts` — already fetches `order_items(*)`, already has Realtime on `order_items` ✅

### Key design patterns to follow
- Bottom sheet via `<Drawer>` component (`components/ui/drawer.tsx`)
- Button variants: `variant="secondary"`, `variant="ghost"`, `variant="danger"` (`components/ui/button.tsx`)
- Status badge: `<Badge status={...}>` (`components/ui/badge.tsx`)
- OKLCH status color vars: `--status-pending`, `--status-progress`, `--status-packing`, `--status-dispatched` (in `globals.css`)
- Semantic tokens: `text-foreground`, `bg-card`, `bg-muted`, `border-border`, `text-muted-foreground`
- Animations: `animate-in slide-in-from-top-2 fade-in duration-200` (existing pattern for conditional fields)
- All interactive elements: `min-tap` class (44×44px minimum touch target)
- Toast: `toast.error(...)` / `toast.success(...)` via `react-hot-toast`
- Supabase client: `useState(() => createClient())` pattern (stable reference)

### Impeccable design rules (from `.impeccable.md`)
- Font: Plus Jakarta Sans — use fluid type scale (`clamp()`) and weight hierarchy
- Colors: OKLCH only — use existing CSS variables, no hardcoded hex
- No glassmorphism, no gradient text, no excessive shadows
- Tap targets ≥ 44px everywhere
- Collapsed sub-item cards: use `grid-template-rows` transition for height animation (not `height` directly)
- Drag handles: visible enough to be discovered, not decorative noise
- Tooltip on dots: appear via CSS `:hover` + JS `touchstart`/`touchend` for mobile


### sort_order handling
Manage ordering client-side only. On save, upsert `order_items` with `sort_order = arrayIndex`. No additional SQL migration needed.

### localStorage draft schema
```typescript
interface OrderFormDraft {
  version: 1;
  savedAt: string; // ISO timestamp
  orderNo: string;
  customerName: string;
  categoryId: string;
  date: string;
  dueDate: string;
  dispatchDate: string;
  length: string;
  width: string;
  qty: string;
  status: OrderStatus;
  description: string;
  photoPath: string | null;
  audioPath: string | null;
  subItems: SubItemDraft[];
}

interface SubItemDraft {
  tempId: string; // client-side UUID for keying
  dbId: string | null; // null for new items, existing ID for saved items
  itemLabel: string;
  date: string;
  dueDate: string;
  dispatchDate: string;
  length: string;
  width: string;
  qty: string;
  status: OrderStatus;
  description: string;
  photoPath: string | null;
  audioPath: string | null;
}
```
