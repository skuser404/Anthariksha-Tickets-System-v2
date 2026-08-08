import { ApiError } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { audit, notify } from '../lib/audit.js';
import { fileEmbedUrl } from '../lib/drive-path.js';
import * as drive from './drive.service.js';

export interface DocRow {
  id: string;
  ticket_id: string;
  drive_file_id: string;
  drive_file_url: string;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  file_name: string;
  mime_type: string;
  file_size: number;
  checksum: string | null;
  version: number;
  is_current: boolean;
  archived_at: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

async function ticketFor(ticketId: string) {
  const { data } = await supabase
    .from('tickets')
    .select('id, ticket_code, member_id, status, trek_name, trek_date, persons, booking_email, member:member_id(full_name)')
    .eq('id', ticketId)
    .maybeSingle();
  if (!data) throw new ApiError(404, 'Ticket not found');
  return data as unknown as {
    id: string; ticket_code: string; member_id: string; status: string;
    trek_name: string; trek_date: string; persons: number; booking_email: string;
    member?: { full_name: string };
  };
}

function assertAccess(ticket: { member_id: string }, user: { sub: string; role: string }) {
  if (user.role !== 'admin' && ticket.member_id !== user.sub) throw new ApiError(403, 'Not your ticket');
}

/** All versions for a ticket, newest first. Adds an embeddable preview URL. */
export async function listDocuments(ticketId: string, user: { sub: string; role: 'admin' | 'member' }) {
  const ticket = await ticketFor(ticketId);
  assertAccess(ticket, user);

  const { data, error } = await supabase
    .from('ticket_documents')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('version', { ascending: false });
  if (error) throw new ApiError(500, error.message);

  const rows = (data ?? []) as DocRow[];
  return {
    items: rows.map((d) => ({ ...d, embedUrl: fileEmbedUrl(d.drive_file_id) })),
    current: rows.find((d) => d.is_current) ?? null,
  };
}

/**
 * Upload (or replace) a ticket's permit.
 *
 * A replacement archives the previous version in Drive and flips `is_current`
 * in the database — nothing is destroyed, so the audit trail stays intact.
 */
export async function uploadDocument(params: {
  ticketId: string;
  buffer: Buffer;
  mimeType: string;
  user: { sub: string; role: 'admin' | 'member'; name: string };
  reason?: string;
  ip?: string | null;
}) {
  const ticket = await ticketFor(params.ticketId);
  assertAccess(ticket, params.user);

  const { data: existing } = await supabase
    .from('ticket_documents')
    .select('*')
    .eq('ticket_id', params.ticketId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const previous = existing as DocRow | null;
  const version = (previous?.version ?? 0) + 1;

  const uploaded = await drive.uploadPermit({
    buffer: params.buffer,
    mimeType: params.mimeType,
    trekDate: ticket.trek_date,
    trekName: ticket.trek_name,
    memberName: ticket.member?.full_name ?? 'Unknown Member',
    ticketCode: ticket.ticket_code,
    version,
  });

  // Archive the superseded version before the new row claims `is_current`
  // (a partial unique index allows only one live document per ticket).
  if (previous?.is_current) {
    if (previous.drive_folder_id) {
      await drive
        .archiveFile(previous.drive_file_id, previous.drive_folder_id, previous.file_name)
        .catch(() => { /* archiving is best-effort; never block a re-upload */ });
    }
    await supabase
      .from('ticket_documents')
      .update({ is_current: false, archived_at: new Date().toISOString(), archived_by: params.user.sub, replaced_reason: params.reason ?? null })
      .eq('id', previous.id);
  }

  const { data, error } = await supabase
    .from('ticket_documents')
    .insert({
      ticket_id: params.ticketId,
      drive_file_id: uploaded.driveFileId,
      drive_file_url: uploaded.driveFileUrl,
      drive_folder_id: uploaded.driveFolderId,
      drive_folder_url: uploaded.driveFolderUrl,
      file_name: uploaded.fileName,
      mime_type: uploaded.mimeType,
      file_size: uploaded.fileSize,
      checksum: uploaded.checksum,
      version,
      is_current: true,
      uploaded_by: params.user.sub,
    })
    .select('*')
    .single();
  if (error) throw new ApiError(500, `Document saved to Drive but not recorded: ${error.message}`);

  await audit({
    actorId: params.user.sub,
    action: version === 1 ? 'document.upload' : 'document.replace',
    entity: 'ticket',
    entityId: params.ticketId,
    metadata: { version, driveFileId: uploaded.driveFileId, fileSize: uploaded.fileSize },
    ip: params.ip,
  });

  // Tell the other party a document landed.
  if (params.user.role === 'member') {
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
    await Promise.all(
      (admins ?? []).map((a) =>
        notify({
          userId: a.id,
          title: version === 1 ? 'Permit uploaded' : 'Permit replaced',
          body: `${params.user.name} uploaded a permit for ticket ${ticket.ticket_code} (${ticket.trek_name}).`,
          link: '/admin/tickets',
        }),
      ),
    );
  } else {
    await notify({
      userId: ticket.member_id,
      title: 'Permit document updated',
      body: `An admin updated the permit on ticket ${ticket.ticket_code}.`,
      link: `/tickets/${params.ticketId}`,
    });
  }

  return { ...(data as DocRow), embedUrl: fileEmbedUrl(uploaded.driveFileId) };
}

/** Archive the current document without replacing it (admin only). */
export async function archiveDocument(ticketId: string, adminId: string, ip?: string | null) {
  const { data } = await supabase
    .from('ticket_documents')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('is_current', true)
    .maybeSingle();
  const doc = data as DocRow | null;
  if (!doc) throw new ApiError(404, 'No current document on this ticket');

  if (doc.drive_folder_id) {
    await drive.archiveFile(doc.drive_file_id, doc.drive_folder_id, doc.file_name).catch(() => {});
  }
  await supabase
    .from('ticket_documents')
    .update({ is_current: false, archived_at: new Date().toISOString(), archived_by: adminId })
    .eq('id', doc.id);

  await audit({ actorId: adminId, action: 'document.archive', entity: 'ticket', entityId: ticketId, metadata: { driveFileId: doc.drive_file_id }, ip });
  return { ok: true };
}

/**
 * Move a rejected ticket's permit into the `Rejected Tickets` archive.
 *
 * Best-effort by design: a Drive hiccup must not roll back a rejection the
 * admin already confirmed. The database keeps the row either way, so a failed
 * move is visible (rejected_at stays null) and can be retried.
 */
export async function archiveRejectedDocument(ticketId: string, adminId: string) {
  const ticket = await ticketFor(ticketId);
  const { data } = await supabase
    .from('ticket_documents')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('is_current', true)
    .maybeSingle();
  const doc = data as DocRow | null;
  if (!doc?.drive_folder_id) return { archived: false as const };

  try {
    const moved = await drive.archiveRejected(
      doc.drive_file_id,
      doc.drive_folder_id,
      ticket.trek_date,
      ticket.trek_name,
    );
    await supabase
      .from('ticket_documents')
      .update({
        rejected_at: new Date().toISOString(),
        rejected_file_id: doc.drive_file_id,
        rejected_folder_id: moved.rejectedFolderId,
        drive_folder_id: moved.rejectedFolderId,
        drive_folder_url: moved.rejectedFolderUrl,
      })
      .eq('id', doc.id);
    await audit({
      actorId: adminId,
      action: 'document.rejected_archived',
      entity: 'ticket',
      entityId: ticketId,
      metadata: { driveFileId: doc.drive_file_id, into: moved.rejectedFolderId },
    });
    return { archived: true as const, ...moved };
  } catch (e) {
    // Surface it in the audit log rather than failing the rejection.
    await audit({
      actorId: adminId,
      action: 'document.rejected_archive_failed',
      entity: 'ticket',
      entityId: ticketId,
      metadata: { driveFileId: doc.drive_file_id, error: e instanceof Error ? e.message : 'unknown' },
    });
    return { archived: false as const };
  }
}

export interface VerificationCheck {
  code: string;
  label: string;
  severity: 'pass' | 'warning' | 'danger';
  message: string;
}

/**
 * The pre-approval checklist. Runs against live data every time an admin opens
 * a ticket, and again server-side before an approval is allowed through.
 */
export async function runVerificationChecks(ticketId: string): Promise<{ checks: VerificationCheck[]; blocking: number }> {
  const ticket = await ticketFor(ticketId);
  const checks: VerificationCheck[] = [];
  const add = (code: string, label: string, severity: VerificationCheck['severity'], message: string) =>
    checks.push({ code, label, severity, message });

  // --- Document present? ---
  const { data: docData } = await supabase
    .from('ticket_documents')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('is_current', true)
    .maybeSingle();
  const doc = docData as DocRow | null;

  if (!doc) {
    add('missing_document', 'Permit document', 'danger', 'No permit document has been uploaded for this ticket.');
  } else {
    add('document_present', 'Permit document', 'pass', `${doc.file_name} (${Math.round(doc.file_size / 1024)} KB), version ${doc.version}.`);

    // --- Invalid file type / corruption ---
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(doc.mime_type)) {
      add('invalid_file_type', 'File type', 'danger', `Unsupported file type "${doc.mime_type}".`);
    } else {
      add('file_type_ok', 'File type', 'pass', doc.mime_type);
    }
    if (doc.file_size <= 0) {
      add('file_corrupt', 'File integrity', 'danger', 'Uploaded file is empty or corrupt.');
    }

    // --- Duplicate file (same bytes uploaded on another ticket) ---
    if (doc.checksum) {
      const { data: dupes } = await supabase
        .from('ticket_documents')
        .select('ticket_id')
        .eq('checksum', doc.checksum)
        .neq('ticket_id', ticketId)
        .limit(1);
      if ((dupes ?? []).length > 0) {
        add('duplicate_file', 'Duplicate file', 'danger', 'This exact file was already uploaded on another ticket.');
      } else {
        add('unique_file', 'Duplicate file', 'pass', 'File is unique across all tickets.');
      }
    }
  }

  // --- Duplicate ticket code ---
  const { data: sameCode } = await supabase
    .from('tickets')
    .select('id')
    .eq('ticket_code', ticket.ticket_code)
    .neq('id', ticketId)
    .limit(1);
  if ((sameCode ?? []).length > 0) {
    add('duplicate_ticket', 'Duplicate ticket', 'danger', `Ticket code ${ticket.ticket_code} exists on another record.`);
  } else {
    add('unique_ticket', 'Duplicate ticket', 'pass', 'Ticket code is unique.');
  }

  // --- Required fields ---
  if (!ticket.ticket_code?.trim()) add('missing_ticket_id', 'Ticket ID', 'danger', 'Ticket ID is missing.');
  if (!ticket.booking_email?.trim()) add('missing_booking_email', 'Booking email', 'danger', 'Booking email is missing.');
  if (!ticket.trek_name?.trim()) add('missing_trek', 'Trek', 'danger', 'Trek name is missing.');

  // --- Person count sanity ---
  if (!Number.isInteger(ticket.persons) || ticket.persons < 1) {
    add('bad_person_count', 'Person count', 'danger', `Person count "${ticket.persons}" is invalid.`);
  } else if (ticket.persons > 20) {
    add('high_person_count', 'Person count', 'warning', `${ticket.persons} people on one permit — worth confirming.`);
  } else {
    add('person_count_ok', 'Person count', 'pass', `${ticket.persons} person(s).`);
  }

  // --- Trek still exists in pricing ---
  const { data: trek } = await supabase.from('trek_pricing').select('id').eq('name', ticket.trek_name).maybeSingle();
  if (!trek) add('unknown_trek', 'Trek', 'warning', `"${ticket.trek_name}" is not in the trek pricing list.`);

  return { checks, blocking: checks.filter((c) => c.severity === 'danger').length };
}
