import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FieldControlProps {
  id: string;
  'aria-invalid': boolean | undefined;
  'aria-describedby': string | undefined;
  'aria-required': boolean | undefined;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: FieldControlProps) => React.ReactNode;
}

/** Label + control + hint + error, wired together with ids/aria so screen readers announce the problem. */
export function Field({ id, label, error, hint, required, className, children }: FieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const controlBase =
  'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted/70 ' +
  'transition-colors hover:border-[#b9c4d0] disabled:cursor-not-allowed disabled:bg-surface-muted ' +
  'aria-[invalid=true]:border-danger';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlBase, className)} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(controlBase, 'pr-8', className)} {...props}>
      {children}
    </select>
  );
});
