---
wave: 2
depends_on: [01-PLAN.md]
files_modified:
  - components/dashboard/order-form-sheet.tsx
  - supabase/migration_order_items_sort_order.sql
autonomous: false
---

# Plan 03 — Sub-Item Atomic Save Logic

## Objective

Update `handleSubmit` to atomically save the parent order AND all sub-items, with upload guard, delete of removed items, and sort_order upsert.

## Context

Read `.planning/phases/08-sub-orders/01-CONTEXT.md` (Area 3: Save flow) before implementing.

## Tasks

### Task 1 — Create sort_order migration

<read_first>
- `supabase/migration_order_items.sql` (existing migration for reference)
</read_first>

<action>
Create `supabase/migration_order_items_sort_order.sql`:

```sql
-- Add sort_order to order_items for drag-to-reorder
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sort_order integer default 0;
```

You must run this in Supabase SQL Editor before executing this phase.
</action>

<acceptance_criteria>
- `supabase/migration_order_items_sort_order.sql` exists
- File contains `ADD COLUMN IF NOT EXISTS sort_order integer`
</acceptance_criteria>

---

### Task 2 — Replace handleSubmit with atomic save

<read_first>
- `components/dashboard/order-form-sheet.tsx` — full handleSubmit function
- `.planning/phases/08-sub-orders/01-CONTEXT.md` (Area 3: 7-step save sequence)
</read_first>

<action>
Replace the entire `handleSubmit` function body with this sequence:

**Step 1 — Upload guard:**
```typescript
const anyUploading = photoUploading || audioUploading ||
  subItemPhotoUploadingIds.size > 0 || subItemAudioUploadingIds.size > 0;
if (anyUploading) {
  toast.error("A photo or voice note is still uploading. Please wait a moment and try again.");
  return;
}
setLoading(true);
```

**Step 2 — Build order payload** (same as today, no change):
```typescript
const orderPayload = {
  order_no: orderNo.trim(), customer_name: customerName.trim(),
  category_id: categoryId, date, due_date: dueDate,
  dispatch_date: status === 'Dispatched' ? (dispatchDate || null) : null,
  length: length ? parseFloat(length) : null,
  width: width ? parseFloat(width) : null,
  qty: parseInt(qty, 10), status,
  description: description || null,
  photo_url: photoPath, audio_url: audioPath,
};
```

**Steps 3–5 — Save order, delete removed sub-items, upsert sub-items:**
```typescript
try {
  let savedOrderId = order?.id ?? null;

  if (order) {
    const { error } = await (supabase.from('orders') as any).update(orderPayload).eq('id', order.id);
    if (error) throw error;
  } else {
    const { data: newOrder, error } = await (supabase.from('orders') as any)
      .insert(orderPayload).select('id').single();
    if (error) throw error;
    savedOrderId = newOrder.id;
  }

  // Delete removed sub-items
  const existingDbIds = (order?.order_items ?? []).map(i => i.id);
  const currentDbIds = subItems.map(i => i.dbId).filter(Boolean);
  const removedIds = existingDbIds.filter(id => !currentDbIds.includes(id));
  if (removedIds.length > 0) {
    const { error } = await (supabase.from('order_items') as any).delete().in('id', removedIds);
    if (error) throw error;
  }

  // Upsert sub-items with sort_order
  if (subItems.length > 0) {
    const itemsPayload = subItems.map((item, idx) => ({
      ...(item.dbId ? { id: item.dbId } : {}),
      order_id: savedOrderId,
      item_label: item.itemLabel || `Item ${idx + 2}`,
      date: item.date, due_date: item.dueDate,
      dispatch_date: item.status === 'Dispatched' ? (item.dispatchDate || null) : null,
      length: item.length ? parseFloat(item.length) : null,
      width: item.width ? parseFloat(item.width) : null,
      qty: parseInt(item.qty, 10) || 1,
      status: item.status,
      description: item.description || null,
      photo_url: item.photoPath, audio_url: item.audioPath,
      sort_order: idx,
    }));
    const { error } = await (supabase.from('order_items') as any)
      .upsert(itemsPayload, { onConflict: 'id' });
    if (error) throw error;
  }

  clearDraft(order?.id ?? null);
  onClose();
} catch (err: any) {
  const msg = err?.message || '';
  if (msg.includes('duplicate') || msg.includes('unique')) {
    const { data: existing } = await supabase.from('orders')
      .select('id, order_no, customer_name').eq('order_no', orderNo.trim()).single();
    if (existing && existing.customer_name.trim().toLowerCase() === customerName.trim().toLowerCase()) {
      setDuplicateOrder(existing);
      setPendingSubItemData({
        order_id: existing.id,
        item_label: `Item added ${new Date().toLocaleDateString('en-IN')}`,
        date, due_date: dueDate,
        dispatch_date: status === 'Dispatched' ? (dispatchDate || null) : null,
        length: length ? parseFloat(length) : null,
        width: width ? parseFloat(width) : null,
        qty: parseInt(qty, 10), status,
        description: description || null,
        photo_url: photoPath, audio_url: audioPath, sort_order: 999,
      });
    } else {
      toast.error(`Order No ${orderNo} is already used by a different customer. Please use a different Order No.`);
    }
  } else if (msg.includes('null value') || msg.includes('not-null')) {
    toast.error("Please fill in all required fields for every item before saving.");
  } else {
    toast.error("Couldn't save the order. Please check your details and try again.");
  }
} finally {
  setLoading(false);
}
```
</action>

<acceptance_criteria>
- `handleSubmit` checks `subItemPhotoUploadingIds.size > 0` before any DB calls
- Toast "A photo or voice note is still uploading..." shown when anyUploading is true
- `handleSubmit` calls `.delete().in('id', removedIds)` for removed sub-items
- `handleSubmit` calls `.upsert(itemsPayload, { onConflict: 'id' })` for sub-items
- `sort_order: idx` present in upsert payload
- `clearDraft` called on success path
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

## Verification

```bash
npx tsc --noEmit
grep -n "anyUploading\|sort_order\|removedIds\|clearDraft" components/dashboard/order-form-sheet.tsx
test -f supabase/migration_order_items_sort_order.sql && cat supabase/migration_order_items_sort_order.sql
```

## must_haves

- Upload guard runs before any DB calls
- Order saved first, then deleted items removed, then sub-items upserted
- `sort_order` included in upsert payload
- `clearDraft` on success
