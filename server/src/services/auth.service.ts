import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { env } from '../config/env.js';
import { ApiError } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { sendMail } from '../lib/mailer.js';
import {
  sign2faChallenge,
  signAccessToken,
  signRefreshToken,
  verify2fa,
} from '../lib/tokens.js';

export interface DbUser {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'member';
  is_active: boolean;
  totp_secret: string | null;
  totp_enabled: boolean;
  failed_otp_count: number;
  locked_until: string | null;
  email_2fa?: boolean;
  login_alerts?: boolean;
  is_super?: boolean;
}

/** Email a "new login" alert (best-effort; never blocks login). */
async function sendLoginAlert(user: DbUser, meta: ReqMeta) {
  if (user.login_alerts === false) return;
  try {
    await sendMail(
      user.email,
      'New sign-in to your Antariksha account',
      `<p>Hello ${user.full_name},</p>
       <p>Your account was just signed in.</p>
       <ul>
         <li>Time: ${new Date().toLocaleString('en-IN')}</li>
         <li>IP: ${meta.ip ?? 'unknown'}</li>
         <li>Device: ${meta.userAgent ?? 'unknown'}</li>
       </ul>
       <p>If this wasn't you, change your password and contact an administrator.</p>`,
    );
  } catch {
    /* alerts are non-critical */
  }
}

interface ReqMeta {
  ip?: string | null;
  userAgent?: string | null;
}

async function logAttempt(p: {
  userId?: string | null;
  email: string;
  success: boolean;
  stage: 'password' | 'otp';
  reason?: string;
  meta: ReqMeta;
}) {
  await supabase.from('login_attempts').insert({
    user_id: p.userId ?? null,
    email: p.email,
    success: p.success,
    stage: p.stage,
    reason: p.reason ?? null,
    ip_address: p.meta.ip ?? null,
    user_agent: p.meta.userAgent ?? null,
  });
}

async function getUserByEmail(email: string): Promise<DbUser | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  return (data as DbUser) ?? null;
}

function isLocked(user: DbUser): boolean {
  return !!user.locked_until && new Date(user.locked_until) > new Date();
}

function issueSession(user: DbUser) {
  return {
    accessToken: signAccessToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.full_name,
      isSuper: user.is_super === true,
    }),
    refreshToken: signRefreshToken(user.id),
    user: {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      isSuper: user.is_super === true,
    },
  };
}

/**
 * Step 1 — verify email + password.
 * - Members log in directly (returns a full session).
 * - Admins receive a 2FA challenge: an email OTP is sent and a short-lived
 *   challenge token is returned; the session is only issued after step 2.
 */
export async function loginWithPassword(
  email: string,
  password: string,
  meta: ReqMeta,
) {
  const user = await getUserByEmail(email);
  if (!user || !user.is_active) {
    await logAttempt({ email, success: false, stage: 'password', reason: 'no_user', meta });
    throw new ApiError(401, 'Invalid email or password');
  }
  if (isLocked(user)) {
    await logAttempt({ userId: user.id, email, success: false, stage: 'password', reason: 'locked', meta });
    throw new ApiError(423, 'Account temporarily locked. Try again later.');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await logAttempt({ userId: user.id, email, success: false, stage: 'password', reason: 'bad_password', meta });
    throw new ApiError(401, 'Invalid email or password');
  }

  await logAttempt({ userId: user.id, email, success: true, stage: 'password', meta });

  // 2FA is mandatory for admins and opt-in for members.
  const needs2fa = user.role === 'admin' || user.email_2fa === true;
  if (!needs2fa) {
    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    await sendLoginAlert(user, meta);
    return { twoFactorRequired: false as const, ...issueSession(user) };
  }

  // Send email OTP, return challenge token.
  await issueEmailOtp(user);
  return {
    twoFactorRequired: true as const,
    method: user.totp_enabled ? ('totp' as const) : ('email' as const),
    challengeToken: sign2faChallenge(user.id),
  };
}

