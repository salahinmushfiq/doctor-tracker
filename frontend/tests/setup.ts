import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { setCsrfToken, setUnauthorizedHandler } from '@/lib/api-client';
import { nav, resetNav } from './nav';
import { server } from './server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push, back: nav.back }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

// jsdom lacks these; Radix (dialogs/menus) and Recharts need them.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= RO as unknown as typeof ResizeObserver;
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  setCsrfToken(null);
  setUnauthorizedHandler(null);
  resetNav();
});
afterAll(() => server.close());
