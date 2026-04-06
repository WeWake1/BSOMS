---
wave: 3
depends_on: [01-PLAN.md, 02-PLAN.md, 03-PLAN.md]
files_modified:
  - components/dashboard/order-card.tsx
  - components/dashboard/status-cards.tsx
  - components/dashboard/order-detail-sheet.tsx
  - app/(dashboard)/dashboard/DashboardClient.tsx
autonomous: false
---

# Plan 04 — Status Display: Cards, Dashboard Summary, Detail Sheet

## Objective

Update all display-side components to show the new per-item status system: computed aggregate badges on order cards, reworked status summary cards counting individual items, and the status breakdown footer in the order detail sheet.

## Context

Read `.planning/phases/08-sub-orders/01-CONTEXT.md` (Area 5: Status System) before implementing. Key rules:
- No sub-items → badge as today
- All same status → badge + "All N" label
- Mixed statuses → colored dots with counts + hover/hold tooltip
- Status summary cards count individual items (not orders)
- Detail sheet footer shows qty-sum by status

---

## Tasks

### Task 1 — Computed status utility in `lib/utils.ts`

<read_first>
- `lib/utils.ts` (full file — add alongside existing utilities)
- `types/database.ts` (OrderWithCategoryAndItems, OrderItem, OrderStatus)
- `app/globals.css` (CSS variable names: --status-pending, --status-progress, --status-packing, --status-dispatched)
</read_first>

<action>
Add these utility functions to `lib/utils.ts`:

```typescript
import type { OrderWithCategoryAndItems, OrderStatus } from '@/types/database';

/** All statuses in priority order (worst = most behind) */
const STATUS_PRIORITY: OrderStatus[] = ['Pending', 'In Progress', 'Packing', 'Dispatched'];

/** OKLCH CSS variable name for each status */
export const STATUS_CSS_VAR: Record<OrderStatus, string> = {
  'Pending':     'var(--status-pending)',
  'In Progress': 'var(--status-progress)',
  'Packing':     'var(--status-packing)',
  'Dispatched':  'var(--status-dispatched)',
};

/** Tailwind dot color class for each status (used for inline colored dots) */
export const STATUS_DOT_CLASS: Record<OrderStatus, string> = {
  'Pending':     'bg-[var(--status-pending)]',
  'In Progress': 'bg-[var(--status-progress)]',
  'Packing':     'bg-[var(--status-packing)]',
  'Dispatched':  'bg-[var(--status-dispatched)]',
};

export type ComputedStatus =
  | { kind: 'single'; status: OrderStatus }           // no sub-items
  | { kind: 'uniform'; status: OrderStatus; count: number } // all same
  | { kind: 'mixed'; counts: Record<OrderStatus, number>; total: number; worstStatus: OrderStatus };

/** Compute the display status for an order card from all its items */
export function computeOrderStatus(order: OrderWithCategoryAndItems): ComputedStatus {
  const items = order.order_items ?? [];

  if (items.length === 0) {
    return { kind: 'single', status: order.status };
  }

  // Collect all statuses: Item 1 (on orders row) + sub-items
  const allStatuses: OrderStatus[] = [order.status, ...items.map(i => i.status)];
  const total = allStatuses.length;

  const counts: Record<OrderStatus, number> = {
    'Pending': 0, 'In Progress': 0, 'Packing': 0, 'Dispatched': 0,
  };
  for (const s of allStatuses) counts[s]++;

  const unique = Object.entries(counts).filter(([, c]) => c > 0);
  if (unique.length === 1) {
    return { kind: 'uniform', status: unique[0][0] as OrderStatus, count: total };
  }

  // Find worst (furthest behind) status
  const worstStatus = STATUS_PRIORITY.find(s => counts[s] > 0) ?? 'Pending';
  return { kind: 'mixed', counts, total, worstStatus };
}

/** For status summary cards: count individual items across all orders */
export function countItemsByStatus(orders: OrderWithCategoryAndItems[]): Record<OrderStatus, number> {
  const totals: Record<OrderStatus, number> = {
    'Pending': 0, 'In Progress': 0, 'Packing': 0, 'Dispatched': 0,
  };
  for (const order of orders) {
    totals[order.status]++;
    for (const item of order.order_items ?? []) {
      totals[item.status]++;
    }
  }
  return totals;
}

/** Qty summed by status across all items in an order (for detail sheet) */
export function qtyByStatus(order: OrderWithCategoryAndItems): Partial<Record<OrderStatus, number>> {
  const result: Partial<Record<OrderStatus, number>> = {};
  const addQty = (status: OrderStatus, qty: number) => {
    result[status] = (result[status] ?? 0) + qty;
  };
  addQty(order.status, order.qty);
  for (const item of order.order_items ?? []) {
    addQty(item.status, item.qty);
  }
  return result;
}
```
</action>

