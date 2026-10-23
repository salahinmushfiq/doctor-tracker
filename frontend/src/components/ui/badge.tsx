import { cn } from '@/lib/utils';

const tones = {
  neutral: 'bg-surface-muted text-ink',
  accent: 'bg-accent-soft text-accent-hover',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
} as const;

export function Badge({ tone = 'neutral', className, children }: { tone?: keyof typeof tones; className?: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>{children}</span>;
}
