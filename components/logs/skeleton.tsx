'use client';

function Block({ className = '' }: { className?: string }) {
  return <div className={`bg-muted rounded ${className}`} />;
}

function LogRowSkeleton({ withStatuses = false }: { withStatuses?: boolean }) {
  return (
    <li className="flex items-start gap-3 px-3.5 py-3">
      <Block className="w-8 h-8 rounded-full shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Block className="h-3.5 w-24" />
          <Block className="h-3.5 w-12 opacity-70" />
          <Block className="h-3.5 w-20" />
          <Block className="h-3.5 w-28 opacity-70" />
        </div>
        {withStatuses && (
          <div className="flex items-center gap-1.5">
            <Block className="h-4 w-16 rounded-full" />
            <Block className="h-3 w-3 opacity-60" />
            <Block className="h-4 w-16 rounded-full" />
          </div>
        )}
      </div>
      <Block className="h-3 w-10 shrink-0 mt-1.5 opacity-70" />
    </li>
  );
}

function LogGroupSkeleton({ rows = 4, statusRows = [] as number[] }: { rows?: number; statusRows?: number[] }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2 px-1">
        <Block className="h-2.5 w-20" />
        <Block className="h-2.5 w-6 opacity-60" />
      </div>
      <ul className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <LogRowSkeleton key={i} withStatuses={statusRows.includes(i)} />
        ))}
      </ul>
    </section>
  );
}

export function LogsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading activity"
      aria-live="polite"
      className="flex flex-col gap-6 animate-pulse"
    >
      <LogGroupSkeleton rows={5} statusRows={[1, 3]} />
      <LogGroupSkeleton rows={4} statusRows={[0, 2]} />
      <LogGroupSkeleton rows={3} statusRows={[1]} />
      <span className="sr-only">Loading activity…</span>
    </div>
  );
}