<acceptance_criteria>
- `lib/utils.ts` exports `computeOrderStatus`, `countItemsByStatus`, `qtyByStatus`
- `lib/utils.ts` exports `STATUS_DOT_CLASS` record keyed by all 4 OrderStatus values
- `lib/utils.ts` exports `ComputedStatus` type with `kind: 'single' | 'uniform' | 'mixed'`
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 2 — Update `OrderCard` with computed status display

<read_first>
- `components/dashboard/order-card.tsx` (full file — 173 lines)
- `lib/utils.ts` (after Task 1 — computeOrderStatus, STATUS_DOT_CLASS)
- `types/database.ts` (OrderWithCategoryAndItems)
- `app/globals.css` (CSS variable names for status colors)
</read_first>

<action>
**1. Update import in `order-card.tsx`** — change `OrderWithCategory` to `OrderWithCategoryAndItems`:
```typescript
import type { OrderStatus, OrderWithCategoryAndItems } from '@/types/database';
import { computeOrderStatus, STATUS_DOT_CLASS } from '@/lib/utils';
```

**2. Update both `OrderCardProps` and `OrderListItem` props** — change `order: OrderWithCategory` to `order: OrderWithCategoryAndItems`.

**3. In `OrderCard` component**, replace the status badge section (currently ~lines 75–97) with computed status display:

