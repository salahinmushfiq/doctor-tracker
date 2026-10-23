import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger, safePath } from '../config/logger';
import { AppError } from '../utils/AppError';
import { formatZodError } from './validate';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${safePath(req.originalUrl)} not found`));
};

const DB_UNAVAILABLE_NAMES = new Set([
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
]);

function isDbUnavailable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (DB_UNAVAILABLE_NAMES.has(err.name)) return true;
  // bufferCommands=false -> operations before connect throw a plain MongooseError.
  return err.name === 'MongooseError' && /buffering|not connected|connection/i.test(err.message);
}

/**
 * Single place where every error becomes an HTTP response:
 *   { success: false, error: { code, message, details? } }
 * Unknown errors are logged (without request bodies / query strings) and returned as a generic 500;
 * stack traces are never sent to clients.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return;

  let status = 500;
  let code: AppError['code'] = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side. Please try again.';
  let details: unknown;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = formatZodError(err);
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = `Invalid value for ${err.path}`;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
    status = 409;
    code = 'CONFLICT';
    const field = Object.keys(err.keyPattern ?? {})[0];
    message = field === 'email' ? 'A record with this email already exists' : 'A duplicate record already exists';
  } else if (isDbUnavailable(err)) {
    status = 503;
    code = 'DB_UNAVAILABLE';
    message = 'The service is temporarily unavailable. Please try again shortly.';
  } else if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request body is not valid JSON';
  }

  if (status >= 500) {
    logger.error(
      { err: { name: (err as Error)?.name, message: (err as Error)?.message, stack: env.isProd ? undefined : (err as Error)?.stack }, method: req.method, path: safePath(req.originalUrl), status },
      'request failed',
    );
  }

  res.status(status).json({ success: false, error: { code, message, ...(details === undefined ? {} : { details }) } });
};
