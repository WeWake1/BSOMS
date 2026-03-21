/**
 * Category color palette — user-selected, stored in DB.
 * Each color key maps to Tailwind classes for bg, text, border, and dot.
 */

export type CategoryColorKey = 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'orange' | 'pink' | 'teal' | 'indigo' | 'lime' | 'fuchsia';

export const CATEGORY_COLOR_OPTIONS: { key: CategoryColorKey; label: string; bg: string; text: string; border: string; dot: string; swatch: string }[] = [
  { key: 'violet',  label: 'Violet',  bg: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-500',  swatch: 'bg-violet-400' },
  { key: 'blue',    label: 'Blue',    bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500',    swatch: 'bg-blue-400' },
  { key: 'emerald', label: 'Green',   bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', swatch: 'bg-emerald-400' },
  { key: 'amber',   label: 'Amber',   bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500',   swatch: 'bg-amber-400' },
  { key: 'rose',    label: 'Rose',    bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500',    swatch: 'bg-rose-400' },
  { key: 'cyan',    label: 'Cyan',    bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-200',    dot: 'bg-cyan-500',    swatch: 'bg-cyan-400' },
  { key: 'orange',  label: 'Orange',  bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500',  swatch: 'bg-orange-400' },
  { key: 'pink',    label: 'Pink',    bg: 'bg-pink-100',    text: 'text-pink-700',    border: 'border-pink-200',    dot: 'bg-pink-500',    swatch: 'bg-pink-400' },
  { key: 'teal',    label: 'Teal',    bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500',    swatch: 'bg-teal-400' },
  { key: 'indigo',  label: 'Indigo',  bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-200',  dot: 'bg-indigo-500',  swatch: 'bg-indigo-400' },
  { key: 'lime',    label: 'Lime',    bg: 'bg-lime-100',    text: 'text-lime-700',    border: 'border-lime-200',    dot: 'bg-lime-500',    swatch: 'bg-lime-400' },
  { key: 'fuchsia', label: 'Fuchsia', bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200', dot: 'bg-fuchsia-500', swatch: 'bg-fuchsia-400' },
];

const DEFAULT_PALETTE = CATEGORY_COLOR_OPTIONS[0]; // violet fallback

/**
 * Returns TailwindCSS classes for a category based on its stored color key.
 * Falls back to deterministic hash if no color stored.
 */
export function getCategoryColor(categoryId: string, storedColor?: string | null) {
  if (storedColor) {
    const found = CATEGORY_COLOR_OPTIONS.find(c => c.key === storedColor);
    if (found) return found;
  }
  // Legacy: deterministic hash from UUID
  const hash = categoryId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CATEGORY_COLOR_OPTIONS[hash % CATEGORY_COLOR_OPTIONS.length];
}
