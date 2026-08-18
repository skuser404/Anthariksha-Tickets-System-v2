import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError, fail } from '../lib/http.js';

export function notFound(_req: Request, res: Response) {
  fail(res, 404, 'Route not found');
}

// The 4-arg signature is what marks this as Express error-handling middleware,
// so `_next` must stay even though it is unused.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.id;
  if (err instanceof ZodError) {
    return fail(res, 422, 'Validation failed', { ...err.flatten(), requestId });
  }
  if (err instanceof ApiError) {
    return fail(res, err.status, err.message, err.details ?? { requestId });
  }
  // Correlates with the [req] line carrying the same id.
  console.error(`Unhandled error [${requestId}]:`, err);
  return fail(res, 500, 'Internal server error', { requestId });
}

/** Wrap async route handlers so thrown errors reach the error handler. */
export const asyncHandler =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
