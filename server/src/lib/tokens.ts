import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type Role = 'admin' | 'member';

export interface AccessClaims {
  sub: string;        // user id
  role: Role;
  email: string;
  name: string;
  isSuper: boolean;   // super-admin (an admin with elevated privileges)
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl as any });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl as any,
  });
}

/** Short-lived token issued after password check, required to complete OTP step. */
export function sign2faChallenge(userId: string): string {
  return jwt.sign({ sub: userId, type: '2fa' }, env.jwt.accessSecret, { expiresIn: '10m' });
}

export function verifyAccess(token: string): AccessClaims {
  return jwt.verify(token, env.jwt.accessSecret) as AccessClaims;
}

export function verifyRefresh(token: string): { sub: string } {
  return jwt.verify(token, env.jwt.refreshSecret) as { sub: string; type: string };
}

export function verify2fa(token: string): { sub: string } {
  const payload = jwt.verify(token, env.jwt.accessSecret) as { sub: string; type: string };
  if (payload.type !== '2fa') throw new Error('Invalid 2FA challenge token');
  return payload;
}
