/** DTOs mirroring the backend contract (backend/src/utils/serialize.ts, docs/openapi.ts). Dates are ISO strings. */

export type Role = 'admin' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Session {
  user: User;
  csrfToken: string;
}

export const GENDERS = ['female', 'male', 'other', 'unspecified'] as const;
export type Gender = (typeof GENDERS)[number];

/** Keep in sync with backend/src/models/constants.ts (closed list => clean analytics). */
export const CONDITIONS = [
  'Cardiovascular',
  'Respiratory',
  'Neurological',
  'Endocrine & Metabolic',
  'Gastrointestinal',
  'Musculoskeletal',
  'Oncology',
  'Mental Health',
  'Infectious Disease',
  'Dermatological',
  'Maternal & Child Health',
  'Other',
] as const;
export type Condition = (typeof CONDITIONS)[number];

export interface Doctor {
  id: string;
  fullName: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  patientCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorRef {
  id: string;
  fullName: string;
  specialization: string;
}

export interface Patient {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email: string | null;
  condition: Condition;
  doctor: DoctorRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  pagination: Pagination;
}

export type SortOrder = 'asc' | 'desc';

/* ── Dashboard ──────────────────────────────────────────────────────────── */
export interface DateWindow {
  from: string | null;
  to: string | null;
}
export interface Overview {
  range: DateWindow;
  totals: { doctors: number; patients: number; unassignedPatients: number };
  inRange: { doctors: number; patients: number };
  averagePatientsPerDoctor: number;
}
export interface TrendPoint {
  bucket: string;
  doctors: number;
  patients: number;
}
export interface Trends {
  range: DateWindow;
  interval: 'day' | 'week' | 'month';
  series: TrendPoint[];
  hasData: boolean;
}
export interface DoctorStatistics {
  range: DateWindow;
  topDoctors: Array<{ doctorId: string; fullName: string; specialization: string; hospital: string; patients: number }>;
  specializations: Array<{ specialization: string; doctors: number; patients: number }>;
}
export interface ConditionDistribution {
  range: DateWindow;
  total: number;
  items: Array<{ condition: string; count: number; percentage: number }>;
}
export interface RecentActivity {
  doctors: Doctor[];
  patients: Patient[];
}