```tsx
{/* Status display — computed from all items */}
{(() => {
  const computed = computeOrderStatus(order);

  if (computed.kind === 'single') {
    // Exactly as today — tap to change (admin) or read-only (viewer)
    return isAdmin && onStatusChange ? (
      <Select selectedKey={order.status} onSelectionChange={k => onStatusChange(k as any)} aria-label="Change Status">
        <SelectTrigger className="p-0 border-0 h-auto w-auto bg-transparent hover:bg-transparent data-[focus-visible]:ring-0 [&>svg]:hidden">
          <Badge status={order.status} className="whitespace-nowrap shadow-sm cursor-pointer hover:opacity-90 transition-opacity" />
        </SelectTrigger>
        <SelectPopover className="w-[140px]">
          <SelectListBox>
            {(['Pending','In Progress','Packing','Dispatched'] as OrderStatus[]).map(s => <SelectItem key={s} id={s}>{s}</SelectItem>)}
          </SelectListBox>
        </SelectPopover>
      </Select>
    ) : (
      <Badge status={order.status} className="whitespace-nowrap shadow-sm" />
    );
  }

  if (computed.kind === 'uniform') {
    return (
      <div className="flex items-center gap-1.5">
        <Badge status={computed.status} className="whitespace-nowrap shadow-sm" />
        <span className="text-[10px] font-bold text-muted-foreground">All {computed.count}</span>
      </div>
    );
  }

  // Mixed — colored dots with counts + hover/press tooltip
  const activeCounts = Object.entries(computed.counts).filter(([, c]) => c > 0) as [OrderStatus, number][];
  return (
    <div className="relative group">
      <div className="flex items-center gap-1.5 bg-muted rounded-full px-2.5 py-1.5 border border-border">
        {activeCounts.map(([status, count]) => (
          <div key={status} className="flex items-center gap-0.5">
            <div className={`w-2 h-2 rounded-full ${STATUS_DOT_CLASS[status]}`} />
            <span className="text-[10px] font-bold text-foreground">{count}</span>
          </div>
        ))}
        <span className="text-[10px] text-muted-foreground ml-0.5">· {computed.total}</span>
      </div>
      {/* Tooltip on hover (desktop) / press-and-hold (mobile via CSS active) */}
      <div className="absolute right-0 top-full mt-1.5 z-20 bg-card border border-border rounded-xl shadow-lg px-3 py-2 min-w-[140px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 group-active:opacity-100">
        {activeCounts.map(([status, count]) => (
          <div key={status} className="flex items-center justify-between gap-4 py-0.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${STATUS_DOT_CLASS[status]}`} />
              <span className="text-xs text-foreground font-medium">{status}</span>
            </div>
            <span className="text-xs font-bold text-foreground">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
})()}
```

**4. Update Qty display** in `OrderCard` to show total qty across all items:
```tsx
{/* Qty — sum of main order + all sub-items */}
{(() => {
  const totalQty = order.qty + (order.order_items ?? []).reduce((sum, i) => sum + i.qty, 0);
  const itemCount = (order.order_items ?? []).length;
  return (
    <div className="text-right">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Qty</p>
      <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 [color:var(--primary)] rounded-full font-bold text-sm transition-transform duration-150 group-hover:scale-105">
        {totalQty}
        {itemCount > 0 && <span className="text-[9px] font-semibold opacity-70">· {itemCount + 1} items</span>}
      </div>
    </div>
  );
})()}
```
</action>

<acceptance_criteria>
- `order-card.tsx` imports `computeOrderStatus`, `STATUS_DOT_CLASS` from `@/lib/utils`
- `order-card.tsx` prop type uses `OrderWithCategoryAndItems`
- `computeOrderStatus` result determines which of 3 badge variants renders
- Uniform case shows `Badge + "All N"` text
- Mixed case shows colored dot + count pairs inside rounded pill
- Mixed case has tooltip div with `group-hover:opacity-100` and `group-active:opacity-100`
- Qty section sums `order.qty + order_items.reduce(sum, i.qty)`
- Item count shown when `order_items.length > 0`
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 3 — Rework `StatusCards` to count individual items

<read_first>
- `components/dashboard/status-cards.tsx` (full file)
- `lib/utils.ts` (countItemsByStatus — added in Task 1)
- `types/database.ts` (OrderWithCategoryAndItems)
- `app/(dashboard)/dashboard/DashboardClient.tsx` — how StatusCards is called (what props it receives)
</read_first>

<action>
**1. Update `StatusCards` props** to accept `OrderWithCategoryAndItems[]` instead of pre-computed counts:

If `StatusCards` currently receives counts directly, change it to receive the full orders array and compute counts internally using `countItemsByStatus`. Or update the prop type to pass item-level counts from `DashboardClient`.

The preferred approach: pass counts computed by `countItemsByStatus` from `DashboardClient`. Update `DashboardClient.tsx` to use:
```typescript
import { countItemsByStatus } from '@/lib/utils';
// ...
const itemCounts = useMemo(() => countItemsByStatus(orders), [orders]);
```
And pass `itemCounts` to `StatusCards` instead of order-level counts.

**2. Update the "tap to filter" behavior** in `DashboardClient` — when a status card is tapped, the filter should now show orders that have **at least one item** in that status:
```typescript
// In the filteredOrders useMemo, update status filter:
if (selectedStatus !== 'All') {
  filtered = filtered.filter(o => {
    const allStatuses = [o.status, ...(o.order_items ?? []).map(i => i.status)];
    return allStatuses.includes(selectedStatus);
  });
}
```

**3. Update the subtitle on each status card** (if shown). Change from "N orders" to "N items" in the card label or subtext.
</action>

<acceptance_criteria>
- `DashboardClient.tsx` imports and calls `countItemsByStatus(orders)`
- `StatusCards` receives item-level counts (not order-level)
- `filteredOrders` status filter uses `allStatuses.includes(selectedStatus)` logic
- `grep -n "countItemsByStatus\|allStatuses.includes" app/(dashboard)/dashboard/DashboardClient.tsx` shows both
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 4 — Add status breakdown to `OrderDetailSheet`

<read_first>
- `components/dashboard/order-detail-sheet.tsx` (full file — 245 lines)
- `lib/utils.ts` (qtyByStatus — added in Task 1)
- `types/database.ts` (OrderWithCategoryAndItems)
- `app/globals.css` (CSS vars for status colors)
</read_first>

<action>
In `order-detail-sheet.tsx`:

**1. Import `qtyByStatus` and `STATUS_DOT_CLASS`:**
```typescript
import { formatDate, qtyByStatus, STATUS_DOT_CLASS } from '@/lib/utils';
```

**2. Add sub-items section** in the detail JSX — show after the grid of date/dimension fields, before the description:

```tsx
{/* Sub-items list */}
{order.order_items && order.order_items.length > 0 && (
  <div className="flex flex-col gap-3 mt-1">
    <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">Items ({order.order_items.length + 1} total)</span>

    {/* Item 1 — from the orders row itself */}
    <div className="bg-muted rounded-xl p-3 border border-border">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-foreground">Item 1</span>
        <Badge status={order.status} className="text-[10px] px-2 py-0.5" />
      </div>
      {(order.length || order.width) && (
        <p className="text-xs text-muted-foreground">{order.length}×{order.width}cm · Qty: {order.qty}</p>
      )}
      {!order.length && !order.width && (
        <p className="text-xs text-muted-foreground">Qty: {order.qty}</p>
      )}
    </div>

    {/* Sub-items */}
    {order.order_items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((item, idx) => (
      <div key={item.id} className="bg-muted rounded-xl p-3 border border-border">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-foreground">{item.item_label || `Item ${idx + 2}`}</span>
          <Badge status={item.status} className="text-[10px] px-2 py-0.5" />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(item.length || item.width) && (
            <p className="text-xs text-muted-foreground">{item.length}×{item.width}cm · Qty: {item.qty}</p>
          )}
          {!item.length && !item.width && (
            <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
          )}
          <p className="text-xs text-muted-foreground">Due: {formatDate(item.due_date)}</p>
          {item.dispatch_date && <p className="text-xs text-muted-foreground">Dispatched: {formatDate(item.dispatch_date)}</p>}
        </div>
        {item.description && (
          <p className="text-xs text-foreground/80 mt-2 leading-relaxed">{item.description}</p>
        )}
      </div>
    ))}
  </div>
)}

