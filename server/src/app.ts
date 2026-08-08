import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import ticketRoutes from './routes/tickets.routes.js';
import trekRoutes from './routes/treks.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import paymentRoutes from './routes/payments.routes.js';
import refundRoutes from './routes/refunds.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import userRoutes from './routes/users.routes.js';
import reportRoutes from './routes/reports.routes.js';
import registerRoutes from './routes/registers.routes.js';
import auditRoutes from './routes/audit.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import ledgerRoutes from './routes/ledger.routes.js';
import intelRoutes from './routes/intel.routes.js';
import calendarRoutes from './routes/calendar.routes.js';
import adminRoutes from './routes/admins.routes.js';
import contactRoutes from './routes/contact.routes.js';
import documentRoutes, { documentContentRouter } from './routes/documents.routes.js';
import announcementRoutes from './routes/announcements.routes.js';
import searchRoutes from './routes/search.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // correct req.ip behind Railway/Vercel proxies
  app.use(helmet());
  app.use(
    cors({
      origin: env.clientOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // Global rate limit (defense-in-depth; tighter limiters live on auth routes).
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'antariksha-api', ts: Date.now() }));

  app.use('/api/auth', authRoutes);
  // Must precede ticketRoutes: that router applies requireAuth to every
  // /api/tickets/* path, and the document preview authenticates with its own
  // short-lived view token instead of a session token.
  app.use('/api', documentContentRouter);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/treks', trekRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/refunds', refundRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/registers', registerRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/ledger', ledgerRoutes);
  app.use('/api/intel', intelRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/admins', adminRoutes);
  app.use('/api/announcements', announcementRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/contact', contactRoutes); // public (unauthenticated), heavily rate-limited
  // Permit documents in Google Drive + Drive configuration. Mounted at /api so
  // it can own both /api/tickets/:id/documents and /api/drive/*.
  app.use('/api', documentRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
