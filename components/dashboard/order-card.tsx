import { Badge } from '@/components/ui/badge';
import { formatDate, cn } from '@/lib/utils';
import { getCategoryColor } from '@/lib/category-colors';
import type { OrderWithCategory } from '@/types/database';

interface OrderCardProps {
  order: OrderWithCategory;
  onClick?: () => void;
  className?: string;
}

export function OrderCard({ order, onClick, className }: OrderCardProps) {
  const catColor = order.categories ? getCategoryColor(order.categories.id, order.categories.color) : null;

  return (
    <button
      className={cn(
        "group block w-full text-left p-4 rounded-3xl border bg-card text-card-foreground border-border shadow-sm hover:shadow-md transition-all duration-200 min-tap relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
        className
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[17px] font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
              {order.order_no}
            </span>
            {order.categories && catColor ? (
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${catColor.bg} ${catColor.text} ${catColor.border} dark:bg-opacity-20 dark:border-opacity-30`}>
                {order.categories.name}
              </span>
            ) : (
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-0.5 bg-muted rounded-md">
                Uncategorized
              </span>
            )}
          </div>
          <h3 className="font-bold text-base truncate pr-2">
            {order.customer_name}
          </h3>
        </div>
        <Badge status={order.status} className="whitespace-nowrap shrink-0 mt-0.5 shadow-sm" />
      </div>

      <div className="flex justify-between items-end border-t border-border pt-3 mt-1 transition-colors">
        <div className="flex-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Due Date</p>
          <p className="text-sm font-semibold">{formatDate(order.due_date)}</p>
        </div>
        
        <div className="text-right">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Qty</p>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full font-bold text-sm">
            {order.qty}
          </div>
        </div>
      </div>
    </button>
  );
}
