import { Badge } from '@/components/ui/badge';
import { formatDate, cn } from '@/lib/utils';
import { getCategoryColor } from '@/lib/category-colors';
import type { OrderStatus, OrderWithCategory } from '@/types/database';

interface OrderCardProps {
  order: OrderWithCategory;
  isAdmin?: boolean;
  onStatusChange?: (status: OrderStatus) => void;
  onClick?: () => void;
  className?: string;
}

export function OrderCard({ order, isAdmin, onStatusChange, onClick, className }: OrderCardProps) {
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
          <h3 className="font-bold text-base truncate pr-2 text-foreground">
            {order.customer_name}
          </h3>
          {(order.length || order.width) && (
             <p className="text-xs text-muted-foreground mt-0.5 font-medium">
               Size: {order.length || '-'} × {order.width || '-'}
             </p>
          )}
        </div>
        <div className="relative shrink-0 mt-0.5">
          <Badge status={order.status} className="whitespace-nowrap shadow-sm" />
          {isAdmin && onStatusChange && (
            <select
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              value={order.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onStatusChange(e.target.value as any);
              }}
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Packing">Packing</option>
              <option value="Dispatched">Dispatched</option>
            </select>
          )}
        </div>
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

export function OrderListItem({ order, isAdmin, onStatusChange, onClick, className }: OrderCardProps) {
  const catColor = order.categories ? getCategoryColor(order.categories.id, order.categories.color) : null;

  return (
    <tr 
      onClick={onClick}
      className={cn(
        "group hover:bg-muted/30 transition-colors cursor-pointer text-[14px]",
        className
      )}
    >
      <td className="px-6 py-3.5 align-middle">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full shrink-0", catColor ? catColor.dot : "bg-gray-200")} />
          <span className="font-semibold text-foreground text-[14px]">{order.order_no}</span>
        </div>
      </td>
      <td className="px-6 py-3.5 align-middle">
        <div className="flex flex-col">
          <span className="font-medium text-foreground truncate max-w-[200px] sm:max-w-xs">{order.customer_name}</span>
          <span className="text-xs text-muted-foreground">{order.categories?.name || 'Uncategorized'}</span>
        </div>
      </td>
      <td className="px-6 py-3.5 align-middle text-muted-foreground font-medium">
        {(order.length || order.width) ? `${order.length||'-'}×${order.width||'-'}` : '-'}
      </td>
      <td className="px-6 py-3.5 align-middle text-right font-bold">
        {order.qty}
      </td>
      <td className="px-6 py-3.5 align-middle text-center w-[120px]">
        <div className="relative inline-block" onClick={(e) => isAdmin ? null : e.stopPropagation()}>
          <Badge status={order.status} className="whitespace-nowrap shadow-sm text-[11px] py-1 pointer-events-none" />
          {isAdmin && onStatusChange && (
            <select
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              value={order.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onStatusChange(e.target.value as any);
              }}
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Packing">Packing</option>
              <option value="Dispatched">Dispatched</option>
            </select>
          )}
        </div>
      </td>
    </tr>
  );
}