{/* Total qty + status breakdown footer */}
{order.order_items && order.order_items.length > 0 && (() => {
  const totalQty = order.qty + order.order_items.reduce((s, i) => s + i.qty, 0);
  const byStatus = qtyByStatus(order);
  const activeStatuses = Object.entries(byStatus).filter(([, q]) => (q ?? 0) > 0) as [string, number][];
  return (
    <div className="bg-muted rounded-xl px-4 py-3 border border-border">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
        Total Qty: {totalQty} · {order.order_items.length + 1} items
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {activeStatuses.map(([status, qty]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${STATUS_DOT_CLASS[status as OrderStatus]}`} />
            <span className="text-xs font-semibold text-foreground">{status}: {qty}</span>
          </div>
        ))}
      </div>
    </div>
  );
})()}
```
</action>

<acceptance_criteria>
- `order-detail-sheet.tsx` imports `qtyByStatus`, `STATUS_DOT_CLASS` from `@/lib/utils`
- Detail sheet renders sub-items when `order.order_items.length > 0`
- Each sub-item shows its own `<Badge status={item.status}>` 
- Footer shows "Total Qty: N · M items"
- Footer shows qty breakdown per status with colored dot + label
- Sub-items sorted by `sort_order` before rendering
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

## Verification

```bash
npx tsc --noEmit
grep -n "computeOrderStatus\|countItemsByStatus\|qtyByStatus\|STATUS_DOT_CLASS" lib/utils.ts
grep -n "computeOrderStatus\|STATUS_DOT_CLASS" components/dashboard/order-card.tsx
grep -n "countItemsByStatus\|allStatuses.includes" app/\(dashboard\)/dashboard/DashboardClient.tsx
grep -n "qtyByStatus\|STATUS_DOT_CLASS\|sort_order" components/dashboard/order-detail-sheet.tsx
```

## must_haves

- Status utils (`computeOrderStatus`, `countItemsByStatus`, `qtyByStatus`) in `lib/utils.ts`
- Order card shows all 3 status variants (single, uniform+count, mixed dots)
- Mixed dot tooltip uses `group-hover:opacity-100` (CSS only, no JS)
- Status summary cards count individual items, not orders
- Dashboard filter uses `allStatuses.includes(status)` — at least 1 item matches
- Detail sheet shows sub-items list + qty-by-status footer
- Zero TypeScript errors
