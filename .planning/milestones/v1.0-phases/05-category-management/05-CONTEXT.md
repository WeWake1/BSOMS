# Phase 5: Category Management — Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Source:** AGENTS.md + GSD Roadmap

<domain>
## Phase Boundary

This phase introduces:
1. **User Profile/Settings Menu:** A place to see the current logged-in user, sign out, and access admin settings.
2. **Category Management:** A dedicated UI for Admins to view, rename, and add new categories. 
</domain>

<decisions>
## Implementation Decisions

### Navigation / UX
- We want to keep the single-page app feel (no hard navigations if possible). 
- We will add a simple "Avatar" or "Profile" button next to "Export PDF" in the Dashboard header.
- Clicking the Profile button opens a `SettingsDrawer`.
- `SettingsDrawer` lists user details, a **Sign Out** button, and if `isAdmin`, a **Manage Categories** section.

### Category Management UI
- **List:** Inside the SettingsDrawer (or a nested view), render all categories.
- **Inline Add:** A simple `<Input>` and `<Button>` at the bottom to insert a new category.
- **Inline Rename:** Each category row will have an "Edit" icon. Clicking it turns the text into an input field to rename it via `supabase.from('categories').update()`.

### Realtime State Sharing
- We already fetch `categories` inside `useOrders()`.
- Wait, `useOrders()` only sets up real-time subscription for `orders`, not `categories`.
- If we update a category, it won't instantly reflect in the dropdown unless we either:
  a) Reload `categories` on mutation.
  b) Subscribe to `categories` in `useOrders()`.
- Let's update `useOrders.ts` to ALSO subscribe to `categories` table changes, so everything is perfectly live for all connected users!
</decisions>
