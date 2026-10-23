import { z } from 'zod';
import { CONDITIONS, GENDERS } from '@/types/api';
import { phoneSchema } from '../doctors/schemas';

export const patientFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Keep the name under 100 characters'),
  dateOfBirth: z
    .string()
    .min(1, 'Enter the date of birth')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Enter a valid date')
    .refine((v) => v >= '1900-01-01', 'Enter a valid date of birth')
    .refine((v) => Date.parse(`${v}T00:00:00Z`) <= Date.now(), 'Date of birth cannot be in the future'),
  gender: z.enum(GENDERS),
  phone: phoneSchema,
  email: z.union([z.literal(''), z.string().trim().max(254).pipe(z.email('Enter a valid email address'))]),
  condition: z.enum(CONDITIONS, 'Select a condition category'),
  /** '' = unassigned */
  doctorId: z.string(),
});
export type PatientFormValues = z.infer<typeof patientFormSchema>;

/** Form values -> API body (empty e-mail / doctor become null). */
export function toPatientBody(v: PatientFormValues) {
  return { ...v, email: v.email.trim() === '' ? null : v.email.trim(), doctorId: v.doctorId === '' ? null : v.doctorId };
}
