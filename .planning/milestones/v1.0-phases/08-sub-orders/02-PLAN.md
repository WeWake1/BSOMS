---
wave: 2
depends_on: [01-PLAN.md]
files_modified:
  - components/dashboard/order-form-sheet.tsx
autonomous: false
---

# Plan 02 — Sub-Item Accordion UI, Drag-to-Reorder & Draft Banner

## Objective

Render the sub-item section inside the order form: collapsed accordion cards with full expand/collapse, a drag-to-reorder interaction, the "+ Add Item" full-width button, the draft restore banner, and the smart duplicate detection dialog. All design follows `.impeccable.md` and existing form patterns.

## Context

Read `.planning/phases/08-sub-orders/01-CONTEXT.md` (Areas 1, 2, 4) and `components/dashboard/order-form-sheet.tsx` (after Plan 01 edits) for current patterns before implementing.

## Tasks

### Task 1 — Sub-item accordion card component (inline in form file)

<read_first>
- `components/dashboard/order-form-sheet.tsx` (full file after Plan 01)
- `app/globals.css` (animation keyframes, CSS variables — use existing tokens)
- `.impeccable.md` (design rules — OKLCH colors, fluid type, 44px tap targets)
- `components/ui/button.tsx` (Button variants available)
- `components/ui/input.tsx` (Input component usage)
</read_first>

<action>
Add an inline `SubItemCard` component at the top of the file (before `OrderFormSheet`). This renders a single sub-item row in collapsed or expanded state.

```typescript
interface SubItemCardProps {
  item: SubItemDraft;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (updated: SubItemDraft) => void;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  // photo/audio upload handlers passed from parent
  onPhotoUpload: (tempId: string, file: File) => void;
  onPhotoRemove: (tempId: string) => void;
  onAudioRecord: (tempId: string) => void;
  onAudioDelete: (tempId: string) => void;
  photoUploadingIds: Set<string>;
  audioUploadingIds: Set<string>;
  audioRecordingId: string | null;
}
```

