import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const inr = (n: number | string | null | undefined) =>
  '₹' +
  Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const STATUS_LABELS: Record<string, string> = {
  pending_verification: 'Pending Verification',
  approved: 'Approved',
  not_confirmed: 'Not Confirmed',
  cancelled: 'Cancelled',
  refund_pending: 'Refund Pending',
  refund_completed: 'Refund Completed',
  replacement_completed: 'Replacement Completed',
};

export const TAG_STYLES: Record<string, string> = {
  urgent: 'bg-rose-500/15 text-rose-500 ring-rose-500/30',
  duplicate: 'bg-orange-500/15 text-orange-500 ring-orange-500/30',
  vip: 'bg-amber-500/15 text-amber-500 ring-amber-500/30',
  refund: 'bg-sky-500/15 text-sky-500 ring-sky-500/30',
  replacement: 'bg-violet-500/15 text-violet-500 ring-violet-500/30',
  pending: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
  verified: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-500 ring-rose-500/30',
  completed: 'bg-teal-500/15 text-teal-500 ring-teal-500/30',
};

export const PRESET_TAGS = ['urgent', 'duplicate', 'vip', 'refund', 'replacement', 'verified', 'completed'];

export const STATUS_STYLES: Record<string, string> = {
  pending_verification: 'bg-amber-500/15 text-amber-500 ring-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30',
  not_confirmed: 'bg-rose-500/15 text-rose-500 ring-rose-500/30',
  cancelled: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
  refund_pending: 'bg-sky-500/15 text-sky-500 ring-sky-500/30',
  refund_completed: 'bg-teal-500/15 text-teal-500 ring-teal-500/30',
  replacement_completed: 'bg-violet-500/15 text-violet-500 ring-violet-500/30',
};
