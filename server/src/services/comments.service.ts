import { z } from 'zod';
import { ApiError } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { audit, notify } from '../lib/audit.js';

const BUCKET = 'ticket-attachments';
const COMMENT_TYPES = [
  'correction_request', 'ticket_info', 'booking_issue', 'cancellation_request',
  'replacement_request', 'general_question', 'other',
] as const;

export const createCommentSchema = z.object({
  type: z.enum(COMMENT_TYPES).default('general_question'),
  message: z.string().min(1).max(500),
  attachmentPath: z.string().optional(),
  attachmentName: z.string().optional(),
});

async function ticketFor(ticketId: string) {
  const { data } = await supabase.from('tickets').select('id, ticket_code, member_id, status').eq('id', ticketId).maybeSingle();
  if (!data) throw new ApiError(404, 'Ticket not found');
  return data;
}

/** Member or admin owns access to this ticket's conversation. */
function assertAccess(ticket: { member_id: string }, user: { sub: string; role: string }) {
  if (user.role !== 'admin' && ticket.member_id !== user.sub) throw new ApiError(403, 'Not your ticket');
}

export async function listComments(ticketId: string, user: { sub: string; role: 'admin' | 'member' }) {
  const ticket = await ticketFor(ticketId);
  assertAccess(ticket, user);

  const { data, error } = await supabase
    .from('ticket_comments')
    .select('*, author:author_id(full_name)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) throw new ApiError(500, error.message);

  // Attach short-lived signed download URLs for any attachments.
  const rows = await Promise.all(
    (data ?? []).map(async (c: any) => {
      let attachmentUrl: string | null = null;
      if (c.attachment_path) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(c.attachment_path, 3600);
        attachmentUrl = signed?.signedUrl ?? null;
      }
      return { ...c, attachmentUrl };
    }),
  );

  const status = rows.length ? rows[rows.length - 1].status : 'open';
  return { items: rows, status };
}

/** A signed URL the client can PUT the file to directly (keeps large uploads off the API). */
export async function createUploadUrl(ticketId: string, fileName: string, user: { sub: string; role: 'admin' | 'member' }) {
  const ticket = await ticketFor(ticketId);
  assertAccess(ticket, user);
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  const path = `${ticketId}/${Date.now()}-${safe}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw new ApiError(500, `Storage error: ${error.message}`);
  return { path, token: data.token, signedUrl: data.signedUrl };
}

export async function createComment(ticketId: string, raw: unknown, user: { sub: string; role: 'admin' | 'member'; name: string }, ip?: string | null) {
  const ticket = await ticketFor(ticketId);
  assertAccess(ticket, user);
  const input = createCommentSchema.parse(raw);

  // Conversation status follows who spoke last.
  const status = user.role === 'admin' ? 'waiting_member' : 'waiting_admin';

  const { data, error } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: ticketId,
      author_id: user.sub,
      author_role: user.role,
      type: input.type,
      message: input.message,
      status,
      attachment_path: input.attachmentPath ?? null,
      attachment_name: input.attachmentName ?? null,
    })
    .select('*, author:author_id(full_name)')
    .single();
  if (error) throw new ApiError(500, error.message);

  await audit({ actorId: user.sub, action: 'comment.create', entity: 'ticket', entityId: ticketId, metadata: { type: input.type, hasAttachment: !!input.attachmentPath }, ip });

  // Notify the other party.
  if (user.role === 'member') {
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
    await Promise.all((admins ?? []).map((a) => notify({
      userId: a.id,
      title: input.attachmentPath ? 'New comment + attachment' : 'New ticket comment',
      body: `${user.name} on ${ticket.ticket_code}: "${input.message.slice(0, 80)}"`,
      link: '/admin/tickets',
    })));
  } else {
    await notify({
      userId: ticket.member_id,
      title: 'Admin replied to your ticket',
      body: `${ticket.ticket_code}: "${input.message.slice(0, 80)}"`,
      link: `/tickets/${ticketId}`,
    });
  }

  return data;
}

const statusSchema = z.object({ status: z.enum(['waiting_member', 'resolved', 'closed', 'open']) });

/** Admin updates the conversation status (e.g. request info → resolve → close). */
export async function setConversationStatus(ticketId: string, raw: unknown, adminId: string, ip?: string | null) {
  const ticket = await ticketFor(ticketId);
  const { status } = statusSchema.parse(raw);

  // Apply to the latest comment row (the conversation head).
  const { data: latest } = await supabase
    .from('ticket_comments')
    .select('id')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) throw new ApiError(409, 'No comments to update');

  await supabase.from('ticket_comments').update({ status }).eq('id', latest.id);
  await audit({ actorId: adminId, action: 'comment.status', entity: 'ticket', entityId: ticketId, metadata: { status }, ip });

  if (status === 'resolved' || status === 'closed') {
    await notify({ userId: ticket.member_id, title: `Conversation ${status}`, body: `Your ticket ${ticket.ticket_code} discussion was marked ${status}.`, link: `/tickets/${ticketId}` });
  }
  return { status };
}

/** Edit a comment's message (author only), preserving history via edited_at. */
export async function editComment(commentId: string, message: string, user: { sub: string; role: string }) {
  const { data: comment } = await supabase.from('ticket_comments').select('id, author_id').eq('id', commentId).maybeSingle();
  if (!comment) throw new ApiError(404, 'Comment not found');
  if (comment.author_id !== user.sub) throw new ApiError(403, 'You can only edit your own comment');
  const { data, error } = await supabase
    .from('ticket_comments')
    .update({ message: z.string().min(1).max(500).parse(message), edited_at: new Date().toISOString() })
    .eq('id', commentId)
    .select('*, author:author_id(full_name)')
    .single();
  if (error) throw new ApiError(500, error.message);
  return data;
}
