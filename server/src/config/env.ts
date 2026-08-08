import dotenv from 'dotenv';
dotenv.config();

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Required config. The fallbacks exist so `npm run dev` works with no .env at
 * all — but they are development-only placeholders. In production a missing
 * value is a hard failure: silently booting with `dev-access-secret-change-me`
 * would mean anyone could forge a valid JWT.
 */
function required(name: string, devFallback?: string): string {
  const v = process.env[name];
  if (v !== undefined && v !== '') return v;
  if (IS_PROD || devFallback === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return devFallback;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? Number.parseInt(v, 10) : fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: int('PORT', 4000),
  clientOrigin: optional('CLIENT_ORIGIN', 'http://localhost:5173'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
    accessTtl: optional('ACCESS_TOKEN_TTL', '15m'),
    refreshTtl: optional('REFRESH_TOKEN_TTL', '7d'),
  },

  supabase: {
    url: required('SUPABASE_URL', 'http://localhost:54321'),
    serviceKey: required('SUPABASE_SERVICE_ROLE_KEY', 'dev-service-key'),
  },

  mail: {
    host: optional('SMTP_HOST'),
    port: int('SMTP_PORT', 587),
    user: optional('SMTP_USER'),
    pass: optional('SMTP_PASS'),
    from: optional('MAIL_FROM', 'Antariksha Ops <no-reply@antariksha.local>'),
    // Where the public contact form delivers. Falls back to the from-address.
    supportTo: optional('SUPPORT_EMAIL') || optional('ADMIN_EMAIL') || optional('MAIL_FROM', 'Antariksha Ops <no-reply@antariksha.local>'),
  },

  drive: {
    // Service-account JSON (raw or base64). Kept in the environment, never in
    // the database — a private key in a settings table ends up in backups.
    credentials: optional('GOOGLE_DRIVE_CREDENTIALS'),
    // Fallback root folder; the Settings page value takes precedence.
    rootFolderId: optional('GOOGLE_DRIVE_ROOT_FOLDER_ID'),

    // OAuth delegation — the alternative to a service account.
    //
    // A service account owns the files it creates but has no storage quota of
    // its own, so it can only write into a Shared Drive (a Google Workspace
    // feature). With OAuth, files are owned by a normal Google account and use
    // its quota, which is the only option on a personal Gmail.
    //
    // When these are set they take precedence over GOOGLE_DRIVE_CREDENTIALS.
    oauthClientId: optional('GOOGLE_OAUTH_CLIENT_ID'),
    oauthClientSecret: optional('GOOGLE_OAUTH_CLIENT_SECRET'),
    oauthRefreshToken: optional('GOOGLE_OAUTH_REFRESH_TOKEN'),
  },

  security: {
    /**
     * Force every admin through an email OTP after the password step.
     *
     * Disabled by default: with no SMTP configured the code only appears in the
     * server log, which makes admin sign-in impractical. Set ADMIN_2FA=on once
     * SMTP works — an admin account can approve tickets and move money, so a
     * second factor is worth restoring.
     *
     * Independent of per-user opt-ins: a member who enables email 2FA, or
     * anyone who enrolled an authenticator app, is still challenged.
     */
    adminTwoFactor: optional('ADMIN_2FA', 'off').toLowerCase() === 'on',

    otpTtlSeconds: int('OTP_TTL_SECONDS', 300),
    otpResendSeconds: int('OTP_RESEND_SECONDS', 60),
    otpMaxAttempts: int('OTP_MAX_ATTEMPTS', 5),
    accountLockMinutes: int('ACCOUNT_LOCK_MINUTES', 15),
  },
} as const;

export const isProd = IS_PROD;
