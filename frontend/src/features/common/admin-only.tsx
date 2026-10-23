'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { useAuth } from '@/providers/auth-provider';

/** UI affordance only (the API enforces roles): explains why a read-only account cannot see a form. */
export function AdminOnly({ children, backHref, what }: { children: React.ReactNode; backHref: string; what: string }) {
  const { isAdmin } = useAuth();
  if (isAdmin) return <>{children}</>;
  return (
    <EmptyState
      title="Administrator access required"
      description={`Your account is read-only, so it cannot ${what}.`}
      action={
        <Button asChild variant="secondary">
          <Link href={backHref}>Go back</Link>
        </Button>
      }
    />
  );
}
