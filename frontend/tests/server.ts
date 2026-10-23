import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { Doctor, Patient } from '@/types/api';

export const API = 'http://localhost:4000/api/v1';

export const adminSession = { user: { id: 'u1', name: 'Ada Admin', email: 'ada@example.com', role: 'admin' }, csrfToken: 'csrf-token-1' };
export const viewerSession = { user: { id: 'u2', name: 'Vic Viewer', email: 'vic@example.com', role: 'viewer' }, csrfToken: 'csrf-token-2' };

export const doctor = (i: number, over: Partial<Doctor> = {}): Doctor => ({
  id: `d${i}`.padEnd(24, '0'),
  fullName: `Dr. Test ${i}`,
  specialization: i % 2 ? 'Cardiology' : 'Neurology',
  hospital: 'Northgate Clinic',
  phone: '+1-555-0100',
  email: `doctor${i}@example.com`,
  patientCount: i,
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
  ...over,
});

export const patient = (i: number, over: Partial<Patient> = {}): Patient => ({
  id: `p${i}`.padEnd(24, '0'),
  fullName: `Pat Ient ${i}`,
  dateOfBirth: '1990-04-21T00:00:00.000Z',
  gender: 'female',
  phone: '+1-555-0101',
  email: null,
  condition: 'Cardiovascular',
  doctor: { id: 'd1'.padEnd(24, '0'), fullName: 'Dr. Test 1', specialization: 'Cardiology' },
  createdAt: '2026-03-02T10:00:00.000Z',
  updatedAt: '2026-03-02T10:00:00.000Z',
  ...over,
});

export const paged = <T,>(data: T[], over: Partial<{ page: number; limit: number; total: number; totalPages: number }> = {}) => ({
  success: true,
  data,
  pagination: { page: 1, limit: 10, total: data.length, totalPages: data.length ? 1 : 0, ...over },
});

export const apiError = (status: number, code: string, message: string, details?: unknown) =>
  HttpResponse.json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, { status });

/** Defaults: signed-in admin, empty directories. Tests override with server.use(...). */
export const server = setupServer(
  http.get(`${API}/auth/me`, () => HttpResponse.json({ success: true, data: adminSession })),
  http.get(`${API}/doctors`, () => HttpResponse.json(paged([]))),
  http.get(`${API}/doctors/filters`, () => HttpResponse.json({ success: true, data: { specializations: ['Cardiology', 'Neurology'], hospitals: ['Northgate Clinic'] } })),
  http.get(`${API}/patients`, () => HttpResponse.json(paged([]))),
);
