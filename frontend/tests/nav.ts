import { vi } from 'vitest';

/** Controllable stand-in for next/navigation. `search` is what useSearchParams() returns. */
export const nav = {
  pathname: '/',
  search: '',
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
};

export function resetNav(pathname = '/', search = '') {
  nav.pathname = pathname;
  nav.search = search;
  nav.replace.mockReset();
  nav.push.mockReset();
  nav.back.mockReset();
}
