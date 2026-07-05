import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
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
  },

  security: {
    otpTtlSeconds: int('OTP_TTL_SECONDS', 300),
    otpResendSeconds: int('OTP_RESEND_SECONDS', 60),
    otpMaxAttempts: int('OTP_MAX_ATTEMPTS', 5),
    accountLockMinutes: int('ACCOUNT_LOCK_MINUTES', 15),
  },
} as const;

export const isProd = env.nodeEnv === 'production';
