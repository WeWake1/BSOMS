'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  titleTransitionName?: string;
}

export function Drawer({ isOpen, onClose, children, title, titleTransitionName }: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Move focus into the drawer panel
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // M2: Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col justify-end',
        // M3: proper visibility toggling instead of opacity-only
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      )}
      // M3: aria-hidden keeps closed drawers out of the accessibility tree
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <button
        className={cn(
          'absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default focus:outline-none w-full h-full text-transparent transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
        aria-label="Close drawer"
        tabIndex={-1}
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ? String(title) : 'Bottom sheet'}
        tabIndex={-1}
        className={cn(
          // M2: expo-out easing for native-feeling bottom-sheet slide
          'relative w-full max-w-2xl mx-auto bg-card rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]',
          'transition-transform duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] outline-none',
          isOpen ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2" aria-hidden="true">
          <div className="w-12 h-1.5 rounded-full bg-muted" />
        </div>

        {title && (
          <div className="flex items-center justify-between px-6 pb-2 border-b border-border shrink-0">
            <h2
              className="text-lg font-bold text-foreground tracking-tight"
              style={titleTransitionName ? { viewTransitionName: titleTransitionName } as any : {}}
            >{title}</h2>
            <button
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close bottom sheet"
            >
              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        <div className="px-6 py-4 overflow-y-auto overscroll-contain pb-safe shrink">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
