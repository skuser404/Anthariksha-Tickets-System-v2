import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole, requireSuper } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { ALLOWED_MIME, MAX_FILE_BYTES } from '../lib/drive-path.js';
import { signDocToken, verifyDocToken } from '../lib/tokens.js';
import { supabase } from '../lib/supabase.js';
import * as documents from '../services/documents.service.js';
import * as drive from '../services/drive.service.js';

const router = Router();

/**
 * Inline preview proxy — mounted separately, and BEFORE the ticket router.
 *
 * It authenticates with a document-scoped view token from the query string
 * because an <iframe>/<img> cannot send an Authorization header. It has to be
 * its own router because `tickets.routes` applies `requireAuth` to every
 * `/api/tickets/*` path, which would reject this request before it ever fell
 * through to here.
 *
 * The permit lives in a private Drive folder, so linking straight to Drive would
 * 404 for the admin's own Google identity. Streaming it through the API lets the
 * browser render it inline with no download step.
 */
export const documentContentRouter = Router();

documentContentRouter.get(
  '/tickets/:id/documents/:docId/content',
  asyncHandler(async (req, res) => {
    const raw = z.string().min(10).safeParse(req.query.t);
    if (!raw.success) throw new ApiError(401, 'A document view token is required');

    let claims;
    try {
      claims = verifyDocToken(raw.data);
    } catch {
      throw new ApiError(401, 'Document link has expired — reopen the ticket.');
    }
    // The token is bound to one document on one ticket; a mismatch is a forgery
    // attempt or a stale link, never a legitimate request.
    if (claims.doc !== req.params.docId || claims.tkt !== req.params.id) {
      throw new ApiError(403, 'This link is not valid for that document');
    }

    const { data: doc } = await supabase
      .from('ticket_documents')
      .select('drive_file_id')
      .eq('id', claims.doc)
      .eq('ticket_id', claims.tkt)
      .maybeSingle();
    if (!doc) throw new ApiError(404, 'Document not found');

    const file = await drive.downloadFile((doc as { drive_file_id: string }).drive_file_id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    file.stream.on('error', () => res.destroy());
    file.stream.pipe(res);
  }),
);

router.use(requireAuth);

// Files are held in memory only long enough to stream them to Drive — nothing
// is written to the API server's disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      cb(new ApiError(422, `Unsupported file type "${file.mimetype}". Upload a PDF, JPG or PNG.`));
      return;
    }
    cb(null, true);
  },
});

/** Multer surfaces its own error class; translate it into our API shape. */
const handleUpload = (field: string) => (req: any, res: any, next: any) =>
  upload.single(field)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(
        new ApiError(
          err.code === 'LIMIT_FILE_SIZE' ? 413 : 422,
          err.code === 'LIMIT_FILE_SIZE'
            ? `File is too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB).`
            : `Upload rejected: ${err.message}`,
        ),
      );
    }
    next(err);
  });

// ---- Documents on a ticket -------------------------------------------------

router.get(
  '/tickets/:id/documents',
  asyncHandler(async (req, res) => {
    ok(res, await documents.listDocuments(req.params.id, req.user!));
  }),
);

router.post(
  '/tickets/:id/documents',
  handleUpload('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(422, 'No file was uploaded (expected field "file").');
    const { reason } = z.object({ reason: z.string().max(500).optional() }).parse(req.body ?? {});
    const doc = await documents.uploadDocument({
      ticketId: req.params.id,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      user: req.user!,
      reason,
      ip: req.ip,
    });
    ok(res, doc, 201);
  }),
);

// Archive the current document without replacing it — admin only.
router.post(
  '/tickets/:id/documents/archive',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    ok(res, await documents.archiveDocument(req.params.id, req.user!.sub, req.ip));
  }),
);

/**
 * Mint a 5-minute view token for one document. The preview URL carries this in
 * a query parameter (iframes cannot set headers), so it is deliberately scoped
 * to a single document rather than being a full session token.
 */
router.post(
  '/tickets/:id/documents/:docId/view-token',
  asyncHandler(async (req, res) => {
    const { items } = await documents.listDocuments(req.params.id, req.user!);
    const doc = items.find((d) => d.id === req.params.docId);
    if (!doc) throw new ApiError(404, 'Document not found on this ticket');
    ok(res, { token: signDocToken({ sub: req.user!.sub, doc: doc.id, tkt: req.params.id }) });
  }),
);

// Pre-approval checklist for a ticket — admin only.
router.get(
  '/tickets/:id/verification-checks',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    ok(res, await documents.runVerificationChecks(req.params.id));
  }),
);

// ---- Google Drive configuration (super-admin) ------------------------------

router.get(
  '/drive/status',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const [status, settings] = await Promise.all([drive.testConnection(), drive.getDriveSettings()]);
    ok(res, { ...status, ...settings });
  }),
);

router.post(
  '/drive/test',
  requireSuper,
  asyncHandler(async (_req, res) => {
    const status = await drive.testConnection();
    await drive.saveDriveSettings(status.rootFolderId, status.connected ? 'connected' : status.message);
    ok(res, status);
  }),
);

router.put(
  '/drive/settings',
  requireSuper,
  asyncHandler(async (req, res) => {
    const { rootFolderId } = z
      .object({ rootFolderId: z.string().trim().min(10).max(200).nullable() })
      .parse(req.body);
    await drive.saveDriveSettings(rootFolderId);
    const status = await drive.testConnection();
    await drive.saveDriveSettings(status.rootFolderId, status.connected ? 'connected' : status.message);
    ok(res, status);
  }),
);

router.post(
  '/drive/reconnect',
  requireSuper,
  asyncHandler(async (_req, res) => {
    drive.resetDriveClient();
    ok(res, await drive.testConnection());
  }),
);

export default router;
