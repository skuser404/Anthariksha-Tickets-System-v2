import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn, STATUS_LABELS, STATUS_STYLES, TAG_STYLES } from '@/lib/utils';
import { AnimatedCounter } from './AnimatedCounter';

export { AnimatedCounter };

/* ----------------------------- Tag chip ----------------------------- */
export function Tag({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset', TAG_STYLES[label] ?? 'bg-slate-500/15 text-slate-400 ring-slate-500/30')}>
      {label}
      {onRemove && (
        <button onClick={onRemove} className="opacity-70 hover:opacity-100" aria-label={`Remove ${label}`}>×</button>
      )}
    </span>
  );
}

/* ----------------------------- Button ----------------------------- */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
        outline: 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
        ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
        danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
        success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
      },
      size: { sm: 'h-8 px-3', md: 'h-10 px-4', lg: 'h-11 px-6 text-base', icon: 'h-10 w-10' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

/* ----------------------------- Card ----------------------------- */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass p-5', className)} {...props} />;
}
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-medium text-slate-500 dark:text-slate-400', className)} {...props} />;
}

/* ----------------------------- Input ----------------------------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-slate-300/60 bg-white/60 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-xl border border-slate-300/60 bg-white/60 px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-slate-300/60 bg-white/60 px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 [&>option]:text-slate-900',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Label({ className, ...props }: HTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400', className)} {...props} />;
}

/* ----------------------------- Status badge ----------------------------- */
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        STATUS_STYLES[status] ?? 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/* ----------------------------- StatCard ----------------------------- */
export function StatCard({
  label,
  value,
  count,
  format,
  icon: Icon,
  tone = 'text-brand-500',
  sub,
}: {
  label: string;
  /** Static node to display. Ignored when `count` (a number to animate) is set. */
  value?: React.ReactNode;
  count?: number;
  format?: (n: number) => string;
  icon: LucideIcon;
  tone?: string;
  sub?: string;
}) {
  return (
    <Card className="lift flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-500/10">
          <Icon size={16} className={tone} />
        </span>
      </div>
      <span className="text-2xl font-bold tracking-tight">
        {count !== undefined ? <AnimatedCounter value={count} format={format} decimals={Number.isInteger(count) ? 0 : 1} /> : value}
      </span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </Card>
  );
}

/* ----------------------------- Skeleton & EmptyState ----------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-2xl bg-slate-300/40 dark:bg-white/[0.06]', className)} />;
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300/60 p-12 text-center dark:border-white/10">
      {icon}
      <p className="font-medium">{title}</p>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
    </div>
  );
}
