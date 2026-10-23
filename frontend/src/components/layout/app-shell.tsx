'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as RadixDialog from '@radix-ui/react-dialog';
import { ChevronDown, LayoutDashboard, LogOut, Menu, Stethoscope, Users, X } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/doctors', label: 'Doctors', icon: Stethoscope },
  { href: '/patients', label: 'Patients', icon: Users },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 rounded-md px-1 text-ink">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white" aria-hidden>
        <Stethoscope className="h-4 w-4" />
      </span>
      <span className="text-base font-semibold tracking-tight">Doctor Tracker</span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'bg-accent-soft text-accent-hover' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" aria-label={`Account menu for ${user.name}`}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-hover" aria-hidden>
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block text-sm font-medium text-ink">{user.name}</span>
          <span className="block">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function sectionTitle(pathname: string) {
  return NAV.find((n) => isActive(pathname, n.href))?.label ?? 'Doctor Tracker';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [drawer, setDrawer] = React.useState(false);

  return (
    <div className="min-h-screen lg:pl-62">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-62 flex-col border-r border-line bg-surface p-4 lg:flex">
        <div className="mb-6 px-1 pt-1">
          <Brand />
        </div>
        <NavLinks />
        <div className="mt-auto rounded-lg bg-surface-muted p-3 text-[13px]">
          <p className="font-medium text-ink">{user?.name}</p>
          <p className="truncate text-ink-muted">{user?.email}</p>
          <Badge tone={user?.role === 'admin' ? 'accent' : 'neutral'} className="mt-2">
            {user?.role === 'admin' ? 'Administrator' : 'Read-only viewer'}
          </Badge>
        </div>
      </aside>

      {/* Mobile / tablet drawer */}
      <RadixDialog.Root open={drawer} onOpenChange={setDrawer}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/40 lg:hidden" />
          <RadixDialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-surface p-4 shadow-pop lg:hidden">
            <RadixDialog.Title className="sr-only">Navigation menu</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">Main navigation links</RadixDialog.Description>
            <div className="mb-6 flex items-center justify-between">
              <Brand />
              <RadixDialog.Close asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Close menu">
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </RadixDialog.Close>
            </div>
            <NavLinks onNavigate={() => setDrawer(false)} />
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur-none sm:px-6">
          <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}>
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
          <span className="text-sm font-semibold text-ink lg:text-[15px]" aria-hidden={pathname === '/'}>
            {sectionTitle(pathname)}
          </span>
          {user?.role === 'viewer' && (
            <Badge tone="warning" className="ml-1">
              Read-only
            </Badge>
          )}
          <div className="ml-auto">
            <AccountMenu />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
