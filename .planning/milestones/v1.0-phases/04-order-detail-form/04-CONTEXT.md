# Phase 4: Order Detail + Add/Edit Form — Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Source:** AGENTS.md spec

<domain>
## Phase Boundary

This phase implements the fully mobile-first "Bottom Sheet" interactions for viewing and modifying orders:
1. **Order Detail Sheet:** Read-only view of all fields. Tappable full-size photo. Edit/Delete actions (Admin only).
2. **Add/Edit Form Sheet:** Complex form for creating or updating orders. Includes inline photo upload to Supabase Storage (`order-photos` bucket) and inline Category creation.
</domain>

<decisions>
## Implementation Decisions

### Bottom Sheet (Drawer) Component
- For speed and mobile-first feel, we will implement a `<Drawer>` primitive using Tailwind and React state that slides up from the bottom.
- By Phase 7, this will be upgraded via 21st.dev/Impeccable. 

### Data Flow & State Management
- `useOrders` from Phase 3 already subscribes to real-time events.
- Creating/Editing an order will use standard Supabase client mutations (`supabase.from('orders').insert()`). 
- Once the mutation succeeds, the real-time subscription will automatically update the dashboard list. We simply close the form. No need to manually refresh the list.

### Photo Upload Strategy
- When a user selects a photo, we upload it instantly to Supabase Storage (`order-photos` bucket) and get the public URL.
- The form stores the `photo_url` string.
- When the form submits, we save the `photo_url` into the `orders` table.
- If the form is cancelled, we have an orphaned photo. Given this is an internal app, this is acceptable for V1, or we can clean up orphaned photos with a cron job later. 

### Category Inline-Add
- If the user selects "Add New Category" from the Category dropdown, we show a native `window.prompt` or a quick inline text input.
- We run `supabase.from('categories').insert()`.
- The real-time hook will immediately update our `categories` array in `useOrders`, populated the dropdown instantly.

### Form Validation
- We will rely heavily on native HTML5 validation (`required`, `type="number"`) enhanced by simple client-side checks for the photo before calling Supabase insert.
</decisions>

<canonical_refs>
## Canonical References
- `AGENTS.md` - Form field order and photo requirements.
- `hooks/useOrders.ts` - Where the lists come from.
- `types/database.ts` - The exact table schemas.
</canonical_refs>
