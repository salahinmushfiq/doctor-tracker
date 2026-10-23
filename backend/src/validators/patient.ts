import { z } from 'zod';
import { CONDITIONS, GENDERS } from '../models/constants';
import {
  dateRangeQuery,
  emailSchema,
  objectIdSchema,
  paginationQuery,
  phoneSchema,
  refineDateRange,
  searchParam,
  sortOrderParam,
} from './common';

export const PATIENT_SORT_FIELDS = ['createdAt', 'updatedAt', 'fullName', 'condition', 'dateOfBirth'] as const;
export const PATIENT_SORT_MAP: Record<(typeof PATIENT_SORT_FIELDS)[number], string> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  fullName: 'nameSort',
  condition: 'condition',
  dateOfBirth: 'dateOfBirth',
};

const baseListShape = {
  ...paginationQuery,
  ...dateRangeQuery,
  search: searchParam.optional(),
  sortBy: z.enum(PATIENT_SORT_FIELDS).default('createdAt'),
  sortOrder: sortOrderParam,
};

export const patientListQuery = refineDateRange(
  z.object({
    ...baseListShape,
    condition: z.enum(CONDITIONS).optional(),
    gender: z.enum(GENDERS).optional(),
    /** an ObjectId, or the literal "unassigned" */
    doctorId: z.union([objectIdSchema, z.literal('unassigned')]).optional(),
  }),
);
export type PatientListQuery = z.infer<typeof patientListQuery>;

/** Patients of one doctor: the doctor comes from the route, so no doctor filter. */
export const doctorPatientsQuery = refineDateRange(
  z.object({ ...baseListShape, condition: z.enum(CONDITIONS).optional() }),
);
export type DoctorPatientsQuery = z.infer<typeof doctorPatientsQuery>;

const dateOfBirth = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00.000Z`).getTime()), 'Enter a valid date')
  .refine((v) => new Date(`${v}T00:00:00.000Z`).getTime() <= Date.now(), 'Date of birth cannot be in the future')
  .refine((v) => v >= '1900-01-01', 'Enter a valid date of birth')
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

const optionalEmail = z
  .union([z.literal(''), emailSchema])
  .nullish()
  .transform((v) => (v ? v : null));

export const patientBody = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
    dateOfBirth,
    gender: z.enum(GENDERS).default('unspecified'),
    phone: phoneSchema,
    email: optionalEmail,
    condition: z.enum(CONDITIONS, 'Select a condition category'),
    doctorId: objectIdSchema.nullish().transform((v) => v ?? null),
  })
  .strict();
export type PatientBody = z.infer<typeof patientBody>;

/** PATCH: every field optional but at least one present. Defaults must NOT be applied here. */
export const patientPatchBody = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    dateOfBirth,
    gender: z.enum(GENDERS),
    phone: phoneSchema,
    email: optionalEmail,
    condition: z.enum(CONDITIONS),
    doctorId: objectIdSchema.nullable(),
  })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');
export type PatientPatchBody = z.infer<typeof patientPatchBody>;

export const doctorPatientParams = z.object({ id: objectIdSchema, patientId: objectIdSchema });
