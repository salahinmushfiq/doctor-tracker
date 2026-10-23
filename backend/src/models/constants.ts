export const ROLES = ['admin', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const GENDERS = ['female', 'male', 'other', 'unspecified'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * Closed list of condition categories (not free text) so analytics group cleanly and the
 * distribution chart is not fragmented by typos. Categories only - no detailed diagnoses are stored.
 */
export const CONDITIONS = [
  'Cardiovascular',
  'Respiratory',
  'Neurological',
  'Endocrine & Metabolic',
  'Gastrointestinal',
  'Musculoskeletal',
  'Oncology',
  'Mental Health',
  'Infectious Disease',
  'Dermatological',
  'Maternal & Child Health',
  'Other',
] as const;
export type Condition = (typeof CONDITIONS)[number];
