'use client';

import { cn, getStatusCardColor } from '@/lib/utils';
import type { OrderStatus } from '@/types/database';
import { AnimatedNumber } from '@/components/ui/animated-number';

interface StatusCounts {
  'Pending': number;
  'In Progress': number;
  'Packing': number;
  'Dispatched': number;
}

interface StatusCardsProps {
  counts: StatusCounts;
  activeFilter: OrderStatus | 'All';
  onFilterClick: (status: OrderStatus | 'All') => void;
  isConnected?: boolean;
}

export function StatusCards({ counts, activeFilter, onFilterClick, isConnected = false }: StatusCardsProps) {
  const statuses: OrderStatus[] = ['Pending', 'In Progress', 'Packing', 'Dispatched'];

  return (
    <div className="mb-6">
      {/* Live connection indicator */}
      <div className="flex items-center gap-1.5 mb-3 justify-end" aria-live="polite" aria-atomic="true">
        <div
          className={cn(
            'w-2 h-2 rounded-full transition-colors duration-500',
            isConnected
              ? 'bg-[var(--status-dispatched)] animate-live-pulse'
              : 'bg-muted-foreground opacity-40'
          )}
          aria-hidden="true"
        />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {isConnected ? 'Live' : 'Connecting…'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {statuses.map((status, i) => {
          const { bg, text, border, icon } = getStatusCardColor(status);
          const isActive = activeFilter === status;
          const staggerClass = ['animate-stagger-1','animate-stagger-2','animate-stagger-3','animate-stagger-4'][i];

          return (
            <button
              key={status}
              onClick={() => onFilterClick(isActive ? 'All' : status)}
              className={cn(
                'animate-fade-up flex flex-col p-4 rounded-2xl border text-left transition-[transform,box-shadow,opacity] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] min-tap relative overflow-hidden',
                bg,
                border,
                staggerClass,
                isActive
                  ? 'ring-2 ring-inset shadow-sm scale-[1.01] active:scale-[0.99]'
                  : 'opacity-85 hover:opacity-100 hover:shadow-sm hover:scale-[1.01] active:scale-[0.98]'
              )}
              style={isActive ? { '--tw-ring-color': 'currentColor' } as any : {}}
              aria-pressed={isActive}
            >
              {isActive && (
                <div className={cn('absolute top-0 left-0 right-0 h-[3px]', icon, 'bg-current')} aria-hidden="true" />
              )}
              <div className="flex justify-between items-start w-full mb-2">
                <span className={cn('text-[11px] font-bold tracking-widest uppercase', text)}>{status}</span>
                <div className={cn('w-3 h-3 rounded-full mt-0.5 shrink-0', icon, 'bg-current')} aria-hidden="true" />
              </div>
              {/* AnimatedNumber smoothly ticks when counts change via Realtime */}
              <AnimatedNumber
                value={counts[status]}
                className={cn('text-4xl font-extrabold tracking-tighter leading-none tabular-nums', text)}
              />
              <span className={cn('text-[10px] font-bold mt-2 uppercase tracking-widest', text, 'opacity-60')}>
                {isActive ? 'Filtered ↑' : 'tap to filter'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
