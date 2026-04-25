import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { OrderStatus } from '@/types/database';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
