import { z } from 'zod';
import {
  dateRangeQuery,
  emailSchema,
  paginationQuery,
  phoneSchema,
  refineDateRange,
  searchParam,
  sortOrderParam,
} from './common';

export const DOCTOR_SORT_FIELDS = ['createdAt', 'updatedAt', 'fullName', 'specialization', 'hospital'] as const;
/** Allow-list: API field -> indexed Mongo field. */
export const DOCTOR_SORT_MAP: Record<(typeof DOCTOR_SORT_FIELDS)[number], string> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  fullName: 'nameSort',
  specialization: 'specialization',
  hospital: 'hospital',
};

export const doctorListQuery = refineDateRange(
  z.object({
    ...paginationQuery,
    ...dateRangeQuery,
    search: searchParam.optional(),
    specialization: z.string().trim().min(1).max(80).optional(),
    hospital: z.string().trim().min(1).max(120).optional(),
    sortBy: z.enum(DOCTOR_SORT_FIELDS).default('createdAt'),
    sortOrder: sortOrderParam,
  }),
);
export type DoctorListQuery = z.infer<typeof doctorListQuery>;

export const doctorBody = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
    specialization: z.string().trim().min(2, 'Specialization is required').max(80),
    hospital: z.string().trim().min(2, 'Hospital or workplace is required').max(120),
    phone: phoneSchema,
    email: emailSchema,
  })
  .strict();
export type DoctorBody = z.infer<typeof doctorBody>;

export const doctorPatchBody = doctorBody
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Provide at least one field to update');

/** DELETE /doctors/:id?patients=unassign  (default: refuse when patients are assigned) */
export const doctorDeleteQuery = z.object({
  patients: z.enum(['unassign']).optional(),
});
