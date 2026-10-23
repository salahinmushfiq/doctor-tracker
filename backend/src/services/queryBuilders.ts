import { Types } from 'mongoose';
import { buildDateRange, createdAtFilter } from '../utils/dates';
import { searchFilter } from '../utils/search';
import type { DoctorListQuery } from '../validators/doctor';
import type { DoctorPatientsQuery, PatientListQuery } from '../validators/patient';

/**
 * Pure functions that turn already-validated input into Mongo filters.
 * Rules enforced here (and covered by unit tests):
 *  - user input only ever appears as a *value*, never as an operator key,
 *  - ids are converted to ObjectId before use (aggregations do not auto-cast),
 *  - search goes through `searchFilter` (escaped, anchored, bounded).
 */

export type Filter = Record<string, unknown>;

export function buildDoctorFilter(q: Pick<DoctorListQuery, 'search' | 'specialization' | 'hospital' | 'startDate' | 'endDate'>): Filter {
  const filter: Filter = {};
  if (q.specialization) filter.specialization = q.specialization;
  if (q.hospital) filter.hospital = q.hospital;
  Object.assign(filter, createdAtFilter(buildDateRange(q.startDate, q.endDate)));
  const search = searchFilter(q.search);
  if (search) Object.assign(filter, search);
  return filter;
}

export function buildPatientFilter(
  q: Pick<PatientListQuery, 'search' | 'condition' | 'gender' | 'startDate' | 'endDate'> & { doctorId?: string },
): Filter {
  const filter: Filter = {};
  if (q.condition) filter.condition = q.condition;
  if (q.gender) filter.gender = q.gender;
  if (q.doctorId === 'unassigned') filter.doctor = null;
  else if (q.doctorId) filter.doctor = new Types.ObjectId(q.doctorId);
  Object.assign(filter, createdAtFilter(buildDateRange(q.startDate, q.endDate)));
  const search = searchFilter(q.search);
  if (search) Object.assign(filter, search);
  return filter;
}

export function buildDoctorPatientsFilter(doctorId: string, q: DoctorPatientsQuery): Filter {
  return buildPatientFilter({ ...q, doctorId });
}
