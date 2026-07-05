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
