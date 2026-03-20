---
plan: 01
phase: 4
wave: 1
title: Drawer and Overlay UI Primitives
depends_on: []
files_modified:
  - components/ui/drawer.tsx
autonomous: true
requirements_addressed: [ORD-01, ORD-03]
---

# Plan 01: Drawer and Overlay UI Primitives

## Objective

Build a reusable, mobile-first Bottom Sheet (Drawer) component that slides up from the bottom of the screen.

## Context

<read_first>
- .planning/phases/04-order-detail-form/04-CONTEXT.md
- tailwind.config.ts
</read_first>

## Tasks

### Task 1.1: Create Drawer Component

<action>
Create `components/ui/drawer.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function Drawer({ isOpen, onClose, children, title }: DrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col justify-end transition-opacity duration-300',
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
    >
      <button
        className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default focus:outline-none"
        onClick={onClose}
        aria-label="Close drawer mask"
        tabIndex={-1}
      />
      <div
        className={cn(
          'relative w-full max-w-2xl mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300 ease-out max-h-[90vh]',
          isOpen ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-gray-200" />
        </div>
        
        <div className="flex items-center justify-between px-6 pb-2 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors focus:outline-none min-tap"
            aria-label="Close bottom sheet"
          >
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div className="px-6 py-4 overflow-y-auto overscroll-contain pb-safe shrink">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
```
</action>

<acceptance_criteria>
- `components/ui/drawer.tsx` is created
- Uses `createPortal` to render at `document.body`
- Properly disables body scrolling when open
- Has animated enter/exit translations for a smooth slide-up effect
- Includes a drag handle visual indicator and close button
</acceptance_criteria>
