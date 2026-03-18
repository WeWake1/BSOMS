# OrderFlow — v1 Requirements

## v1 Requirements

### AUTH — Authentication & Authorization
- [ ] **AUTH-01**: User can log in with email and password via /login page
- [ ] **AUTH-02**: Session persists across page reloads and browser restarts
- [ ] **AUTH-03**: User is redirected to /dashboard on successful login
- [ ] **AUTH-04**: Invalid credentials show inline error message (no browser alerts)
- [ ] **AUTH-05**: Admin role has full CRUD on orders and categories (enforced server-side)
- [ ] **AUTH-06**: Viewer role has read-only access with no modify UI shown (enforced server-side)
- [ ] **AUTH-07**: All routes and API endpoints protected server-side by role

### DASH — Dashboard
- [ ] **DASH-01**: Dashboard shows 4 status summary cards: Pending (amber), In Progress (blue), Packing (purple), Dispatched (green)
- [ ] **DASH-02**: Each status card displays count of orders in that status
- [ ] **DASH-03**: Tapping a status card filters the orders list to that status
- [ ] **DASH-04**: Sticky filter bar below cards: Status dropdown, Customer Name text search, Category dropdown, Clear Filters button
- [ ] **DASH-05**: Orders list displays compact mobile cards: Order No, Customer Name, Category, Status badge, Due Date
- [ ] **DASH-06**: Tapping an order card opens Order Detail bottom sheet
- [ ] **DASH-07**: FAB ("+ Add Order") is visible bottom-right to Admin only
- [ ] **DASH-08**: PDF Export button visible top-right to all users
- [ ] **DASH-09**: Dashboard updates in realtime without page refresh (Supabase Realtime)

### ORD — Orders (Detail/Create/Edit)
- [ ] **ORD-01**: Order Detail bottom sheet shows all fields: Order No, Customer Name, Category, Date, Due Date, Dispatch Date, Length, Width, Qty, Status, Description, Photo
- [ ] **ORD-02**: Photo in detail sheet is tappable to view full size
- [ ] **ORD-03**: Admin can open Add Order form via FAB
- [ ] **ORD-04**: Admin can open Edit Order form via Edit button in detail sheet
- [ ] **ORD-05**: Add/Edit form includes all fields in specified order with correct mobile input types
- [ ] **ORD-06**: Status field uses segmented control: Pending | In Progress | Packing | Dispatched
- [ ] **ORD-07**: Photo field: single image, opens camera/gallery chooser on mobile, inline preview after selection
- [ ] **ORD-08**: Photo stored in Supabase Storage `order-photos` bucket
- [ ] **ORD-09**: Admin can add a new category inline from the order form (+ Add Category link)
- [ ] **ORD-10**: Form validates required fields and shows inline errors
- [ ] **ORD-11**: Order No and customer name are required; qty is required; category and dates are required

### CAT — Categories
- [ ] **CAT-01**: Admin can access Category Management from profile/settings menu
- [ ] **CAT-02**: Category management page lists all existing categories
- [ ] **CAT-03**: Admin can add a new category inline
- [ ] **CAT-04**: Admin can rename an existing category inline
- [ ] **CAT-05**: Category changes reflect immediately in order form dropdown

### PDF — PDF Export
- [ ] **PDF-01**: PDF Export button exports all currently visible (filtered) orders
- [ ] **PDF-02**: PDF header: "OrderFlow — Order Report" + export date
- [ ] **PDF-03**: PDF columns: Order No, Customer Name, Category, Status, Date, Due Date, Dispatch Date, Qty, Description
- [ ] **PDF-04**: PDF has page numbers in footer
- [ ] **PDF-05**: PDF layout is clean and printable (no decorative elements)

### RT — Realtime
- [ ] **RT-01**: All 10 concurrent viewers see order updates without refresh via Supabase Realtime subscription on orders table

## v2 Requirements (Deferred)
- User can reset password via email link
- Admin can invite viewer accounts via UI
- Order bulk status update
- Order history/audit trail
- Dark mode

## Out of Scope
- Dark mode — not needed initially
- Pagination — order count expected under 100
- OAuth/social login — email+password only per spec
- Multiple photos per order — single image only
- Push notifications — not in spec
- Desktop-first design — mobile-first (390px base)

## Traceability

| Phase | Requirements |
|-------|-------------|
| Phase 1 — Project Setup + Supabase Schema | AUTH-05, AUTH-06, AUTH-07 (RLS) |
| Phase 2 — Auth | AUTH-01, AUTH-02, AUTH-03, AUTH-04 |
| Phase 3 — Dashboard + Realtime | DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08, DASH-09, RT-01 |
| Phase 4 — Order Detail + Add/Edit Form | ORD-01, ORD-02, ORD-03, ORD-04, ORD-05, ORD-06, ORD-07, ORD-08, ORD-09, ORD-10, ORD-11 |
| Phase 5 — Category Management | CAT-01, CAT-02, CAT-03, CAT-04, CAT-05 |
| Phase 6 — PDF Export | PDF-01, PDF-02, PDF-03, PDF-04, PDF-05 |
| Phase 7 — UI Polish | All UI requirements (Impeccable pass) |