**Collapsed state renders:**
```tsx
<div
  className={cn(
    "rounded-2xl border border-border bg-card overflow-hidden transition-shadow",
    isDragging && "shadow-lg ring-2 ring-primary/20"
  )}
>
  <div className="flex items-center gap-2 px-3 py-3">
    {/* Drag handle */}
    <div {...dragHandleProps} className="min-tap flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing touch-none" aria-label="Drag to reorder">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/>
        <circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/>
        <circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/>
      </svg>
    </div>

    {/* Summary — tap to toggle expand */}
    <button
      type="button"
      onClick={onToggle}
      className="flex-1 text-left min-tap"
      aria-expanded={isExpanded}
    >
      <span className="text-sm font-bold text-foreground">
        {item.itemLabel || `Item ${index + 2}`}
      </span>
      <span className="text-xs text-muted-foreground ml-2">
        {[
          item.length && item.width ? `${item.length}×${item.width}cm` : null,
          item.qty ? `Qty: ${item.qty}` : null,
          item.dueDate ? `Due: ${new Date(item.dueDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : null,
        ].filter(Boolean).join(' · ')}
      </span>
    </button>

    {/* Status dot */}
    <Badge status={item.status} className="text-[10px] px-2 py-0.5" />

    {/* Expand chevron + remove */}
    <button type="button" onClick={onToggle} className="min-tap p-1 text-muted-foreground" aria-label={isExpanded ? 'Collapse item' : 'Expand item'}>
      <svg className={cn("w-4 h-4 transition-transform duration-200", isExpanded && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
  </div>

  {/* Expanded content — grid-template-rows animation for smooth height */}
  <div
    className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
    style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
  >
    <div className="overflow-hidden">
      <div className="px-3 pb-4 pt-1 border-t border-border flex flex-col gap-4">

        {/* Label */}
        <Input
          label="Item Label"
          id={`item-label-${item.tempId}`}
          value={item.itemLabel}
          onChange={e => onChange({ ...item, itemLabel: e.target.value })}
          placeholder={`Item ${index + 2}`}
        />

        {/* Dates row */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" id={`item-date-${item.tempId}`} value={item.date} onChange={e => onChange({ ...item, date: e.target.value })} required />
          <Input label="Due Date" type="date" id={`item-due-${item.tempId}`} value={item.dueDate} onChange={e => onChange({ ...item, dueDate: e.target.value })} required />
        </div>
        {item.status === 'Dispatched' && (
          <Input label="Dispatch Date" type="date" id={`item-dispatch-${item.tempId}`} value={item.dispatchDate} onChange={e => onChange({ ...item, dispatchDate: e.target.value })} />
        )}

        {/* Dimensions + Qty */}
        <div className="grid grid-cols-3 gap-3">
          <Input label="Length" type="number" step="0.01" placeholder="cm" id={`item-l-${item.tempId}`} value={item.length} onChange={e => onChange({ ...item, length: e.target.value })} />
          <Input label="Width" type="number" step="0.01" placeholder="cm" id={`item-w-${item.tempId}`} value={item.width} onChange={e => onChange({ ...item, width: e.target.value })} />
          <Input label="Qty" type="number" min="1" id={`item-qty-${item.tempId}`} value={item.qty} onChange={e => onChange({ ...item, qty: e.target.value })} required />
        </div>

        {/* Status segmented control */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Status</label>
          <div role="radiogroup" aria-label="Item status" className="grid grid-cols-2 gap-2 sm:grid-cols-4 bg-muted p-1 rounded-xl border border-border">
            {(['Pending', 'In Progress', 'Packing', 'Dispatched'] as OrderStatus[]).map(s => (
              <button
                key={s} type="button" role="radio" aria-checked={item.status === s}
                className={`py-2 px-1 text-xs font-semibold rounded-lg transition-colors min-tap ${
                  item.status === s
                    ? 'bg-card shadow-sm text-primary border border-border/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
                onClick={() => {
                  const updated = { ...item, status: s };
                  if (s === 'Dispatched' && !item.dispatchDate) {
                    updated.dispatchDate = new Date().toISOString().split('T')[0];
                  }
                  onChange(updated);
                }}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`item-desc-${item.tempId}`} className="text-sm font-medium text-foreground">Description</label>
          <textarea
            id={`item-desc-${item.tempId}`}
            rows={2}
            className="w-full p-3.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground"
            placeholder="Notes for this item..."
            value={item.description}
            onChange={e => onChange({ ...item, description: e.target.value })}
          />
        </div>

        {/* Photo — reuse same pattern as main form */}
        <SubItemPhotoField
          tempId={item.tempId}
          photoPath={item.photoPath}
          isUploading={photoUploadingIds.has(item.tempId)}
          onUpload={(file) => onPhotoUpload(item.tempId, file)}
          onRemove={() => onPhotoRemove(item.tempId)}
        />

        {/* Audio — reuse same pattern */}
        <SubItemAudioField
          tempId={item.tempId}
          audioPath={item.audioPath}
          isUploading={audioUploadingIds.has(item.tempId)}
          isRecording={audioRecordingId === item.tempId}
          onStart={() => onAudioRecord(item.tempId)}
          onDelete={() => onAudioDelete(item.tempId)}
        />

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="self-start text-xs font-bold text-destructive hover:text-destructive/80 py-2 px-3 rounded-xl hover:bg-destructive/10 transition-colors min-tap"
        >
          Remove this item
        </button>
      </div>
    </div>
  </div>
</div>
```

Also add simplified `SubItemPhotoField` and `SubItemAudioField` inline components (same dashed-border upload button pattern as in the main form, but scoped to a sub-item's `tempId`). These call the parent-provided callbacks.
</action>

<acceptance_criteria>
- `order-form-sheet.tsx` contains `interface SubItemCardProps {`
- `order-form-sheet.tsx` contains `function SubItemCard(` 
- `SubItemCard` uses `grid-template-rows` transition (not `height` animation)
- `SubItemCard` contains `role="radiogroup"` for status segmented control
- All interactive elements inside `SubItemCard` have `min-tap` class
- `SubItemCard` drag handle has `aria-label="Drag to reorder"` and `touch-none` class
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 2 — Drag-to-reorder with touch support

<read_first>
- `components/dashboard/order-form-sheet.tsx` (after Task 1)
- `app/globals.css` (check existing CSS patterns — do not add new files)
</read_first>

<action>
Implement drag-to-reorder using the **HTML5 Drag and Drop API + touch event fallback** — no new package required.

Add a `useDragSort` hook inline in the form file (above `SubItemCard`):

```typescript
function useDragSort<T>(items: T[], setItems: (items: T[]) => void) {
  const dragIndex = useRef<number | null>(null);
  const touchStartY = useRef<number>(0);

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    const newItems = [...items];
    const [moved] = newItems.splice(dragIndex.current, 1);
    newItems.splice(index, 0, moved);
    dragIndex.current = index;
    setItems(newItems);
  };

  const handleDragEnd = () => { dragIndex.current = null; };

  // Touch support
  const handleTouchStart = (index: number) => (e: React.TouchEvent) => {
    dragIndex.current = index;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Touch drag is handled via overlay — find element at touch point
    e.preventDefault();
  };

  const handleTouchEnd = () => { dragIndex.current = null; };

  return { handleDragStart, handleDragOver, handleDragEnd, handleTouchStart, handleTouchMove, handleTouchEnd };
}
```

Wire `dragHandleProps` on `SubItemCard` using these handlers on each card's wrapping `div`.

Each `SubItemCard` wrapping `div` in the list gets:
```tsx
draggable
onDragStart={handleDragStart(idx)}
onDragOver={handleDragOver(idx)}
onDragEnd={handleDragEnd}
```
The drag handle div inside gets `onTouchStart` / `onTouchEnd`.
</action>

<acceptance_criteria>
- `order-form-sheet.tsx` contains `function useDragSort<T>(`
- `order-form-sheet.tsx` contains `handleDragStart`, `handleDragOver`, `handleDragEnd`
- Sub-item list wrapper divs have `draggable` attribute
- Touch handlers (`handleTouchStart`, `handleTouchEnd`) attached to drag handle
</acceptance_criteria>

---

### Task 3 — Assemble sub-item section in the form JSX

<read_first>
- `components/dashboard/order-form-sheet.tsx` (after Tasks 1 and 2 — look for the form JSX starting at `return (`)
- `.planning/phases/08-sub-orders/01-CONTEXT.md` (Area 2: "+ Add Item" position)
</read_first>

<action>
In the form JSX inside `<form onSubmit={handleSubmit} ...>`, insert the sub-item section between the description textarea block and the photo/audio section:

```tsx
{/* ── Draft restore banner ─────────────────────────────── */}
{pendingDraft && (
  <div className="animate-in slide-in-from-top-2 fade-in duration-200 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex flex-col gap-3">
    <div>
      <p className="text-sm font-bold text-foreground">Unsaved draft found</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        From {new Date(pendingDraft.savedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
      </p>
    </div>
    <div className="flex gap-2">
      <Button type="button" size="sm" onClick={restoreDraft} className="flex-1">Restore draft</Button>
      <Button type="button" size="sm" variant="ghost" onClick={discardDraft} className="flex-1">Discard</Button>
    </div>
  </div>
)}

{/* ── Sub-items list ────────────────────────────────────── */}
{subItems.length > 0 && (
  <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold text-foreground tracking-tight">
        Additional Items
        <span className="ml-2 text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{subItems.length}</span>
      </span>
    </div>
    {subItems.map((item, idx) => (
      <div
        key={item.tempId}
        draggable
        onDragStart={handleDragStart(idx)}
        onDragOver={handleDragOver(idx)}
        onDragEnd={handleDragEnd}
      >
        <SubItemCard
          item={item}
          index={idx}
          isExpanded={expandedSubItem === item.tempId}
          onToggle={() => setExpandedSubItem(prev => prev === item.tempId ? null : item.tempId)}
          onChange={(updated) => setSubItems(prev => prev.map(i => i.tempId === updated.tempId ? updated : i))}
          onRemove={() => setSubItems(prev => prev.filter(i => i.tempId !== item.tempId))}
          dragHandleProps={{ onTouchStart: handleTouchStart(idx), onTouchEnd: handleTouchEnd }}
          onPhotoUpload={handleSubItemPhotoUpload}
          onPhotoRemove={handleSubItemPhotoRemove}
          onAudioRecord={handleSubItemAudioRecord}
          onAudioDelete={handleSubItemAudioDelete}
          photoUploadingIds={subItemPhotoUploadingIds}
          audioUploadingIds={subItemAudioUploadingIds}
          audioRecordingId={subItemRecordingId}
        />
      </div>
    ))}
  </div>
)}

{/* ── Add Item button ───────────────────────────────────── */}
<button
  type="button"
  onClick={() => {
    const today = date || new Date().toISOString().split('T')[0];
    const due = dueDate || new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
    const newItem: SubItemDraft = {
      tempId: crypto.randomUUID(),
      dbId: null,
      itemLabel: `Item ${subItems.length + 2}`,
      date: today,
      dueDate: due,
      dispatchDate: '',
      length: '', width: '', qty: '1',
      status: 'Pending',
      description: '',
      photoPath: null, audioPath: null,
    };
    setSubItems(prev => [...prev, newItem]);
    // Auto-expand the new item
    setExpandedSubItem(newItem.tempId);
  }}
  className="w-full h-14 border-2 border-dashed border-border rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors min-tap"
>
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  Add Item
</button>
```

Also add state for expanded sub-item tracking:
```typescript
const [expandedSubItem, setExpandedSubItem] = useState<string | null>(null);
```

And add these sub-item media upload state variables:
```typescript
const [subItemPhotoUploadingIds, setSubItemPhotoUploadingIds] = useState<Set<string>>(new Set());
const [subItemAudioUploadingIds, setSubItemAudioUploadingIds] = useState<Set<string>>(new Set());
const [subItemRecordingId, setSubItemRecordingId] = useState<string | null>(null);
```

Implement `handleSubItemPhotoUpload(tempId, file)` — same logic as main `handlePhotoUpload` but updates the matching `subItems` entry's `photoPath` and tracks uploading state in `subItemPhotoUploadingIds`.

Implement `handleSubItemAudioRecord(tempId)` — same MediaRecorder logic as main `startRecording` but tracks in `subItemRecordingId` and updates `subItems[item.tempId].audioPath`.

Implement `handleSubItemAudioDelete(tempId)` — clears `audioPath` on matching sub-item.

Implement `handleSubItemPhotoRemove(tempId)` — clears `photoPath` on matching sub-item.
</action>

<acceptance_criteria>
- `order-form-sheet.tsx` JSX contains the draft restore banner (`pendingDraft &&`)
- `order-form-sheet.tsx` JSX contains `Add Item` button with `border-dashed border-2` classes
- `order-form-sheet.tsx` contains `expandedSubItem` state
- `order-form-sheet.tsx` contains `subItemPhotoUploadingIds`, `subItemAudioUploadingIds`, `subItemRecordingId` state
- `order-form-sheet.tsx` contains `handleSubItemPhotoUpload`, `handleSubItemPhotoRemove`, `handleSubItemAudioRecord`, `handleSubItemAudioDelete` functions
- New sub-item is auto-expanded when added (`setExpandedSubItem(newItem.tempId)`)
- Dates pre-filled from parent form's `date` and `dueDate` values
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 4 — Smart duplicate detection dialog

<read_first>
- `components/dashboard/order-form-sheet.tsx` — specifically `handleSubmit` function
- `.planning/phases/08-sub-orders/01-CONTEXT.md` (Area 4: Smart duplicate detection)
</read_first>

<action>
Add duplicate detection state and inline dialog:

```typescript
const [duplicateOrder, setDuplicateOrder] = useState<{ id: string; order_no: string; customer_name: string } | null>(null);
const [pendingSubItemData, setPendingSubItemData] = useState<any>(null); // holds form data waiting for user decision
```

Update `handleSubmit` error handling in the `catch` block. Replace the duplicate error branch:

```typescript
if (msg.includes('duplicate') || msg.includes('unique')) {
  // Look up the conflicting order
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id, order_no, customer_name')
    .eq('order_no', orderNo.trim())
    .single();

  if (existingOrder && existingOrder.customer_name.trim().toLowerCase() === customerName.trim().toLowerCase()) {
    // Same customer — offer to add as sub-item
    setDuplicateOrder(existingOrder);
    setPendingSubItemData({
      order_id: existingOrder.id,
      item_label: `Item added ${new Date().toLocaleDateString('en-IN')}`,
      date, due_date: dueDate,
      dispatch_date: status === 'Dispatched' ? (dispatchDate || null) : null,
      length: length ? parseFloat(length) : null,
      width: width ? parseFloat(width) : null,
      qty: parseInt(qty, 10),
      status, description,
      photo_url: photoPath,
      audio_url: audioPath,
    });
  } else {
    toast.error('Order No ' + orderNo + ' is already used by a different customer. Please choose a different Order No.');
  }
}
```

Add duplicate dialog JSX **inside the `<Drawer>` but above the form** (shown when `duplicateOrder !== null`):

```tsx
{duplicateOrder && (
  <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 absolute inset-x-4 bottom-24 z-10 bg-card border border-border rounded-2xl shadow-xl p-5 flex flex-col gap-4">
    <div>
      <p className="text-sm font-bold text-foreground leading-snug">
        Order #{duplicateOrder.order_no} for {duplicateOrder.customer_name} already exists.
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Would you like to add this as a new item to that order instead?
      </p>
    </div>
    <div className="flex gap-2">
      <Button
        type="button"
        className="flex-1"
        loading={loading}
        loadingText="Adding…"
        onClick={async () => {
          setLoading(true);
          try {
            const { error } = await (supabase.from('order_items') as any).insert(pendingSubItemData);
            if (error) throw error;
            clearDraft(order?.id ?? null);
            setDuplicateOrder(null);
            setPendingSubItemData(null);
            onClose();
          } catch {
            toast.error("Couldn't add the item. Please try again.");
          } finally { setLoading(false); }
        }}
      >
        Add as Sub-Item
      </Button>
      <Button type="button" variant="ghost" className="flex-1" onClick={() => { setDuplicateOrder(null); setPendingSubItemData(null); }}>
        Change Order No
      </Button>
    </div>
  </div>
)}
```
</action>

<acceptance_criteria>
- `order-form-sheet.tsx` contains `duplicateOrder` state (`useState<{ id: string; order_no: string; customer_name: string } | null>`)
- `order-form-sheet.tsx` `handleSubmit` queries existing order by `order_no` on unique violation
- `order-form-sheet.tsx` compares `customer_name` case-insensitively (`toLowerCase()`)
- Duplicate dialog JSX contains "Add as Sub-Item" and "Change Order No" buttons
- "Add as Sub-Item" inserts into `order_items` table
- After successful sub-item insert: `clearDraft`, `onClose` called
- Different customer → `toast.error('Order No ... is already used by a different customer...')`
- `npx tsc --noEmit` exits 0
</acceptance_criteria>

---

## Verification

```bash
npx tsc --noEmit
grep -n "SubItemCard\|useDragSort\|expandedSubItem\|Add Item\|duplicateOrder" components/dashboard/order-form-sheet.tsx | head -30
grep -n "grid-template-rows\|rotate-180" components/dashboard/order-form-sheet.tsx
grep -n "handleSubItemPhoto\|handleSubItemAudio" components/dashboard/order-form-sheet.tsx
```

## must_haves

- Sub-item accordion uses `grid-template-rows` animation (not height)
- "+ Add Item" is a full-width dashed-border button
- New items auto-expand when added
- Dates pre-filled from parent form dates
- Drag handles have 44px tap target and `touch-none`
- Smart duplicate dialog uses inline UI (not `window.confirm`)
- Zero TypeScript errors
