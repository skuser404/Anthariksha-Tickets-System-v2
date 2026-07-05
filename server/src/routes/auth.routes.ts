import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { verifyRefresh } from '../lib/tokens.js';
import * as auth from '../services/auth.service.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { message: 'Too many login attempts, slow down.' } },
});

const meta = (req: import('express').Request) => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'] ?? null,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const result = await auth.loginWithPassword(email, password, meta(req));
    ok(res, result);
  }),
);

const otpSchema = z.object({
  challengeToken: z.string().min(10),
  code: z.string().min(4).max(8),
});

router.post(
  '/verify-otp',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { challengeToken, code } = otpSchema.parse(req.body);
    const result = await auth.verifyOtp(challengeToken, code, meta(req));
    ok(res, result);
  }),
);

router.post(
  '/resend-otp',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { challengeToken } = z.object({ challengeToken: z.string() }).parse(req.body);
    ok(res, await auth.resendOtp(challengeToken));
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    let sub: string;
    try {
      sub = verifyRefresh(refreshToken).sub;
    } catch {
      throw new ApiError(401, 'Invalid refresh token');
    }
    ok(res, await auth.rotateAccess(sub));
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, { user: req.user });
  }),
);

// --- Authenticator-app (TOTP) enrollment for the logged-in admin ---
router.post(
  '/totp/setup',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'admin') throw new ApiError(403, 'Admins only');
    ok(res, await auth.setupTotp(req.user!.sub, req.user!.email));
  }),
);

router.post(
  '/totp/confirm',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code } = z.object({ code: z.string().min(6).max(6) }).parse(req.body);
    ok(res, await auth.confirmTotp(req.user!.sub, code));
  }),
);

export default router;
