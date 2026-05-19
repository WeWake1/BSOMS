import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { OrderStatus } from '@/types/database';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Frosted-glass class presets, indexed by surface size.
 * Use with cn() so further classes can override / extend.
 *
 *   light   — small floats: tooltips, popovers, dropdowns, autocompletes
 *   medium  — sticky / fixed bars: top toolbars, bottom action bars
 *   heavy   — large content panels (sheets, modal panels)
 *
 * Each preset is JUST the background + backdrop-blur. Borders, shadows,
 * radius and padding stay in the caller so each surface can size itself.
 */
export const glass = {
  light: 'bg-card/95 backdrop-blur-md',
  medium: 'bg-background/80 backdrop-blur-xl',
  heavy: 'bg-card/90 backdrop-blur-lg',
} as const;

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Dimensions are stored as raw text (e.g. '43"2', '80', '74.6').
 * Just pass through as-is; return '—' for empty values.
 */
export function formatInches(val: string | number | null | undefined): string {
  if (val == null || val === '') return '—';
  return String(val);
}

/**
 * Strip everything except digits, then drop a leading 91 if total is 12 digits,
 * then cap at 10. Stored value is always 10 digits or '' (empty).
 *
 * Examples:
 *   '+91 97414 05332' → '9741405332'
 *   '919741405332'    → '9741405332'
 *   '9741405332'      → '9741405332'
 *   '974'             → '974'  (partial — caller decides if it's valid)
 */
export function sanitizeMobileInput(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function isValidIndianMobile(val: string | null | undefined): boolean {
  return !!val && /^\d{10}$/.test(val);
}

export function buildWhatsAppUrl(mobile: string | null | undefined): string | null {
  if (!isValidIndianMobile(mobile)) return null;
  return `https://wa.me/+91${mobile}`;
}

export function formatMobileDisplay(val: string | null | undefined): string {
  if (!val) return '—';
  if (/^\d{10}$/.test(val)) return `+91 ${val.slice(0, 5)} ${val.slice(5)}`;
  return val;
}

export function getStatusColor(status: OrderStatus | string): string {
  const colors: Record<string, string> = {
    'Pending': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    'In Progress': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    'Packing': 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    'Dispatched': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800',
  };
  return colors[status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
}


export function getStatusCardColor(status: OrderStatus | string): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  const map: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    'Pending': {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-900 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
      icon: 'text-amber-500 dark:text-amber-400',
    },
    'In Progress': {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-900 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'text-blue-500 dark:text-blue-400',
    },
    'Packing': {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-900 dark:text-purple-400',
      border: 'border-purple-200 dark:border-purple-800',
      icon: 'text-purple-500 dark:text-purple-400',
    },
    'Dispatched': {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-900 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800',
      icon: 'text-green-500 dark:text-green-400',
    },
  };
  return map[status] ?? { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-900 dark:text-gray-200', border: 'border-gray-200 dark:border-gray-700', icon: 'text-gray-500 dark:text-gray-400' };
}
