'use client';

import { cn } from '@/lib/utils';
import type { PricelistTreeNode } from '@/types/database';

interface CategoryTabsProps {
  categories: PricelistTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryTabs({ categories, selectedId, onSelect }: CategoryTabsProps) {
  if (categories.length === 0) return null;
  return (
    <div className="-mx-4 sm:mx-0 px-4 sm:px-0 mb-4 overflow-x-auto no-scrollbar">
      <div className="flex gap-2 w-max">
        {categories.map((c) => {
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                'h-10 px-4 rounded-full text-sm font-bold whitespace-nowrap transition-colors min-tap border',
                active
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-foreground border-border hover:bg-muted'
              )}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
