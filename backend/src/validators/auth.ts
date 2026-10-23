import { z } from 'zod';
import { emailSchema } from './common';

export const loginBody = z
  .object({
    email: emailSchema,
    // Do not trim or otherwise transform passwords; cap length to bound bcrypt work (bcrypt uses 72 bytes).
    password: z.string().min(1, 'Password is required').max(128),
  })
  .strict();

export type LoginBody = z.infer<typeof loginBody>;
