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
              'flex flex-col p-4 rounded-2xl border text-left transition-all duration-200 min-tap',
              bg,
              isActive ? `ring-2 ring-offset-1 ${border}` : border,
              isActive ? 'shadow-sm' : 'hover:shadow-sm opacity-90 hover:opacity-100'
            )}
            aria-pressed={isActive}
          >
            <div className="flex justify-between items-start w-full mb-2">
              <span className={cn('text-sm font-semibold tracking-wide', text)}>{status}</span>
              <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5', icon, 'bg-current')} />
            </div>
            <span className={cn('text-3xl font-extrabold tracking-tighter', text)}>
              {counts[status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
