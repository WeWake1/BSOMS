---
wave: 1
depends_on: []
files_modified:
  - components/dashboard/order-form-sheet.tsx
  - types/database.ts
autonomous: false
---

# Plan 01 — Sub-Item Form State & localStorage Draft

## Objective

Extend `OrderFormSheet` with the complete sub-item data model, a client-side draft auto-save system using localStorage, and all state management needed before any UI is rendered. This is the foundation all other form plans build on.

## Context

Read `.planning/phases/08-sub-orders/01-CONTEXT.md` (Area 3: Draft auto-save) and the `OrderFormDraft` / `SubItemDraft` TypeScript schema defined there before implementing.

## Tasks

### Task 1 — Add `SubItemDraft` interface to `types/database.ts`

<read_first>
- `types/database.ts` (current full contents — must match existing code style)
- `.planning/phases/08-sub-orders/01-CONTEXT.md` (localStorage draft schema section)
</read_first>

<action>
Append these two interfaces to the bottom of `types/database.ts` (after the `Database` export):

```typescript
/**
 * Client-side draft representation of a sub-order item (used in localStorage + form state).
 * NOT a database type — never sent to Supabase directly.
 */
export interface SubItemDraft {
  /** client-side UUID for React key — generated with crypto.randomUUID() */
  tempId: string;
  /** null for new items not yet saved; existing order_items.id for saved items */
  dbId: string | null;
  itemLabel: string;
  date: string;           // ISO date string YYYY-MM-DD
  dueDate: string;
  dispatchDate: string;   // '' if not set
  length: string;         // numeric string, '' if empty
  width: string;
  qty: string;            // numeric string, default '1'
  status: OrderStatus;
  description: string;
  photoPath: string | null;   // Supabase Storage path
  audioPath: string | null;
}

/**
 * Full form draft persisted to localStorage.
 * Key: `orderflow_draft_new` or `orderflow_draft_{orderId}`
 */
export interface OrderFormDraft {
  version: 1;
  savedAt: string;         // ISO timestamp
  orderId: string | null;  // null for new orders
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
```
</action>

<acceptance_criteria>
- `types/database.ts` contains `export interface SubItemDraft {` with all listed fields
- `types/database.ts` contains `export interface OrderFormDraft {` with `version: 1` and `subItems: SubItemDraft[]`
- `npx tsc --noEmit` exits 0 with no errors
</acceptance_criteria>

---

### Task 2 — Add sub-item state and draft helpers to `OrderFormSheet`

<read_first>
- `components/dashboard/order-form-sheet.tsx` (full current file — 468 lines)
- `types/database.ts` (after Task 1 edits above)
- `.planning/phases/08-sub-orders/01-CONTEXT.md` (Area 3: localStorage draft schema)
</read_first>

<action>
Make these additions to `order-form-sheet.tsx`:

**1. Update import line** (line 9) to include new types:
```typescript
import type { OrderWithCategoryAndItems, Category, OrderStatus, SubItemDraft, OrderFormDraft } from '@/types/database';
```

**2. After existing state declarations (line ~52), add sub-item state:**
```typescript
// Sub-item state
const [subItems, setSubItems] = useState<SubItemDraft[]>([]);
// Draft restore banner
const [pendingDraft, setPendingDraft] = useState<OrderFormDraft | null>(null);
```

**3. Add draft helpers ABOVE the useEffect (before line 55). These are pure functions, not hooks:**

```typescript
/** localStorage key for this form's draft */
const getDraftKey = (orderId: string | null) =>
  orderId ? `orderflow_draft_${orderId}` : 'orderflow_draft_new';

/** Persist current form state to localStorage */
const saveDraft = (
  orderId: string | null,
  fields: {
    orderNo: string; customerName: string; categoryId: string;
    date: string; dueDate: string; dispatchDate: string;
    length: string; width: string; qty: string;
    status: OrderStatus; description: string;
    photoPath: string | null; audioPath: string | null;
    subItems: SubItemDraft[];
  }
) => {
  try {
    const draft: OrderFormDraft = {
      version: 1,
      savedAt: new Date().toISOString(),
      orderId,
      ...fields,
    };
    localStorage.setItem(getDraftKey(orderId), JSON.stringify(draft));
  } catch {
    // localStorage write failure is non-fatal — silently ignore
  }
};

/** Load draft from localStorage. Returns null if none or version mismatch */
const loadDraft = (orderId: string | null): OrderFormDraft | null => {
  try {
    const raw = localStorage.getItem(getDraftKey(orderId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as OrderFormDraft;
    if (draft.version !== 1) return null;
    return draft;
  } catch {
    return null;
  }
};

/** Clear draft from localStorage after successful save */
const clearDraft = (orderId: string | null) => {
  try {
    localStorage.removeItem(getDraftKey(orderId));
  } catch { /* non-fatal */ }
};
```

