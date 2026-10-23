export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'CSRF_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DOCTOR_HAS_PATIENTS'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'DB_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }
  static unauthenticated(message = 'Authentication required') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }
  static sessionExpired() {
    return new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  }
  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(resource = 'Resource') {
    return new AppError(404, 'NOT_FOUND', `${resource} not found`);
  }
  static conflict(message: string, code: ErrorCode = 'CONFLICT', details?: unknown) {
    return new AppError(409, code, message, details);
  }
}
