import { cn, getStatusCardColor } from '@/lib/utils';
import type { OrderStatus } from '@/types/database';

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
}

export function StatusCards({ counts, activeFilter, onFilterClick }: StatusCardsProps) {
  const statuses: OrderStatus[] = ['Pending', 'In Progress', 'Packing', 'Dispatched'];

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {statuses.map((status) => {
        const { bg, text, border, icon } = getStatusCardColor(status);
        const isActive = activeFilter === status;

        return (
          <button
            key={status}
            onClick={() => onFilterClick(isActive ? 'All' : status)}
            className={cn(
              'flex flex-col p-4 rounded-2xl border text-left transition-all duration-200 min-tap relative overflow-hidden',
              bg,
              border,
              isActive
                ? 'ring-2 ring-inset shadow-sm scale-[1.01]'
                : 'opacity-85 hover:opacity-100 hover:shadow-sm active:scale-[0.98]'
            )}
            style={isActive ? { '--tw-ring-color': 'currentColor' } as any : {}}
            aria-pressed={isActive}
          >
            {/* Colored bar at top for active state */}
            {isActive && (
              <div className={cn('absolute top-0 left-0 right-0 h-[3px]', icon, 'bg-current')} aria-hidden="true" />
            )}
            <div className="flex justify-between items-start w-full mb-2">
              <span className={cn('text-[11px] font-bold tracking-widest uppercase', text)}>{status}</span>
              <div className={cn('w-3 h-3 rounded-full mt-0.5 shrink-0', icon, 'bg-current')} aria-hidden="true" />
            </div>
            <span className={cn('text-4xl font-extrabold tracking-tighter leading-none', text)}>
              {counts[status]}
            </span>
            <span className={cn('text-[10px] font-bold mt-2 uppercase tracking-widest', text, 'opacity-60')}>
              {isActive ? 'Filtered ↑' : 'tap to filter'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
