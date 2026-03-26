import { Badge } from '@/components/ui/badge';
import { formatDate, cn } from '@/lib/utils';
import { getCategoryColor } from '@/lib/category-colors';
import { Select, SelectItem, SelectTrigger, SelectValue, SelectPopover, SelectListBox } from '@/components/ui/select';
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

  const statusBorderClass = {
    'Pending':     'status-border-pending',
    'In Progress': 'status-border-progress',
    'Packing':     'status-border-packing',
    'Dispatched':  'status-border-dispatched',
  }[order.status];

  return (
    <button
      className={cn(
        "group block w-full text-left p-4 rounded-2xl border-l-4 border border-border bg-card text-card-foreground shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] active:shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] min-tap relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        statusBorderClass,
        className
      )}
      onClick={onClick}
    >
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[17px] font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              {order.order_no}
            </span>
            {order.categories && catColor ? (
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${catColor.bg} ${catColor.text} ${catColor.border}`}>
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
        <div className="relative shrink-0 mt-0.5" onClick={(e) => isAdmin ? e.preventDefault() : null}>
          {isAdmin && onStatusChange ? (
            <Select
              selectedKey={order.status}
              onSelectionChange={(k) => onStatusChange(k as any)}
              aria-label="Change Status"
            >
              <SelectTrigger className="p-0 border-0 h-auto w-auto bg-transparent hover:bg-transparent data-[focus-visible]:ring-0 data-[focus-visible]:ring-offset-0 [&>svg]:hidden">
                <Badge status={order.status} className="whitespace-nowrap shadow-sm cursor-pointer hover:opacity-90 transition-opacity" />
              </SelectTrigger>
              <SelectPopover className="w-[140px]">
                <SelectListBox>
                  <SelectItem id="Pending">Pending</SelectItem>
                  <SelectItem id="In Progress">In Progress</SelectItem>
                  <SelectItem id="Packing">Packing</SelectItem>
                  <SelectItem id="Dispatched">Dispatched</SelectItem>
                </SelectListBox>
              </SelectPopover>
            </Select>
          ) : (
            <Badge status={order.status} className="whitespace-nowrap shadow-sm" />
          )}
        </div>
      </div>

      <div className="flex justify-between items-end border-t border-border pt-3 mt-1">
        <div className="flex-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Due Date</p>
          <p className="text-sm font-semibold text-foreground">{formatDate(order.due_date)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Qty</p>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 [color:var(--primary)] rounded-full font-bold text-sm transition-transform duration-150 group-hover:scale-105">
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
        <div className="relative inline-block" onClick={(e) => isAdmin ? e.stopPropagation() : null}>
          {isAdmin && onStatusChange ? (
            <Select
              selectedKey={order.status}
              onSelectionChange={(k) => onStatusChange(k as any)}
              aria-label="Change Status"
            >
              <SelectTrigger className="p-0 border-0 h-auto w-auto bg-transparent hover:bg-transparent data-[focus-visible]:ring-0 data-[focus-visible]:ring-offset-0 [&>svg]:hidden">
                <Badge status={order.status} className="whitespace-nowrap shadow-sm text-[11px] py-1 cursor-pointer hover:opacity-90 transition-opacity" />
              </SelectTrigger>
              <SelectPopover className="w-[140px]">
                <SelectListBox>
                  <SelectItem id="Pending">Pending</SelectItem>
                  <SelectItem id="In Progress">In Progress</SelectItem>
                  <SelectItem id="Packing">Packing</SelectItem>
                  <SelectItem id="Dispatched">Dispatched</SelectItem>
                </SelectListBox>
              </SelectPopover>
            </Select>
          ) : (
            <Badge status={order.status} className="whitespace-nowrap shadow-sm text-[11px] py-1 pointer-events-none" />
          )}
        </div>
      </td>
    </tr>
  );
}
