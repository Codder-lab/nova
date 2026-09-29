import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider transition-colors',
  {
    variants: {
      variant: {
        default:
          'border border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
        secondary:
          'border border-slate-700 bg-slate-800/80 text-slate-300',
        destructive:
          'border border-rose-500/30 bg-rose-500/15 text-rose-300',
        outline:
          'border border-white/10 text-slate-300',
        success:
          'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
        warning:
          'border border-amber-500/30 bg-amber-500/15 text-amber-300',
        cyan:
          'border border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
