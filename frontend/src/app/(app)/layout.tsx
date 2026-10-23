'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { SlowNotice } from '@/components/layout/slow-notice';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { describeError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

function FullPageLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6" role="status" aria-label="Loading">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-4 w-72" />
      <SlowNotice active />
    </div>
  );
}

function PageFallback() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Client-side guard. NOT the security boundary - the API authenticates every request itself. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (auth.status !== 'unauthenticated') return;
    // Read the query string from the location (not useSearchParams, which would force a Suspense boundary around the whole app).
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    router.replace(`/login?${auth.sessionLost ? 'reason=expired&' : ''}next=${next}`);
  }, [auth.status, auth.sessionLost, pathname, router]);

  if (auth.status === 'loading' || auth.status === 'unauthenticated') return <FullPageLoading />;
  if (auth.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ErrorState title="Cannot reach the server" message={describeError(auth.error)} onRetry={auth.retry} />
      </div>
    );
  }
  return (
    <AppShell>
      <React.Suspense fallback={<PageFallback />}>{children}</React.Suspense>
    </AppShell>
  );
}