/** Generate a 6-digit OTP, store its hash, email it (respecting resend cooldown). */
export async function issueEmailOtp(user: DbUser) {
  // Resend cooldown: reject if a code was created within the cooldown window.
  const { data: recent } = await supabase
    .from('otp_codes')
    .select('created_at')
    .eq('user_id', user.id)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const ageMs = Date.now() - new Date(recent.created_at).getTime();
    if (ageMs < env.security.otpResendSeconds * 1000) {
      const wait = Math.ceil((env.security.otpResendSeconds * 1000 - ageMs) / 1000);
      throw new ApiError(429, `Please wait ${wait}s before requesting another code.`);
    }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + env.security.otpTtlSeconds * 1000).toISOString();

  await supabase.from('otp_codes').insert({
    user_id: user.id,
    code_hash: codeHash,
    purpose: 'login',
    expires_at: expiresAt,
  });

  await sendMail(
    user.email,
    'Your Antariksha admin login code',
    `<p>Hello ${user.full_name},</p>
     <p>Your one-time login code is:</p>
     <h2 style="letter-spacing:4px">${code}</h2>
     <p>This code expires in ${Math.round(env.security.otpTtlSeconds / 60)} minutes.
     If you didn't request it, ignore this email.</p>`,
  );
}

/** Resend OTP using a valid challenge token. */
export async function resendOtp(challengeToken: string) {
  const { sub } = verify2fa(challengeToken);
  const { data } = await supabase.from('users').select('*').eq('id', sub).single();
  const user = data as DbUser;
  if (!user) throw new ApiError(401, 'Invalid challenge');
  if (isLocked(user)) throw new ApiError(423, 'Account temporarily locked. Try again later.');
  await issueEmailOtp(user);
  return { ok: true };
}

/**
 * Step 2 — verify the OTP (email code or TOTP from an authenticator app).
 * Enforces max-attempt lockout.
 */
export async function verifyOtp(challengeToken: string, code: string, meta: ReqMeta) {
  const { sub } = verify2fa(challengeToken);
  const { data } = await supabase.from('users').select('*').eq('id', sub).single();
  const user = data as DbUser;
  if (!user) throw new ApiError(401, 'Invalid challenge');
  if (isLocked(user)) throw new ApiError(423, 'Account temporarily locked. Try again later.');

  let valid = false;

  // Path A: authenticator app (TOTP)
  if (user.totp_enabled && user.totp_secret) {
    valid = authenticator.check(code, user.totp_secret);
  }

  // Path B: email OTP
  if (!valid) {
    const { data: codes } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', user.id)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(3);

    for (const row of codes ?? []) {
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(code, row.code_hash)) {
        valid = true;
        // eslint-disable-next-line no-await-in-loop
        await supabase.from('otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
        break;
      }
    }
  }

  if (!valid) {
    const failed = user.failed_otp_count + 1;
    const update: Record<string, unknown> = { failed_otp_count: failed };
    if (failed >= env.security.otpMaxAttempts) {
      update.failed_otp_count = 0;
      update.locked_until = new Date(
        Date.now() + env.security.accountLockMinutes * 60 * 1000,
      ).toISOString();
    }
    await supabase.from('users').update(update).eq('id', user.id);
    await logAttempt({ userId: user.id, email: user.email, success: false, stage: 'otp', reason: 'bad_otp', meta });
    if (update.locked_until) {
      throw new ApiError(423, `Too many attempts. Account locked for ${env.security.accountLockMinutes} minutes.`);
    }
    throw new ApiError(401, 'Incorrect or expired code');
  }

  await supabase
    .from('users')
    .update({ failed_otp_count: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq('id', user.id);
  await logAttempt({ userId: user.id, email: user.email, success: true, stage: 'otp', meta });
  await sendLoginAlert(user, meta);

  return { twoFactorRequired: false as const, ...issueSession(user) };
}

export async function rotateAccess(userId: string) {
  const { data } = await supabase.from('users').select('*').eq('id', userId).single();
  const user = data as DbUser;
  if (!user || !user.is_active) throw new ApiError(401, 'Session no longer valid');
  return issueSession(user);
}

/** Enroll an authenticator app: returns the otpauth URI to render as a QR. */
export async function setupTotp(userId: string, email: string) {
  const secret = authenticator.generateSecret();
  await supabase.from('users').update({ totp_secret: secret }).eq('id', userId);
  const otpauth = authenticator.keyuri(email, 'Antariksha Trek Ops', secret);
  return { secret, otpauth };
}

export async function confirmTotp(userId: string, code: string) {
  const { data } = await supabase.from('users').select('totp_secret').eq('id', userId).single();
  const secret = (data as { totp_secret: string | null })?.totp_secret;
  if (!secret || !authenticator.check(code, secret)) {
    throw new ApiError(401, 'Invalid authenticator code');
  }
  await supabase.from('users').update({ totp_enabled: true }).eq('id', userId);
  return { enabled: true };
}
