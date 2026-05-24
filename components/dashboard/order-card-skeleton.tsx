export function OrderCardSkeleton() {
  return (
    <div
      className="p-4 rounded-2xl border-l-4 border-l-muted border border-border bg-card shadow-sm animate-pulse"
      aria-hidden="true"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="h-5 w-20 rounded bg-muted" />
            <div className="h-4 w-16 rounded-md bg-muted" />
          </div>
          <div className="h-4 w-3/4 rounded bg-muted mb-2" />
          <div className="h-3 w-1/2 rounded bg-muted" />
        </div>
        <div className="h-6 w-20 rounded-full bg-muted shrink-0 mt-0.5" />
      </div>
      <div className="flex justify-between items-end border-t border-border pt-3 mt-3">
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 w-8 rounded bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
        <div className="text-right space-y-1.5">
          <div className="h-2.5 w-6 rounded bg-muted ml-auto" />
          <div className="h-6 w-12 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

