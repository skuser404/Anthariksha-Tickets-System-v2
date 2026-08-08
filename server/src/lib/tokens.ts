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

/**
 * Every token carries an explicit `type`, and each verifier accepts only its own.
 * Without this, tokens signed with the same secret are interchangeable — e.g. the
 * 2FA challenge issued after the password step (but *before* the OTP step) would
 * be accepted as an access token, bypassing two-factor authentication entirely.
 */
type TokenType = 'access' | 'refresh' | '2fa' | 'doc';

function verifyTyped<T>(token: string, secret: string, expected: TokenType): T {
  const payload = jwt.verify(token, secret) as { type?: string };
  if (payload.type !== expected) {
    throw new Error(`Invalid token type (expected "${expected}")`);
  }
  return payload as T;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign({ ...claims, type: 'access' satisfies TokenType }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl as any,
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' satisfies TokenType }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl as any,
  });
}

/** Short-lived token issued after password check, required to complete OTP step. */
export function sign2faChallenge(userId: string): string {
  return jwt.sign({ sub: userId, type: '2fa' satisfies TokenType }, env.jwt.accessSecret, {
    expiresIn: '10m',
  });
}

export function verifyAccess(token: string): AccessClaims {
  return verifyTyped<AccessClaims>(token, env.jwt.accessSecret, 'access');
}

export function verifyRefresh(token: string): { sub: string } {
  return verifyTyped<{ sub: string }>(token, env.jwt.refreshSecret, 'refresh');
}

export function verify2fa(token: string): { sub: string } {
  return verifyTyped<{ sub: string }>(token, env.jwt.accessSecret, '2fa');
}

export interface DocClaims {
  sub: string;   // user granted the view
  doc: string;   // ticket_documents.id
  tkt: string;   // ticket id
}

/**
 * Short-lived, single-document view token.
 *
 * An <iframe>/<img> cannot send an Authorization header, so the preview URL has
 * to carry its credential in the query string — where it lands in browser
 * history, referrer headers and access logs. Scoping this token to one document
 * for five minutes keeps that exposure trivial, instead of leaking a full
 * 15-minute session token that works on every endpoint.
 */
export function signDocToken(claims: DocClaims): string {
  return jwt.sign({ ...claims, type: 'doc' satisfies TokenType }, env.jwt.accessSecret, {
    expiresIn: '5m',
  });
}

export function verifyDocToken(token: string): DocClaims {
  return verifyTyped<DocClaims>(token, env.jwt.accessSecret, 'doc');
}
