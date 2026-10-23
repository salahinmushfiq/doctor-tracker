'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiData, type QueryValue } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { Doctor, Paged, Patient } from '@/types/api';
import { invalidateDomain } from '../common/invalidate';
import type { DoctorFormValues } from './schemas';

type Params = Record<string, QueryValue>;

export function useDoctors(query: Params, enabled = true) {
  return useQuery({
    queryKey: qk.doctors.list(query),
    queryFn: ({ signal }) => api<Paged<Doctor>>('/doctors', { query, signal }),
    placeholderData: keepPreviousData, // keep showing the previous page (dimmed) while the next one loads: no flicker, no layout jump
    enabled,
  });
}

export function useDoctorFilterOptions() {
  return useQuery({
    queryKey: qk.doctors.filters,
    queryFn: ({ signal }) => apiData<{ specializations: string[]; hospitals: string[] }>('/doctors/filters', { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useDoctor(id: string, enabled = true) {
  return useQuery({ queryKey: qk.doctors.detail(id), queryFn: ({ signal }) => apiData<Doctor>(`/doctors/${id}`, { signal }), enabled });
}

export function useDoctorPatients(id: string, query: Params) {
  return useQuery({
    queryKey: qk.doctors.patients(id, query),
    queryFn: ({ signal }) => api<Paged<Patient>>(`/doctors/${id}/patients`, { query, signal }),
    placeholderData: keepPreviousData,
  });
}

/** Doctor choices for pickers: server-side search, small page, always the first 25 matches. */
export function useDoctorOptions(search: string) {
  const query = { limit: 25, sortBy: 'fullName', sortOrder: 'asc', search: search || undefined } as const;
  return useQuery({
    queryKey: [...qk.doctors.options, query] as const,
    queryFn: ({ signal }) => api<Paged<Doctor>>('/doctors', { query, signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useCreateDoctor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: DoctorFormValues) => apiData<Doctor>('/doctors', { method: 'POST', body: values }),
    onSuccess: () => invalidateDomain(qc),
  });
}

/** mode 'unassign' = detach patients first, then delete the doctor. Patients are never deleted. */
export function useDeleteDoctor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, unassignPatients }: { id: string; unassignPatients?: boolean }) =>
      apiData<{ unassigned: number }>(`/doctors/${id}`, { method: 'DELETE', query: unassignPatients ? { patients: 'unassign' } : undefined }),
    onSuccess: () => invalidateDomain(qc),
  });
}

/** Remove a patient from this doctor's list (UNASSIGN only; the patient record is kept). */
export function useUnassignPatient(doctorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) => apiData<Patient>(`/doctors/${doctorId}/patients/${patientId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateDomain(qc),
  });
}
