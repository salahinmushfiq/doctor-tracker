import type { QueryValue } from './api-client';

/** Central query-key factory so invalidation is predictable: invalidate a prefix, get all of its children. */
type Params = Record<string, QueryValue>;

export const qk = {
  auth: ['auth', 'me'] as const,
  doctors: {
    all: ['doctors'] as const,
    list: (p: Params) => ['doctors', 'list', p] as const,
    filters: ['doctors', 'filters'] as const,
    options: ['doctors', 'options'] as const,
    detail: (id: string) => ['doctors', 'detail', id] as const,
    patients: (id: string, p: Params) => ['doctors', 'patients', id, p] as const,
    patientsOf: (id: string) => ['doctors', 'patients', id] as const,
  },
  patients: {
    all: ['patients'] as const,
    list: (p: Params) => ['patients', 'list', p] as const,
    detail: (id: string) => ['patients', 'detail', id] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    overview: (p: Params) => ['dashboard', 'overview', p] as const,
    trends: (p: Params) => ['dashboard', 'trends', p] as const,
    doctorStats: (p: Params) => ['dashboard', 'doctor-statistics', p] as const,
    conditions: (p: Params) => ['dashboard', 'conditions', p] as const,
    recent: ['dashboard', 'recent'] as const,
  },
};
