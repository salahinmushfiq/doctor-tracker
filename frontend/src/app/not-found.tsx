import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="max-w-sm text-sm text-ink-muted">The page you are looking for does not exist or may have been moved.</p>
      <Button asChild className="mt-2">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
