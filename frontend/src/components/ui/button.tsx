import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  primary: 'bg-accent text-white hover:bg-accent-hover disabled:bg-accent/60',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-ink hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:bg-[#8f1c13] disabled:bg-danger/60',
  link: 'text-accent underline-offset-2 hover:underline px-0 h-auto',
} as const;

const sizes = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  icon: 'h-10 w-10',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, asChild = false, disabled, children, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-80',
        variants[variant],
        variant !== 'link' && sizes[size],
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
});
