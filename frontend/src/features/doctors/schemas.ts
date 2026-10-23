import { z } from 'zod';

// Same rules as backend/src/validators (kept in sync by hand; the server remains the authority).
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Enter a phone number')
  .regex(/^[+()\d][\d\s().-]{5,23}$/, 'Enter a valid phone number')
  .refine((v) => {
    const digits = v.replace(/\D/g, '').length;
    return digits >= 7 && digits <= 15;
  }, 'Enter a valid phone number');

export const doctorFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Keep the name under 100 characters'),
  specialization: z.string().trim().min(2, 'Enter a specialization').max(80, 'Keep it under 80 characters'),
  hospital: z.string().trim().min(2, 'Enter a hospital or workplace').max(120, 'Keep it under 120 characters'),
  phone: phoneSchema,
  email: z.string().trim().min(1, 'Enter an email address').max(254).pipe(z.email('Enter a valid email address')),
});
export type DoctorFormValues = z.infer<typeof doctorFormSchema>;
