import type { Types } from 'mongoose';
import { Doctor } from '../models/Doctor';
import { Patient } from '../models/Patient';
import { AppError } from '../utils/AppError';
import { buildPagination, buildSort, skipFor } from '../utils/pagination';
import { toDoctorDTO, type DoctorDTO, type PatientDTO } from '../utils/serialize';
import type { DoctorBody, DoctorListQuery } from '../validators/doctor';
import { DOCTOR_SORT_MAP } from '../validators/doctor';
import type { DoctorPatientsQuery } from '../validators/patient';
import { patientCountsFor, queryPatients, type PagedResult } from './patient.service';
import { buildDoctorFilter, buildDoctorPatientsFilter } from './queryBuilders';

export async function listDoctors(q: DoctorListQuery): Promise<PagedResult<DoctorDTO>> {
  const filter = buildDoctorFilter(q);
  const sort = buildSort(q.sortBy, q.sortOrder, DOCTOR_SORT_MAP);
  const [rows, total] = await Promise.all([
    Doctor.find(filter).select('-__v').sort(sort).skip(skipFor(q.page, q.limit)).limit(q.limit).lean(),
    Doctor.countDocuments(filter),
  ]);
  const counts = await patientCountsFor(rows.map((r) => r._id as Types.ObjectId));
  return {
    data: rows.map((r) => toDoctorDTO(r, counts.get(String(r._id)) ?? 0)),
    pagination: buildPagination(q.page, q.limit, total),
  };
}

export async function getDoctor(id: string): Promise<DoctorDTO> {
  const row = await Doctor.findById(id).select('-__v').lean();
  if (!row) throw AppError.notFound('Doctor');
  const patientCount = await Patient.countDocuments({ doctor: row._id });
  return toDoctorDTO(row, patientCount);
}

export async function createDoctor(body: DoctorBody): Promise<DoctorDTO> {
  const doc = await Doctor.create(body);
  return getDoctor(String(doc._id));
}

export async function updateDoctor(id: string, body: Partial<DoctorBody>): Promise<DoctorDTO> {
  const doc = await Doctor.findById(id);
  if (!doc) throw AppError.notFound('Doctor');
  doc.set(body);
  await doc.save(); // save() -> pre-validate hook refreshes derived search fields; unique index guards e-mail
  return getDoctor(id);
}

export async function listDoctorPatients(doctorId: string, q: DoctorPatientsQuery): Promise<PagedResult<PatientDTO>> {
  const exists = await Doctor.exists({ _id: doctorId });
  if (!exists) throw AppError.notFound('Doctor');
  return queryPatients(buildDoctorPatientsFilter(doctorId, q), q);
}

/**
 * Deletion policy (documented in docs/architecture.md):
 *  - default: refuse with 409 DOCTOR_HAS_PATIENTS while patients are assigned (never orphan silently);
 *  - `?patients=unassign`: first set `doctor: null` on those patients, then delete the doctor.
 *    Patients are NEVER deleted by this operation. The two writes are ordered so a failure in
 *    between leaves a consistent state (patients unassigned, doctor still present).
 */
export async function deleteDoctor(id: string, mode?: 'unassign'): Promise<{ unassigned: number }> {
  const doctor = await Doctor.findById(id).select('_id').lean();
  if (!doctor) throw AppError.notFound('Doctor');

  const patientCount = await Patient.countDocuments({ doctor: doctor._id });
  let unassigned = 0;
  if (patientCount > 0) {
    if (mode !== 'unassign') {
      throw AppError.conflict(
        `This doctor has ${patientCount} assigned patient${patientCount === 1 ? '' : 's'}. Reassign them first, or confirm that they should become unassigned.`,
        'DOCTOR_HAS_PATIENTS',
        { patientCount },
      );
    }
    const res = await Patient.updateMany({ doctor: doctor._id }, { $set: { doctor: null } });
    unassigned = res.modifiedCount;
  }
  await Doctor.deleteOne({ _id: doctor._id });
  return { unassigned };
}

/** Distinct values for the filter dropdowns (served by the { specialization } / { hospital } indexes). */
export async function doctorFilterOptions() {
  const [specializations, hospitals] = await Promise.all([
    Doctor.distinct('specialization') as Promise<string[]>,
    Doctor.distinct('hospital') as Promise<string[]>,
  ]);
  const collator = new Intl.Collator('en', { sensitivity: 'base' });
  return { specializations: specializations.sort(collator.compare), hospitals: hospitals.sort(collator.compare) };
}
