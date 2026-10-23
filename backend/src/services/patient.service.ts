import { Types } from 'mongoose';
import { CONDITIONS, GENDERS } from '../models/constants';
import { Doctor } from '../models/Doctor';
import { Patient } from '../models/Patient';
import { AppError } from '../utils/AppError';
import { buildPagination, buildSort, skipFor } from '../utils/pagination';
import { toPatientDTO, type DoctorRefDTO, type PatientDTO } from '../utils/serialize';
import type { PatientBody, PatientListQuery, PatientPatchBody } from '../validators/patient';
import { PATIENT_SORT_MAP } from '../validators/patient';
import { buildPatientFilter, type Filter } from './queryBuilders';

export interface PagedResult<T> {
  data: T[];
  pagination: ReturnType<typeof buildPagination>;
}

type LeanPatient = Parameters<typeof toPatientDTO>[0];

/**
 * Resolve the assigned doctors for a whole page with ONE query (`$in`) instead of one per row
 * (avoids the N+1 pattern). Dangling references (doctor deleted concurrently) resolve to null.
 */
export async function attachDoctors(patients: LeanPatient[]): Promise<PatientDTO[]> {
  const ids = [...new Set(patients.flatMap((p) => (p.doctor ? [String(p.doctor)] : [])))].map((id) => new Types.ObjectId(id));
  const map = new Map<string, DoctorRefDTO>();
  if (ids.length > 0) {
    const doctors = await Doctor.find({ _id: { $in: ids } }).select('fullName specialization').lean();
    for (const d of doctors) map.set(String(d._id), { id: String(d._id), fullName: d.fullName, specialization: d.specialization });
  }
  return patients.map((p) => toPatientDTO(p, map));
}

/** Patient counts for a set of doctors in one grouped query (index: { doctor, createdAt }). */
export async function patientCountsFor(doctorIds: Types.ObjectId[]): Promise<Map<string, number>> {
  if (doctorIds.length === 0) return new Map();
  const rows = await Patient.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { doctor: { $in: doctorIds } } },
    { $group: { _id: '$doctor', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function queryPatients(
  filter: Filter,
  q: { page: number; limit: number; sortBy: PatientListQuery['sortBy']; sortOrder: 'asc' | 'desc' },
): Promise<PagedResult<PatientDTO>> {
  const sort = buildSort(q.sortBy, q.sortOrder, PATIENT_SORT_MAP);
  const [rows, total] = await Promise.all([
    Patient.find(filter).select('-__v').sort(sort).skip(skipFor(q.page, q.limit)).limit(q.limit).lean(),
    Patient.countDocuments(filter),
  ]);
  return { data: await attachDoctors(rows as unknown as LeanPatient[]), pagination: buildPagination(q.page, q.limit, total) };
}

export function listPatients(q: PatientListQuery) {
  return queryPatients(buildPatientFilter(q), q);
}

export async function getPatient(id: string): Promise<PatientDTO> {
  const row = await Patient.findById(id).select('-__v').lean();
  if (!row) throw AppError.notFound('Patient');
  const [dto] = await attachDoctors([row as unknown as LeanPatient]);
  return dto as PatientDTO;
}

async function assertDoctorExists(doctorId: string | null | undefined) {
  if (!doctorId) return;
  const exists = await Doctor.exists({ _id: doctorId });
  if (!exists) throw AppError.badRequest('Validation failed', [{ path: 'body.doctorId', message: 'Selected doctor does not exist' }]);
}

export async function createPatient(body: PatientBody): Promise<PatientDTO> {
  await assertDoctorExists(body.doctorId);
  const doc = await Patient.create({
    fullName: body.fullName,
    dateOfBirth: body.dateOfBirth,
    gender: body.gender,
    phone: body.phone,
    email: body.email,
    condition: body.condition,
    doctor: body.doctorId,
  });
  return getPatient(String(doc._id));
}

export async function updatePatient(id: string, body: PatientPatchBody): Promise<PatientDTO> {
  const doc = await Patient.findById(id);
  if (!doc) throw AppError.notFound('Patient');
  if (body.doctorId !== undefined) await assertDoctorExists(body.doctorId);

  const { doctorId, ...rest } = body;
  doc.set(rest);
  if (doctorId !== undefined) doc.set('doctor', doctorId);
  // load-modify-save (not findOneAndUpdate) so the pre-validate hook refreshes the derived search fields.
  await doc.save();
  return getPatient(id);
}

/** Permanent removal of the patient record. (Removing only the assignment is `unassignPatient`.) */
export async function deletePatient(id: string): Promise<void> {
  const res = await Patient.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw AppError.notFound('Patient');
}

/** Detach a patient from a doctor without deleting the patient. */
export async function unassignPatient(doctorId: string, patientId: string): Promise<PatientDTO> {
  const res = await Patient.updateOne({ _id: patientId, doctor: doctorId }, { $set: { doctor: null } });
  if (res.matchedCount === 0) throw AppError.notFound('Patient assigned to this doctor');
  return getPatient(patientId);
}

export function patientFilterOptions() {
  return { conditions: [...CONDITIONS], genders: [...GENDERS] };
}
