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

export function getStatusColor(status: OrderStatus | string): string {
  const colors: Record<string, string> = {
    'Pending': 'bg-amber-100 text-amber-800 border-amber-200',
    'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
    'Packing': 'bg-purple-100 text-purple-800 border-purple-200',
    'Dispatched': 'bg-green-100 text-green-800 border-green-200',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-800 border-gray-200';
}

export function getStatusCardColor(status: OrderStatus | string): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  const map: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    'Pending': {
      bg: 'bg-amber-50',
      text: 'text-amber-900',
      border: 'border-amber-200',
      icon: 'text-amber-500',
    },
    'In Progress': {
      bg: 'bg-blue-50',
      text: 'text-blue-900',
      border: 'border-blue-200',
      icon: 'text-blue-500',
    },
    'Packing': {
      bg: 'bg-purple-50',
      text: 'text-purple-900',
      border: 'border-purple-200',
      icon: 'text-purple-500',
    },
    'Dispatched': {
      bg: 'bg-green-50',
      text: 'text-green-900',
      border: 'border-green-200',
      icon: 'text-green-500',
    },
  };
  return map[status] ?? { bg: 'bg-gray-50', text: 'text-gray-900', border: 'border-gray-200', icon: 'text-gray-500' };
}
