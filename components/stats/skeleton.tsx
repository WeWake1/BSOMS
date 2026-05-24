'use client';

function Block({ className = '' }: { className?: string }) {
  return <div className={`bg-muted rounded ${className}`} />;
}

function PanelHeader() {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <div className="space-y-1.5">
        <Block className="h-4 w-32" />
        <Block className="h-2.5 w-44 opacity-70" />
      </div>
      <Block className="h-2.5 w-12 opacity-70" />
    </div>
  );
}

function Panel({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-2xl p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

function HorizontalBarRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Block className="h-3 w-1/3 shrink-0" />
          <Block className="h-5 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {/* MetricStrip — 6 cells, responsive grid mirroring the real component */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden grid divide-y sm:divide-y-0 divide-border grid-cols-2 sm:divide-x sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="relative px-4 py-3 sm:py-3.5 flex flex-col gap-1.5">
            <span className="absolute top-0 left-4 right-4 h-px bg-primary/15" aria-hidden="true" />
            <Block className="h-2.5 w-14" />
            <Block className="h-6 w-20 mt-0.5" />
            <Block className="h-2 w-24 opacity-70" />
          </div>
        ))}
      </div>

      {/* Category Performance (5) + Doors Made (7) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Panel className="lg:col-span-5">
          <PanelHeader />
          <HorizontalBarRows rows={6} />
        </Panel>
        <Panel className="lg:col-span-7 h-[300px]">
          <PanelHeader />
          <div className="flex items-end gap-2 h-[180px]">
            {[40, 65, 50, 80, 55, 90, 70, 85, 60, 75, 95, 65].map((h, i) => (
              <div key={i} className="flex-1 bg-muted rounded-sm" style={{ height: `${h}%` }} />
            ))}
          </div>
        </Panel>
      </div>

      {/* Order Trend (8) + Day of Week (4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Panel className="lg:col-span-8 h-[280px]">
          <PanelHeader />
          <div className="relative h-[170px] mt-1">
            <Block className="absolute inset-x-0 bottom-0 h-px opacity-50" />
            <Block className="absolute inset-x-0 bottom-1/3 h-px opacity-40" />
            <Block className="absolute inset-x-0 bottom-2/3 h-px opacity-40" />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">
              <path
                d="M0,40 L10,32 L20,35 L30,22 L40,28 L50,15 L60,20 L70,10 L80,18 L90,8 L100,14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                className="text-muted"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </Panel>
        <Panel className="lg:col-span-4 h-[280px]">
          <PanelHeader />
          <div className="flex items-end justify-between gap-1.5 h-[170px]">
            {[60, 80, 45, 95, 70, 55, 30].map((h, i) => (
              <div key={i} className="flex-1 bg-muted rounded-sm" style={{ height: `${h}%` }} />
            ))}
          </div>
        </Panel>
      </div>

      {/* Top Customers (7) + Top Dimensions (5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Panel className="lg:col-span-7">
          <PanelHeader />
          <HorizontalBarRows rows={7} />
        </Panel>
        <Panel className="lg:col-span-5">
          <PanelHeader />
          <HorizontalBarRows rows={7} />
        </Panel>
      </div>

      {/* Status Donut (4) + Period Comparison (8) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <Panel className="lg:col-span-4 h-[280px] flex items-center justify-center">
          <div className="relative w-40 h-40">
            <div className="absolute inset-0 rounded-full border-[18px] border-muted" />
            <div className="absolute inset-[18px] rounded-full bg-card flex items-center justify-center">
              <Block className="h-6 w-14" />
            </div>
          </div>
        </Panel>
        <Panel className="lg:col-span-8 h-[280px]">
          <PanelHeader />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Block className="h-2.5 w-12 opacity-70" />
                <Block className="h-6 w-16" />
                <Block className="h-2.5 w-10 opacity-60" />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
