---
plan: 02
phase: 3
wave: 1
title: Dashboard UI Components
depends_on: []
files_modified:
  - components/ui/badge.tsx
  - components/dashboard/status-cards.tsx
  - components/dashboard/filter-bar.tsx
  - components/dashboard/order-card.tsx
autonomous: true
requirements_addressed: [DASH-01, DASH-02, DASH-03, DASH-04, DASH-05]
---

# Plan 02: Dashboard UI Components

## Objective

Build the UI components required for the Dashboard: Status Badges, Summary Cards (4 colors), Sticky Filter Bar, and the compact mobile Order Card.

## Context

<read_first>
- .planning/phases/03-dashboard-skeleton-realtime/03-CONTEXT.md
- lib/utils.ts (getStatusColor, getStatusCardColor, formatDate)
- types/database.ts
</read_first>

## Tasks

### Task 2.1: Create UI Badge Component

<action>
Create `components/ui/badge.tsx` to display order status:

```typescript
import { HTMLAttributes, forwardRef } from 'react';
import { cn, getStatusColor } from '@/lib/utils';
import type { OrderStatus } from '@/types/database';

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  status: OrderStatus | string;
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, status, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border',
          getStatusColor(status),
          className
        )}
        {...props}
      >
        {status}
      </div>
    );
  }
);
Badge.displayName = 'Badge';

export { Badge };
```
</action>

<acceptance_criteria>
- `components/ui/badge.tsx` is created
- Exports `Badge` component that uses `getStatusColor`
</acceptance_criteria>

---

### Task 2.2: Create Status Summary Cards Component

<action>
Create `components/dashboard/status-cards.tsx`:

```typescript
import { cn, getStatusCardColor } from '@/lib/utils';
import type { OrderStatus } from '@/types/database';

interface StatusCounts {
  'Pending': number;
  'In Progress': number;
  'Packing': number;
  'Dispatched': number;
}

interface StatusCardsProps {
  counts: StatusCounts;
  activeFilter: OrderStatus | 'All';
  onFilterClick: (status: OrderStatus | 'All') => void;
}

export function StatusCards({ counts, activeFilter, onFilterClick }: StatusCardsProps) {
  const statuses: OrderStatus[] = ['Pending', 'In Progress', 'Packing', 'Dispatched'];

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {statuses.map((status) => {
        const { bg, text, border, icon } = getStatusCardColor(status);
        const isActive = activeFilter === status;
        
        return (
          <button
            key={status}
            onClick={() => onFilterClick(isActive ? 'All' : status)}
            className={cn(
              'flex flex-col p-4 rounded-2xl border text-left transition-all duration-200 min-tap',
              bg,
              isActive ? `ring-2 ring-offset-1 ${border}` : border,
              isActive ? 'shadow-sm' : 'hover:shadow-sm opacity-90 hover:opacity-100'
            )}
            aria-pressed={isActive}
          >
            <div className="flex justify-between items-start w-full mb-2">
              <span className={cn('text-sm font-medium', text)}>{status}</span>
              <div className={cn('w-2 h-2 rounded-full mt-1.5', icon, 'bg-current')} />
            </div>
            <span className={cn('text-3xl font-bold tracking-tight', text)}>
              {counts[status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```
</action>

<acceptance_criteria>
- `components/dashboard/status-cards.tsx` is created
- Displays 4 cards in a 2x2 grid
- Click toggles active filter status
- Applies min-tap class for mobile
</acceptance_criteria>

---

### Task 2.3: Create Sticky Filter Bar Component

<action>
Create `components/dashboard/filter-bar.tsx`:

```typescript
import { Input } from '@/components/ui/input';
import type { Category, OrderStatus } from '@/types/database';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  selectedStatus: OrderStatus | 'All';
  setSelectedStatus: (s: OrderStatus | 'All') => void;
  categories: Category[];
  onClear: () => void;
  resultCount: number;
}

export function FilterBar({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedStatus,
  setSelectedStatus,
  categories,
  onClear,
  resultCount,
}: FilterBarProps) {
  const hasFilters = searchQuery !== '' || selectedCategory !== 'All' || selectedStatus !== 'All';

  return (
    <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur pt-2 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="flex flex-col gap-3">
        {/* Search & Category row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Search customers..."
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-tap"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <select
            className="h-11 px-3 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-tap max-w-[140px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        
        {/* Status Dropdown & Clear row */}
        <div className="flex justify-between items-center gap-2">
           <select
            className="h-11 px-3 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-tap w-[140px]"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as OrderStatus | 'All')}
            aria-label="Filter by status"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Packing">Packing</option>
            <option value="Dispatched">Dispatched</option>
          </select>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500">
              {resultCount} {resultCount === 1 ? 'order' : 'orders'}
            </span>
            {hasFilters && (
              <button
                onClick={onClear}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 min-tap px-2"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```
</action>

<acceptance_criteria>
- `components/dashboard/filter-bar.tsx` is created
- Sticky top class ensures it stays visible during scroll
- Includes Search input, Category dropdown, Status dropdown, and Clear button
- Shows count of filtered results
</acceptance_criteria>

---

### Task 2.4: Create Order Mobile Card Component

<action>
Create `components/dashboard/order-card.tsx`:

```typescript
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { OrderWithCategory } from '@/types/database';

interface OrderCardProps {
  order: OrderWithCategory;
}

export function OrderCard({ order }: OrderCardProps) {
  return (
    <button
      className="w-full bg-white rounded-2xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow active:scale-[0.99] min-tap flex flex-col gap-3"
      onClick={() => {
        // Phase 4: Open Bottom Sheet
        console.log('Open order:', order.id);
      }}
    >
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-bold text-gray-900 tracking-tight">
              {order.order_no}
            </span>
            <span className="text-xs font-medium text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded-md">
              {order.categories?.name || 'Uncategorized'}
            </span>
          </div>
          <h3 className="text-sm font-medium text-gray-700 line-clamp-1">
            {order.customer_name}
          </h3>
        </div>
        <Badge status={order.status} className="whitespace-nowrap shrink-0" />
      </div>

      <div className="flex justify-between items-end border-t border-gray-100 pt-3 mt-1">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Due</span>
          <span className="text-sm font-medium text-gray-800">{formatDate(order.due_date)}</span>
        </div>
        <div className="text-sm font-semibold text-gray-900 bg-gray-50 px-2 py-1 rounded-lg">
          Qty: {order.qty}
        </div>
      </div>
    </button>
  );
}
```
</action>

<acceptance_criteria>
- `components/dashboard/order-card.tsx` is created
- Renders order_no, customer_name, category name, status Badge, due_date and qty
- Card is clickable (placeholder onClick for Phase 4)
- Uses `formatDate` from utils
</acceptance_criteria>
