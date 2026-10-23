'use client';

import * as React from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, align = 'end', ...props }: Menu.DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className={cn('z-50 min-w-48 rounded-lg border border-line bg-surface p-1 shadow-pop', className)}
        {...props}
      />
    </Menu.Portal>
  );
}

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, Menu.DropdownMenuItemProps & { danger?: boolean }>(function DropdownMenuItem(
  { className, danger, ...props },
  ref,
) {
  return (
    <Menu.Item
      ref={ref}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none select-none',
        'data-[highlighted]:bg-surface-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        danger ? 'text-danger' : 'text-ink',
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuLabel = ({ children }: { children: React.ReactNode }) => (
  <Menu.Label className="px-3 py-1.5 text-xs text-ink-muted">{children}</Menu.Label>
);
export const DropdownMenuSeparator = () => <Menu.Separator className="my-1 h-px bg-line" />;
