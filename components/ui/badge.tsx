import { HTMLAttributes, forwardRef } from 'react';
import { cn, getStatusColor } from '@/lib/utils';
import type { OrderStatus } from '@/types/database';

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  status: OrderStatus | string;
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, status, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] uppercase tracking-wider font-bold border',
          getStatusColor(status),
          className
        )}
        {...props}
      >
        {status}
      </div>
    );
  }
);
Badge.displayName = 'Badge';

export { Badge };
