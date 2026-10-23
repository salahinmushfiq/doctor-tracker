import type { QueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';

/**
 * Doctors, patients and dashboard figures are all derived from the same two collections (patient counts per doctor,
 * unassigned totals, trends...). After ANY write we invalidate all three prefixes; active queries refetch, inactive
 * ones are marked stale. Simple and always consistent - at this scale precision here would only buy bugs.
 */
export function invalidateDomain(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: qk.doctors.all }),
    qc.invalidateQueries({ queryKey: qk.patients.all }),
    qc.invalidateQueries({ queryKey: qk.dashboard.all }),
  ]);
}
