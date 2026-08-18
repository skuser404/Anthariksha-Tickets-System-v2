import type { Response } from 'express';

/** Standard API error with an HTTP status. */
export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ ok: true, data });

export const fail = (res: Response, status: number, message: string, details?: unknown) =>
  res.status(status).json({ ok: false, error: { message, details } });

/**
 * Guard a PATCH before it reaches the database.
 *
 * Every partial-update route builds a whitelist patch object, so a body made
 * entirely of unknown fields (a `{"role":"admin"}` privilege-escalation probe,
 * for instance) reduces to `{}`. Postgres then matches no rows and `.single()`
 * fails with "Cannot coerce the result to a single JSON object" — a 500 that
 * leaks driver internals for what is really a bad request.
 */
export function assertHasUpdates(patch: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(patch).length === 0) {
    throw new ApiError(400, `No supported fields to update. Allowed: ${allowed.join(', ')}.`);
  }
}
