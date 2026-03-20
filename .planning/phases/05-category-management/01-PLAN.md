---
plan: 01
phase: 5
wave: 1
title: Settings Drawer and Category CRUD
depends_on: []
files_modified:
  - hooks/useOrders.ts
  - components/dashboard/settings-drawer.tsx
  - app/(dashboard)/dashboard/DashboardClient.tsx
autonomous: true
requirements_addressed: [CAT-01, CAT-02, CAT-03, CAT-04, CAT-05]
---

# Plan 01: Settings Drawer and Category CRUD

## Objective

Build the Settings menu accessible from the dashboard header, containing user profile data, sign-out functionality, and full Category CRUD capabilities for Admins. Ensure category changes are synced in real-time.

## Tasks

### Task 1.1: Add Categories Subscription to `useOrders`

<action>
Modify `hooks/useOrders.ts`:
Add a second subscription channel for the `categories` table so that additions/renames immediately update the state across all connected clients.

```typescript
// inside useEffect...
const categoryChannel = supabase.channel('public:categories')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
    if (payload.eventType === 'INSERT') {
      setCategories(prev => [...prev, payload.new as Category].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (payload.eventType === 'UPDATE') {
      setCategories(prev => prev.map(c => c.id === payload.new.id ? payload.new as Category : c).sort((a, b) => a.name.localeCompare(b.name)));
    } else if (payload.eventType === 'DELETE') {
      setCategories(prev => prev.filter(c => c.id !== payload.old.id));
    }
  })
  .subscribe();

// return cleanup
return () => {
  mounted = false;
  supabase.removeChannel(orderChannel);
  supabase.removeChannel(categoryChannel);
};
```
</action>

### Task 1.2: Build `SettingsDrawer` Component

<action>
Create `components/dashboard/settings-drawer.tsx`:
This Drawer receives `user`, `categories`, `isOpen`, `onClose`.
It renders:
1. User profile section (Role, user.email, Sign Out button).
2. Category Management section (Admin only).
   - Render list of categories.
   - Each category row has a text input (disabled until "Edit" is clicked) and a Save/Delete button.
   - A final "Add Category" row at the bottom.
</action>

### Task 1.3: Integrate into Dashboard

<action>
Modify `app/(dashboard)/dashboard/DashboardClient.tsx`:
1. Add an empty "Profile" button to the top right header area (next to Export PDF).
   Use a simple user SVG icon.
2. Add state `isSettingsOpen`.
3. Render `<SettingsDrawer>`.
</action>

## Acceptance Criteria
- User can open settings from dashboard.
- Admin can rename a category inline without page reload.
- Admin can insert a new category directly from the drawer.
- Other active users instantly see the new category in their dropdowns via Realtime.
