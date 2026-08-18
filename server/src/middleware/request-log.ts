import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/** Query params that must never reach a log line. */
const REDACT = /^(t|token|code|credential|password|refreshToken|challengeToken)$/i;

function safePath(req: Request): string {
  const [path, query] = req.originalUrl.split('?');
  if (!query) return path;
  const params = new URLSearchParams(query);
  for (const key of [...params.keys()]) {
    if (REDACT.test(key)) params.set(key, '[redacted]');
  }
  const rebuilt = params.toString();
  return rebuilt ? `${path}?${rebuilt}` : path;
}

/**
 * Assigns each request an id and logs one structured line when it completes.
 *
 * The id is echoed in the `x-request-id` response header and included in error
 * responses, so a user can quote it and it can be found in the logs. Only
 * metadata is recorded — never bodies, tokens, passwords or keys.
 */
export function requestLog(req: Request, res: Response, next: NextFunction) {
  req.id = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('x-request-id', req.id);

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const line = {
      t: new Date().toISOString(),
      id: req.id,
      method: req.method,
      path: safePath(req),
      status: res.statusCode,
      ms: Math.round(ms),
      user: req.user?.sub ?? null,
      role: req.user?.role ?? null,
      ip: req.ip ?? null,
    };
    // Successful traffic is noise at this volume; record problems only.
    if (res.statusCode >= 500) console.error('[req]', JSON.stringify(line));
    else if (res.statusCode >= 400) console.warn('[req]', JSON.stringify(line));
  });

  next();
}
