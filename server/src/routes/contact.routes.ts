import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/error.js';
import { ok } from '../lib/http.js';
import { sendMail } from '../lib/mailer.js';
import { env } from '../config/env.js';

const router = Router();

// This is the only unauthenticated write endpoint in the API, so it is limited
// far more tightly than the global limiter.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { message: 'Too many messages sent. Please try again later.' } },
});

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  message: z.string().min(10).max(2000),
});

/** Escape user input before embedding it in the notification email body. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

router.post(
  '/',
  contactLimiter,
  asyncHandler(async (req, res) => {
    const b = contactSchema.parse(req.body);
    await sendMail(
      env.mail.supportTo,
      `Contact form: ${esc(b.name)}`,
      `<p>New message from the public contact form.</p>
       <ul>
         <li>Name: ${esc(b.name)}</li>
         <li>Email: ${esc(b.email)}</li>
         <li>IP: ${esc(req.ip ?? 'unknown')}</li>
       </ul>
       <p style="white-space:pre-wrap">${esc(b.message)}</p>`,
    );
    ok(res, { ok: true }, 202);
  }),
);

export default router;