**4. Update the existing `useEffect` (lines 55–112) — add draft check on open.** After the `if (isOpen) {` block starts, before populating fields from `order`, check for a pending draft:

```typescript
// Check for existing draft on open
const draft = loadDraft(order?.id ?? null);
if (draft) {
  setPendingDraft(draft);
  // Don't populate form yet — wait for user to accept or discard
  return;
}
setPendingDraft(null);
```

For the existing `order` population block, add sub-item population after `setAudioPath`:
```typescript
// Populate sub-items from existing order_items
if (order.order_items && order.order_items.length > 0) {
  setSubItems(order.order_items.map((item, idx) => ({
    tempId: item.id, // use DB id as tempId for existing items
    dbId: item.id,
    itemLabel: item.item_label ?? `Item ${idx + 2}`,
    date: item.date,
    dueDate: item.due_date,
    dispatchDate: item.dispatch_date ?? '',
    length: item.length?.toString() ?? '',
    width: item.width?.toString() ?? '',
    qty: item.qty.toString(),
    status: item.status,
    description: item.description ?? '',
    photoPath: item.photo_url,
    audioPath: item.audio_url,
  })));
} else {
  setSubItems([]);
}
```

For the `else` (new order) block, add after `setAudioUrl(null)`:
```typescript
setSubItems([]);
```

**5. Add auto-save `useEffect` AFTER the open/populate effect:**

```typescript
// Auto-save draft every 3 seconds while form is open
useEffect(() => {
  if (!isOpen || pendingDraft !== null) return; // don't save while draft prompt is showing
  const interval = setInterval(() => {
    saveDraft(order?.id ?? null, {
      orderNo, customerName, categoryId,
      date, dueDate, dispatchDate,
      length, width, qty, status, description,
      photoPath: photoPath,
      audioPath: audioPath,
      subItems,
    });
  }, 3000);
  return () => clearInterval(interval);
}, [
  isOpen, pendingDraft, order?.id,
  orderNo, customerName, categoryId,
  date, dueDate, dispatchDate,
  length, width, qty, status, description,
  photoPath, audioPath, subItems,
]);
```

**6. Add `restoreDraft` and `discardDraft` handlers** (before `handleSubmit`):

```typescript
const restoreDraft = () => {
  if (!pendingDraft) return;
  setOrderNo(pendingDraft.orderNo);
  setCustomerName(pendingDraft.customerName);
  setCategoryId(pendingDraft.categoryId);
  setDate(pendingDraft.date);
  setDueDate(pendingDraft.dueDate);
  setDispatchDate(pendingDraft.dispatchDate);
  setLength(pendingDraft.length);
  setWidth(pendingDraft.width);
  setQty(pendingDraft.qty);
  setStatus(pendingDraft.status);
  setDescription(pendingDraft.description);
  setPhotoPath(pendingDraft.photoPath);
  setAudioPath(pendingDraft.audioPath);
  setSubItems(pendingDraft.subItems);
  setPendingDraft(null);
};

const discardDraft = () => {
  clearDraft(order?.id ?? null);
  setPendingDraft(null);
  // Re-trigger normal open initialization
  // Form is still open — isOpen effect will re-run if we toggle, so reset manually:
  if (order) {
    setOrderNo(order.order_no);
    setCustomerName(order.customer_name);
    // ... (populate fields from order as in the main effect)
  }
};
```

**7. Update `handleSubmit`** — clear draft on success. After `onClose();`:
```typescript
clearDraft(order?.id ?? null);
```
</action>

<acceptance_criteria>
- `types/database.ts` exports `SubItemDraft` and `OrderFormDraft` interfaces
- `order-form-sheet.tsx` imports `SubItemDraft`, `OrderFormDraft` from `@/types/database`
- `order-form-sheet.tsx` contains `const [subItems, setSubItems] = useState<SubItemDraft[]>([])`
- `order-form-sheet.tsx` contains `const [pendingDraft, setPendingDraft] = useState<OrderFormDraft | null>(null)`
- `order-form-sheet.tsx` contains `getDraftKey`, `saveDraft`, `loadDraft`, `clearDraft` functions
- `order-form-sheet.tsx` contains `setInterval` auto-save effect with 3000ms interval
- `order-form-sheet.tsx` contains `restoreDraft` and `discardDraft` handlers
- `order-form-sheet.tsx` `handleSubmit` success path calls `clearDraft`
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

## Verification

```bash
npx tsc --noEmit
grep -n "SubItemDraft\|OrderFormDraft" types/database.ts
grep -n "subItems\|pendingDraft\|saveDraft\|loadDraft\|clearDraft\|restoreDraft\|discardDraft" components/dashboard/order-form-sheet.tsx | head -30
```

## must_haves

- `SubItemDraft` and `OrderFormDraft` types exist and are exported
- `subItems` state is `SubItemDraft[]`
- Auto-save interval runs every 3 seconds
- Draft is cleared on successful form submit
- Zero TypeScript errors
