import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoginPage from '@/app/(auth)/login/page';
import { getCsrfToken } from '@/lib/api-client';
import { nav, resetNav } from '../nav';
import { API, adminSession, apiError, server } from '../server';
import { renderWithProviders } from '../test-utils';

const anonymous = () => http.get(`${API}/auth/me`, () => apiError(401, 'UNAUTHENTICATED', 'Sign in required'));

describe('login form', () => {
  it('validates required fields before calling the API', async () => {
    server.use(anonymous());
    let called = false;
    server.use(http.post(`${API}/auth/login`, () => ((called = true), HttpResponse.json({}))));
    renderWithProviders(<LoginPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('rejects a malformed email', async () => {
    server.use(anonymous());
    renderWithProviders(<LoginPage />);
    await userEvent.type(await screen.findByLabelText(/email/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/password/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('signs in, keeps the CSRF token in memory and redirects to a safe ?next', async () => {
    resetNav('/login', 'next=%2Fdoctors%3Fpage%3D2');
    server.use(anonymous(), http.post(`${API}/auth/login`, async ({ request }) => {
      expect(await request.json()).toEqual({ email: 'ada@example.com', password: 'secret-pass' });
      return HttpResponse.json({ success: true, data: adminSession });
    }));
    renderWithProviders(<LoginPage />);
    await userEvent.type(await screen.findByLabelText(/email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/doctors?page=2'));
    expect(getCsrfToken()).toBe(adminSession.csrfToken);
  });

  it('ignores an open-redirect ?next', async () => {
    resetNav('/login', 'next=%2F%2Fevil.com');
    server.use(anonymous(), http.post(`${API}/auth/login`, () => HttpResponse.json({ success: true, data: adminSession })));
    renderWithProviders(<LoginPage />);
    await userEvent.type(await screen.findByLabelText(/email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows one generic message for bad credentials', async () => {
    server.use(anonymous(), http.post(`${API}/auth/login`, () => apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')));
    renderWithProviders(<LoginPage />);
    await userEvent.type(await screen.findByLabelText(/email/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('explains an expired session', async () => {
    resetNav('/login', 'reason=expired');
    server.use(anonymous());
    renderWithProviders(<LoginPage />);
    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
  });

  it('skips the form when already signed in', async () => {
    renderWithProviders(<LoginPage />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/dashboard'));
  });
});
