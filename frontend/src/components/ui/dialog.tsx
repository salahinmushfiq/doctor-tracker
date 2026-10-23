'use client';

import * as React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;

export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
      <RadixDialog.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto',
          'rounded-xl border border-line bg-surface p-6 shadow-pop',
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <RadixDialog.Title className="text-lg font-semibold text-ink">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-1 text-sm text-ink-muted">{description}</RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close asChild>
            <Button variant="ghost" size="icon" className="-mt-2 -mr-2 h-8 w-8" aria-label="Close dialog">
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </RadixDialog.Close>
        </div>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
}

/** Accessible confirmation: focus is trapped, Esc / Cancel close it, the consequence is spelled out. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Cancel', destructive, pending, error, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent title={title} description={description}>
        {error && (
          <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} loading={pending} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
