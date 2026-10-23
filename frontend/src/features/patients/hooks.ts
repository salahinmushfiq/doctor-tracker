'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiData, type QueryValue } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { Paged, Patient } from '@/types/api';
import { invalidateDomain } from '../common/invalidate';
import { toPatientBody, type PatientFormValues } from './schemas';

type Params = Record<string, QueryValue>;

export function usePatients(query: Params, enabled = true) {
  return useQuery({
    queryKey: qk.patients.list(query),
    queryFn: ({ signal }) => api<Paged<Patient>>('/patients', { query, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePatient(id: string) {
  return useQuery({ queryKey: qk.patients.detail(id), queryFn: ({ signal }) => apiData<Patient>(`/patients/${id}`, { signal }) });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PatientFormValues) => apiData<Patient>('/patients', { method: 'POST', body: toPatientBody(values) }),
    onSuccess: () => invalidateDomain(qc),
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PatientFormValues) => apiData<Patient>(`/patients/${id}`, { method: 'PATCH', body: toPatientBody(values) }),
    onSuccess: () => invalidateDomain(qc),
  });
}

/** Permanent removal of the patient record. */
export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiData<{ deleted: true }>(`/patients/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateDomain(qc),
  });
}
