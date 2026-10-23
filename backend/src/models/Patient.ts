import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { CONDITIONS, GENDERS } from './constants';
import { buildSearchTokens, sortKey } from '../utils/search';

/*
 * Relationship model: Patient -> Doctor by reference (`doctor`), NOT an array of patient ids on
 * the doctor. Rationale (details in docs/technical-decisions.md):
 *  - a patient has at most one assigned doctor, so a single ObjectId is the natural "many-to-one";
 *  - reassignment is one atomic single-document write (no two-sided update that can drift);
 *  - the doctor document stays small and bounded however many patients a doctor has;
 *  - "patients of doctor X" is an indexed range scan on { doctor, createdAt }.
 * `doctor: null` means "unassigned" - removing a patient from a doctor never deletes the patient.
 */
const patientSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: GENDERS, required: true, default: 'unspecified' },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: null },
    condition: { type: String, enum: CONDITIONS, required: true },
    doctor: { type: Types.ObjectId, ref: 'Doctor', default: null },
    nameSort: { type: String, select: false },
    searchTokens: { type: [String], select: false },
  },
  { timestamps: true },
);

patientSchema.pre('validate', function () {
  this.nameSort = sortKey(this.fullName ?? '');
  this.searchTokens = buildSearchTokens({
    names: [this.fullName ?? ''],
    texts: [this.condition ?? ''],
    emails: [this.email],
    phones: [this.phone],
  });
});

/*
 * Index rationale:
 *  doctor,createdAt desc    patients of a doctor (detail page), per-doctor counts / "unassigned" ($eq null)
 *  condition,createdAt desc condition filter and the condition-distribution aggregation
 *  createdAt,_id desc       default list order, createdAt range filters, time-series buckets
 *  nameSort,_id             sort by name
 *  searchTokens             anchored-prefix search (multikey)
 */
patientSchema.index({ doctor: 1, createdAt: -1 });
patientSchema.index({ condition: 1, createdAt: -1 });
patientSchema.index({ createdAt: -1, _id: -1 });
patientSchema.index({ nameSort: 1, _id: 1 });
patientSchema.index({ searchTokens: 1 });

export type PatientAttrs = InferSchemaType<typeof patientSchema>;
export type PatientDoc = HydratedDocument<PatientAttrs>;
export const Patient = model('Patient', patientSchema);
