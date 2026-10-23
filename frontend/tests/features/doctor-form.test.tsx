import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DoctorForm } from '@/features/doctors/doctor-form';
import { nav } from '../nav';
import { API, adminSession, apiError, doctor, server } from '../server';
import { renderWithProviders } from '../test-utils';

async function fill(over: Partial<Record<'name' | 'spec' | 'hosp' | 'phone' | 'email', string>> = {}) {
  const v = { name: 'Dr. Amina Rahman', spec: 'Cardiology', hosp: 'Northgate Clinic', phone: '+880 1712 345678', email: 'amina@example.com', ...over };
  await userEvent.type(screen.getByLabelText(/full name/i), v.name);
  await userEvent.type(screen.getByLabelText(/specialization/i), v.spec);
  await userEvent.type(screen.getByLabelText(/hospital/i), v.hosp);
  await userEvent.type(screen.getByLabelText(/phone/i), v.phone);
  await userEvent.type(screen.getByLabelText(/^email/i), v.email);
}

describe('doctor form', () => {
  it('blocks submit and shows field errors when empty', async () => {
    let called = false;
    server.use(http.post(`${API}/doctors`, () => ((called = true), HttpResponse.json({}))));
    renderWithProviders(<DoctorForm />);
    await userEvent.click(screen.getByRole('button', { name: /save|add|create/i }));
    expect(await screen.findByText('Full name must be at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Enter a phone number')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('submits trimmed values with the CSRF header and navigates to the new doctor', async () => {
    
    let csrf: string | null = null;
    let body: unknown;
    server.use(http.post(`${API}/doctors`, async ({ request }) => {
      csrf = request.headers.get('x-csrf-token');
      body = await request.json();
      return HttpResponse.json({ success: true, data: doctor(9, { fullName: 'Dr. Amina Rahman' }) }, { status: 201 });
    }));
    renderWithProviders(<DoctorForm />);
    await fill({ name: '  Dr. Amina Rahman  ' });
    await userEvent.click(screen.getByRole('button', { name: /save|add|create/i }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    expect(csrf).toBe(adminSession.csrfToken);
    expect(body).toMatchObject({ fullName: 'Dr. Amina Rahman', email: 'amina@example.com' });
    expect(String(nav.push.mock.calls[0][0])).toMatch(/^\/doctors\/d9/);
  });

  it('maps a duplicate-email conflict onto the email field', async () => {
    server.use(http.post(`${API}/doctors`, () => apiError(409, 'CONFLICT', 'exists')));
    renderWithProviders(<DoctorForm />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /save|add|create/i }));
    expect(await screen.findByText('A doctor with this email already exists')).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('maps server validation issues onto fields', async () => {
    server.use(http.post(`${API}/doctors`, () => apiError(400, 'VALIDATION_ERROR', 'Validation failed', [{ path: 'body.phone', message: 'Server says bad phone' }])));
    renderWithProviders(<DoctorForm />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /save|add|create/i }));
    expect(await screen.findByText('Server says bad phone')).toBeInTheDocument();
  });

  it('shows a banner for unexpected failures', async () => {
    server.use(http.post(`${API}/doctors`, () => HttpResponse.error()));
    renderWithProviders(<DoctorForm />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: /save|add|create/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
  });
});
