'use client';

export function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      {/* Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted/50 h-[130px] rounded-2xl" />
        ))}
      </div>
      {/* Hero */}
      <div className="bg-muted/50 h-[360px] rounded-3xl" />
      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-muted/50 h-[280px] rounded-3xl" />
        <div className="lg:col-span-4 bg-muted/50 h-[280px] rounded-3xl" />
      </div>
    </div>
  );
}
