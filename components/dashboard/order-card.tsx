import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { OrderWithCategory } from '@/types/database';

interface OrderCardProps {
  order: OrderWithCategory;
}

export function OrderCard({ order }: OrderCardProps) {
  return (
    <button
      className="w-full bg-white rounded-2xl border border-gray-200 p-4 text-left hover:shadow-md hover:border-indigo-200 transition-all active:scale-[0.99] min-tap flex flex-col gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      onClick={() => {
        // Phase 4: Open Bottom Sheet
        console.log('Open order:', order.id);
      }}
    >
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[17px] font-bold text-gray-900 tracking-tight group-hover:text-indigo-700 transition-colors">
              {order.order_no}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-2 py-0.5 bg-gray-100 rounded-md">
              {order.categories?.name || 'Uncategorized'}
            </span>
          </div>
          <h3 className="text-[15px] font-semibold text-gray-700 line-clamp-1">
            {order.customer_name}
          </h3>
        </div>
        <Badge status={order.status} className="whitespace-nowrap shrink-0 mt-0.5 shadow-sm" />
      </div>

      <div className="flex justify-between items-end border-t border-gray-100 pt-3 mt-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Due Date</span>
          <span className="text-[13px] font-bold text-gray-800">{formatDate(order.due_date)}</span>
        </div>
        <div className="flex items-center gap-1.5">
           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Qty</span>
           <div className="text-[13px] font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-lg">
             {order.qty}
           </div>
        </div>
      </div>
    </button>
  );
}
