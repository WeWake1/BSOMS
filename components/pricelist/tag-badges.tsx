import { cn } from '@/lib/utils';

/** Small visual badges for product tags (Waterproof, Semi-WP, ISI, …). */
export function TagBadges({ tags, className }: { tags?: string[] | null; className?: string }) {
  if (!tags || tags.length === 0) return null;
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide leading-none"
        >
          {t}
        </span>
      ))}
    </span>
  );
}
