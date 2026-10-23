import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DoctorsPage } from '@/features/doctors/doctors-page';
import { resetNav } from '../nav';
import { API, apiError, doctor, paged, server, viewerSession } from '../server';
import { renderWithProviders } from '../test-utils';

const seen: URL[] = [];
const listing = (rows = [doctor(1), doctor(2)], over = {}) =>
  http.get(`${API}/doctors`, ({ request }) => {
    seen.push(new URL(request.url));
    return HttpResponse.json(paged(rows, over));
  });

describe('doctors list', () => {
  it('renders rows from the server', async () => {
    seen.length = 0;
    server.use(listing());
    renderWithProviders(<DoctorsPage />);
    expect(await screen.findAllByText('Dr. Test 1')).not.toHaveLength(0);
    expect(screen.getAllByText('Dr. Test 2').length).toBeGreaterThan(0);
    expect(seen[0].searchParams.get('sortBy')).toBe('createdAt');
    expect(seen[0].searchParams.get('sortOrder')).toBe('desc');
  });

  it('shows the first-run empty state with an Add action for admins', async () => {
    renderWithProviders(<DoctorsPage />);
    expect(await screen.findByText('No doctors yet')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Add doctor' }).length).toBeGreaterThan(0);
  });

  it('hides write actions from viewers', async () => {
    server.use(http.get(`${API}/auth/me`, () => HttpResponse.json({ success: true, data: viewerSession })));
    renderWithProviders(<DoctorsPage />);
    await screen.findByText('No doctors yet');
    expect(screen.queryByRole('link', { name: 'Add doctor' })).not.toBeInTheDocument();
  });

  it('shows an error state with retry, then recovers', async () => {
    let fail = true;
    server.use(http.get(`${API}/doctors`, () => (fail ? apiError(500, 'INTERNAL_ERROR', 'boom') : HttpResponse.json(paged([doctor(1)])))));
    renderWithProviders(<DoctorsPage />);
    expect(await screen.findByText(/something went wrong on our side/i)).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
    expect((await screen.findAllByText('Dr. Test 1')).length).toBeGreaterThan(0);
  });

  it('debounces search: one request for a burst of typing, then writes it to the URL', async () => {
    resetNav('/doctors', '');
    seen.length = 0;
    server.use(listing());
    const { nav } = await import('../nav');
    renderWithProviders(<DoctorsPage />);
    await screen.findAllByText('Dr. Test 1');
    const before = seen.length;
    await userEvent.type(screen.getByLabelText('Search doctors'), 'amin');
    await waitFor(() => expect(nav.replace).toHaveBeenCalled(), { timeout: 2000 });
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(String(nav.replace.mock.calls[0][0])).toContain('search=amin');
    expect(before).toBe(1);
  });

  it('reads state from the URL (deep link) and sends it to the API', async () => {
    resetNav('/doctors', 'page=3&limit=20&search=heart&specialization=Cardiology&sortBy=fullName&sortOrder=asc');
    seen.length = 0;
    server.use(listing([doctor(1)], { page: 3, limit: 20, total: 41, totalPages: 3 }));
    renderWithProviders(<DoctorsPage />);
    await screen.findAllByText('Dr. Test 1');
    const q = seen[0].searchParams;
    expect(Object.fromEntries(q)).toMatchObject({ page: '3', limit: '20', search: 'heart', specialization: 'Cardiology', sortBy: 'fullName', sortOrder: 'asc' });
    expect(screen.getByText(/41/)).toBeInTheDocument();
  });

  it('paginates through the URL', async () => {
    resetNav('/doctors', '');
    const { nav } = await import('../nav');
    server.use(listing([doctor(1)], { page: 1, limit: 10, total: 25, totalPages: 3 }));
    renderWithProviders(<DoctorsPage />);
    await screen.findAllByText('Dr. Test 1');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(String(nav.replace.mock.calls.at(-1)?.[0])).toContain('page=2');
  });

  it('sorts via column header and exposes aria-sort', async () => {
    resetNav('/doctors', 'sortBy=fullName&sortOrder=asc');
    server.use(listing());
    renderWithProviders(<DoctorsPage />);
    await screen.findAllByText('Dr. Test 1');
    const th = screen.getByRole('columnheader', { name: /doctor/i });
    expect(th).toHaveAttribute('aria-sort', 'ascending');
    const { nav } = await import('../nav');
    await userEvent.click(within(th).getByRole('button'));
    expect(String(nav.replace.mock.calls.at(-1)?.[0])).toContain('sortOrder=desc');
  });

  it('shows the no-results state with Reset when filters yield nothing', async () => {
    resetNav('/doctors', 'search=zzz');
    renderWithProviders(<DoctorsPage />);
    expect(await screen.findByText('No doctors match your search')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /reset/i }).length).toBeGreaterThan(0);
  });

  it('does not call the API with an inverted date range', async () => {
    resetNav('/doctors', 'startDate=2026-05-10&endDate=2026-05-01');
    seen.length = 0;
    server.use(listing());
    renderWithProviders(<DoctorsPage />);
    await screen.findAllByText(/.+/);
    await new Promise((r) => setTimeout(r, 100));
    expect(seen).toHaveLength(0);
  });
});
