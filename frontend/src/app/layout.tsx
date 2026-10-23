import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Doctor Tracker', template: '%s · Doctor Tracker' },
  description: 'Manage doctors and patients, and follow clinic analytics.',
  // Private administrative app: keep it out of search indexes.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b7a75' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-pop"
        >
          Skip to main content
        </a>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
