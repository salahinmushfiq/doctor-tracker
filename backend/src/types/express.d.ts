import type { Role } from '../models/constants';

declare global {
  namespace Express {
    interface AuthContext {
      id: string;
      name: string;
      email: string;
      role: Role;
      sid: string;
    }
    interface Request {
      /** Set by requireAuth. */
      auth?: AuthContext;
      /** Zod-parsed request parts (Express 5 makes req.query read-only, so we never reassign it). */
      validated: { query?: unknown; body?: unknown; params?: unknown };
    }
  }
}

export {};
