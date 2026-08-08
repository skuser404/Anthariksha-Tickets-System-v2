import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError, fail } from '../lib/http.js';

export function notFound(_req: Request, res: Response) {
  fail(res, 404, 'Route not found');
}

// The 4-arg signature is what marks this as Express error-handling middleware,
// so `_next` must stay even though it is unused.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return fail(res, 422, 'Validation failed', err.flatten());
  }
  if (err instanceof ApiError) {
    return fail(res, err.status, err.message, err.details);
  }
  console.error('Unhandled error:', err);
  return fail(res, 500, 'Internal server error');
}

/** Wrap async route handlers so thrown errors reach the error handler. */
export const asyncHandler =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
