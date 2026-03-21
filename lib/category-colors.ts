/**
 * Category color palette — user-selected, stored in DB.
 * Each color key maps to Tailwind classes for bg, text, border, and dot.
 */

export type CategoryColorKey = 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'orange' | 'pink' | 'teal' | 'indigo' | 'lime' | 'fuchsia';

export const CATEGORY_COLOR_OPTIONS: { key: CategoryColorKey; label: string; bg: string; text: string; border: string; dot: string; swatch: string }[] = [
  { key: 'violet',  label: 'Violet',  bg: 'bg-violet-100 dark:bg-violet-900/30',  text: 'text-violet-700 dark:text-violet-400',  border: 'border-violet-200 dark:border-violet-800',  dot: 'bg-violet-500 dark:bg-violet-400',  swatch: 'bg-violet-400 dark:bg-violet-500' },
  { key: 'blue',    label: 'Blue',    bg: 'bg-blue-100 dark:bg-blue-900/30',      text: 'text-blue-700 dark:text-blue-400',      border: 'border-blue-200 dark:border-blue-800',      dot: 'bg-blue-500 dark:bg-blue-400',      swatch: 'bg-blue-400 dark:bg-blue-500' },
  { key: 'emerald', label: 'Green',   bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500 dark:bg-emerald-400', swatch: 'bg-emerald-400 dark:bg-emerald-500' },
  { key: 'amber',   label: 'Amber',   bg: 'bg-amber-100 dark:bg-amber-900/30',    text: 'text-amber-700 dark:text-amber-400',    border: 'border-amber-200 dark:border-amber-800',    dot: 'bg-amber-500 dark:bg-amber-400',    swatch: 'bg-amber-400 dark:bg-amber-500' },
  { key: 'rose',    label: 'Rose',    bg: 'bg-rose-100 dark:bg-rose-900/30',      text: 'text-rose-700 dark:text-rose-400',      border: 'border-rose-200 dark:border-rose-800',      dot: 'bg-rose-500 dark:bg-rose-400',      swatch: 'bg-rose-400 dark:bg-rose-500' },
  { key: 'cyan',    label: 'Cyan',    bg: 'bg-cyan-100 dark:bg-cyan-900/30',      text: 'text-cyan-700 dark:text-cyan-400',      border: 'border-cyan-200 dark:border-cyan-800',      dot: 'bg-cyan-500 dark:bg-cyan-400',      swatch: 'bg-cyan-400 dark:bg-cyan-500' },
  { key: 'orange',  label: 'Orange',  bg: 'bg-orange-100 dark:bg-orange-900/30',  text: 'text-orange-700 dark:text-orange-400',  border: 'border-orange-200 dark:border-orange-800',  dot: 'bg-orange-500 dark:bg-orange-400',  swatch: 'bg-orange-400 dark:bg-orange-500' },
  { key: 'pink',    label: 'Pink',    bg: 'bg-pink-100 dark:bg-pink-900/30',      text: 'text-pink-700 dark:text-pink-400',      border: 'border-pink-200 dark:border-pink-800',      dot: 'bg-pink-500 dark:bg-pink-400',      swatch: 'bg-pink-400 dark:bg-pink-500' },
  { key: 'teal',    label: 'Teal',    bg: 'bg-teal-100 dark:bg-teal-900/30',      text: 'text-teal-700 dark:text-teal-400',      border: 'border-teal-200 dark:border-teal-800',      dot: 'bg-teal-500 dark:bg-teal-400',      swatch: 'bg-teal-400 dark:bg-teal-500' },
  { key: 'indigo',  label: 'Indigo',  bg: 'bg-indigo-100 dark:bg-indigo-900/30',  text: 'text-indigo-700 dark:text-indigo-400',  border: 'border-indigo-200 dark:border-indigo-800',  dot: 'bg-indigo-500 dark:bg-indigo-400',  swatch: 'bg-indigo-400 dark:bg-indigo-500' },
  { key: 'lime',    label: 'Lime',    bg: 'bg-lime-100 dark:bg-lime-900/30',      text: 'text-lime-700 dark:text-lime-400',      border: 'border-lime-200 dark:border-lime-800',      dot: 'bg-lime-500 dark:bg-lime-400',      swatch: 'bg-lime-400 dark:bg-lime-500' },
  { key: 'fuchsia', label: 'Fuchsia', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', text: 'text-fuchsia-700 dark:text-fuchsia-400', border: 'border-fuchsia-200 dark:border-fuchsia-800', dot: 'bg-fuchsia-500 dark:bg-fuchsia-400', swatch: 'bg-fuchsia-400 dark:bg-fuchsia-500' },
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
