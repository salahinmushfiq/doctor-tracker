import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { buildSearchTokens, sortKey } from '../utils/search';

const doctorSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    specialization: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    hospital: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    // Derived fields (maintained by the pre-validate hook; never accepted from clients).
    nameSort: { type: String, select: false },
    searchTokens: { type: [String], select: false },
  },
  { timestamps: true },
);

doctorSchema.pre('validate', function () {
  this.nameSort = sortKey(this.fullName ?? '');
  this.searchTokens = buildSearchTokens({
    names: [this.fullName ?? ''],
    texts: [this.specialization ?? '', this.hospital ?? ''],
    emails: [this.email],
    phones: [this.phone],
  });
});

/*
 * Index rationale (each maps to a concrete query in doctor.service / dashboard):
 *  email (unique)                 business rule + duplicate detection
 *  searchTokens                   anchored-prefix search (multikey)
 *  createdAt,_id desc             default list order and createdAt range filters
 *  nameSort,_id                   sort by name (case/accent-insensitive via derived key)
 *  specialization,createdAt desc  specialization filter (+ sorted by recency); also serves distinct()
 *  hospital,createdAt desc        hospital filter (+ sorted by recency); also serves distinct()
 */
doctorSchema.index({ email: 1 }, { unique: true });
doctorSchema.index({ searchTokens: 1 });
doctorSchema.index({ createdAt: -1, _id: -1 });
doctorSchema.index({ nameSort: 1, _id: 1 });
doctorSchema.index({ specialization: 1, createdAt: -1 });
doctorSchema.index({ hospital: 1, createdAt: -1 });

export type DoctorAttrs = InferSchemaType<typeof doctorSchema>;
export type DoctorDoc = HydratedDocument<DoctorAttrs>;
export const Doctor = model('Doctor', doctorSchema);
