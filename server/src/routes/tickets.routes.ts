import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import * as tickets from '../services/tickets.service.js';
import * as comments from '../services/comments.service.js';

const router = Router();
router.use(requireAuth);

// List — members are scoped to their own tickets; admins see everything.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === 'admin';
    const result = await tickets.listTickets({
      memberId: isAdmin ? (req.query.memberId as string | undefined) : req.user!.sub,
      status: req.query.status as string | undefined,
      trek: req.query.trek as string | undefined,
      search: req.query.search as string | undefined,
      tag: req.query.tag as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    ok(res, result);
  }),
);

// Upcoming booked dates for a trek (availability) — any authenticated user.
router.get(
  '/availability',
  asyncHandler(async (req, res) => {
    const trek = z.string().min(1).parse(req.query.trek);
    ok(res, await tickets.trekAvailability(trek));
  }),
);

// Create — a member submits their own ticket, or an admin submits on a member's behalf.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === 'admin';
    let memberId = req.user!.sub;

    if (isAdmin && req.body?.memberId) {
      const target = z.string().uuid().parse(req.body.memberId);
      const { data: member } = await supabase.from('users').select('id, role').eq('id', target).maybeSingle();
      if (!member || member.role !== 'member') throw new ApiError(400, 'Select a valid member to assign this ticket to');
      memberId = target;
    }

    const created = await tickets.createTicket(memberId, req.body, req.ip, req.user!.sub);
    ok(res, created, 201);
  }),
);

// Verify — admin only.
router.post(
  '/:id/verify',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { decision, remarks } = z
      .object({ decision: z.enum(['approved', 'not_confirmed']), remarks: z.string().optional() })
      .parse(req.body);
    const updated = await tickets.verifyTicket(req.user!.sub, req.params.id, decision, remarks, req.ip);
    ok(res, updated);
  }),
);

// Bulk verify — admin only.
router.post(
  '/bulk-verify',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { ids, decision, remarks } = z
      .object({ ids: z.array(z.string().uuid()).min(1), decision: z.enum(['approved', 'not_confirmed']), remarks: z.string().optional() })
      .parse(req.body);
    ok(res, await tickets.bulkVerify(req.user!.sub, ids, decision, remarks, req.ip));
  }),
);

// Bulk assign tags — admin only.
router.post(
  '/bulk-tags',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { ids, tags } = z.object({ ids: z.array(z.string().uuid()).min(1), tags: z.array(z.string()).min(1) }).parse(req.body);
    ok(res, await tickets.bulkAssignTags(req.user!.sub, ids, tags, req.ip));
  }),
);

// Tags — admin only.
router.put(
  '/:id/tags',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { tags } = z.object({ tags: z.array(z.string()).max(12) }).parse(req.body);
    ok(res, await tickets.setTicketTags(req.user!.sub, req.params.id, tags, req.ip));
  }),
);

// Private admin notes.
router.get(
  '/:id/notes',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    ok(res, await tickets.listTicketNotes(req.params.id));
  }),
);
router.post(
  '/:id/notes',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { body } = z.object({ body: z.string().min(1).max(2000) }).parse(req.body);
    ok(res, await tickets.addTicketNote(req.user!.sub, req.params.id, body), 201);
  }),
);

// Ticket lifecycle timeline (admin or the owning member).
router.get(
  '/:id/timeline',
  asyncHandler(async (req, res) => {
    const result = await tickets.ticketTimeline(req.params.id);
    if (req.user!.role !== 'admin' && result.ticket.member_id !== req.user!.sub) {
      return ok(res, { ticket: result.ticket, steps: result.steps, logs: [] });
    }
    ok(res, result);
  }),
);

// ---- Comments & correction requests (member ↔ admin) ----
router.get(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    ok(res, await comments.listComments(req.params.id, req.user!));
  }),
);

router.post(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    ok(res, await comments.createComment(req.params.id, req.body, req.user!, req.ip), 201);
  }),
);

// Request a signed URL to upload an attachment directly to Supabase Storage.
router.post(
  '/:id/comments/upload-url',
  asyncHandler(async (req, res) => {
    const { fileName } = z.object({ fileName: z.string().min(1) }).parse(req.body);
    ok(res, await comments.createUploadUrl(req.params.id, fileName, req.user!));
  }),
);

// Admin sets the conversation status.
router.post(
  '/:id/comments/status',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    ok(res, await comments.setConversationStatus(req.params.id, req.body, req.user!.sub, req.ip));
  }),
);

// Edit own comment.
router.patch(
  '/comments/:commentId',
  asyncHandler(async (req, res) => {
    const { message } = z.object({ message: z.string().min(1).max(500) }).parse(req.body);
    ok(res, await comments.editComment(req.params.commentId, message, req.user!));
  }),
);

export default router;
