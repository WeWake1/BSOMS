# Phase 3: Dashboard Skeleton + Realtime — Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Source:** AGENTS.md spec

<domain>
## Phase Boundary

This phase delivers the core user interface and data layer for the dashboard:
- **Supabase Realtime:** Subscription to `orders` table changes.
- **Data Hook:** `useOrders` custom hook fetching orders + categories, handling realtime state updates.
- **UI Components:**
  - Status Summary Cards (shows counts, tap to filter)
  - Sticky Filter Bar (Status dropdown, Category dropdown, Search, Clear)
  - Order Mobile Card (Order No, Customer, Category, Status badge, Due Date)
- **Top-level UI:** FAB (+ Add Order) for Admins only, PDF Export placeholder button.
- **Page Assembly:** `/dashboard/page.tsx` pulling together the hooks, filters, and list.

Does NOT include: Order Detail bottom sheet, Add/Edit forms (Phase 4), PDF Export actual implementation (Phase 6), Category management (Phase 5).
</domain>

<decisions>
## Implementation Decisions

### Data & Realtime Strategy
- Use a single custom hook `hooks/useOrders.ts`
- Fetch initial orders and categories using `@supabase/supabase-js` browser client
- Set up Supabase Realtime channel `custom-all-channel` on `public:orders`
- Handle Insert, Update, Delete events by mutating local React state
- This ensures all 10 viewers see the "live" state within 3 seconds without refreshing

### Filtering Strategy
- Implement filtering entirely client-side based on the local React state. Since there is NO pagination (order count < 100), client-side filtering is fast and simplifies the realtime architecture.
- Filter state kept in URL query parameters (`?status=Pending&q=John`) or simple React state. Given mobile app feel, local React state in the dashboard component is fine and avoids excessive re-renders, but URL state allows deep-linking. We will use simple React state for filters for maximum speed on mobile.

### UI Layout (Mobile-First)
- `app/(dashboard)/dashboard/page.tsx` starts with a TopBar (Title + PDF Button)
- Under TopBar: 4 Status Cards in a 2x2 grid (xs: 390px)
- Under Cards: Sticky Filter Bar (`sticky top-0 z-10 bg-gray-50 pb-2 pt-2`)
- Under Filters: The list of `OrderCard` components, displaying in a single column
- Fixed bottom-right: Floating Action Button (FAB)

### Status Summary Cards
- Show the 4 enum states: Pending (amber), In Progress (blue), Packing (purple), Dispatched (green).
- Clicking a card sets the Status filter to that state.
- Needs to calculate counts based on the *unfiltered* total list.

### 21st.dev Component Strategy
- We will build generic equivalents for basic UI elements (Badge, Select/Dropdown) in `components/ui` to keep the build moving quickly.
- We will upgrade them in Phase 7 via Impeccable/21st.dev tools.

</decisions>

<canonical_refs>
## Canonical References

- `AGENTS.md` — Project spec, especially the Dashboard section formatting.
- `types/database.ts` — Order and OrderWithCategory types.
- `lib/utils.ts` — `getStatusColor`, `getStatusCardColor`, `formatDate`.
- `lib/supabase/client.ts` — Client used for data fetching and realtime.
</canonical_refs>

<specifics>
## Specific Ideas

- Filter Bar text input should have a Search icon.
- FAB should only be rendered if `user.profile.role === 'admin'`. We can pass the `role` down from the server layout or page to the client components.
</specifics>

<deferred>
## Deferred Ideas

- Clicking an OrderCard currently does nothing (will open Bottom Sheet in Phase 4).
- Clicking FAB currently does nothing (will open Add Form in Phase 4).
- Clicking PDF Export currently does nothing (implemented in Phase 6).
</deferred>
