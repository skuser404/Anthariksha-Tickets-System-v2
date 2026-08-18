/**
 * Pure helpers for the Google Drive document workflow — no I/O, so they are
 * unit-testable without credentials or network access.
 */

export const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** 10 MB — matches the client-side guard and keeps uploads off slow links. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;


/** Drive treats these as path separators / query metacharacters. */
export function sanitiseFolderName(name: string): string {
  return (
    name
      .replace(/[/\\]/g, '-')
      .replace(/['"]/g, '')
      // Control characters have no place in a folder name.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'Unnamed'
  );
}

/** Escape a value for embedding in a Drive `q` query string literal. */
export function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Where rejected permits are archived, as a child of the configured root. */
export const REJECTED_FOLDER = 'Rejected Tickets';

/**
 * Validate an ISO date and return it unchanged.
 *
 * Trek dates are handled as plain `YYYY-MM-DD` strings end to end and are never
 * parsed into a Date. Parsing would apply the server's timezone, so a date
 * chosen as 22 August could be filed as the 21st on a server behind UTC.
 */
export function assertIsoDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`Invalid trek date "${isoDate}" (expected YYYY-MM-DD)`);
  const [, , month, day] = m;
  if (Number(month) < 1 || Number(month) > 12) throw new Error(`Invalid month in "${isoDate}"`);
  if (Number(day) < 1 || Number(day) > 31) throw new Error(`Invalid day in "${isoDate}"`);
  return isoDate;
}

/**
 * The folder a permit is filed under, relative to the configured root:
 *
 *   2026-08-22 - Kudremukh
 *
 * ISO order so Drive sorts departures chronologically by name.
 *
 * One folder per trek-date + trek, shared by every member booked on that
 * departure — an admin verifying a given date opens exactly one folder and sees
 * all of its permits together. Returned as an array because the Drive service
 * walks it segment by segment.
 */
export function buildFolderPath(trekDate: string, trekName: string): string[] {
  return [sanitiseFolderName(`${assertIsoDate(trekDate)} - ${trekName}`)];
}

/**
 * Stored filename: `AV12345_SunilKumar_2026-08-22.pdf`.
 *
 * Members share a folder, so the ticket code has to be part of the name to keep
 * files distinct. Re-uploads get a `_v2` suffix rather than overwriting, so a
 * corrected permit never destroys the one an admin already reviewed.
 */
export function buildFileName(
  mimeType: string,
  version: number,
  ticketCode: string,
  memberName: string,
  trekDate: string,
): string {
  const ext = ALLOWED_MIME[mimeType];
  if (!ext) throw new Error(`Unsupported file type: ${mimeType}`);
  const code = sanitiseFileToken(ticketCode) || 'TICKET';
  const who = sanitiseFileToken(memberName) || 'Member';
  const when = assertIsoDate(trekDate);
  const suffix = version > 1 ? `_v${version}` : '';
  return `${code}_${who}_${when}${suffix}.${ext}`;
}

/** Filename-safe token: no separators, spaces or punctuation. */
export function sanitiseFileToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 40);
}

export interface FileCheck {
  ok: boolean;
  reason?: string;
}

/** Validate an uploaded permit before it ever reaches Drive. */
export function validateUpload(mimeType: string, size: number, magic?: Buffer): FileCheck {
  if (!ALLOWED_MIME[mimeType]) {
    return { ok: false, reason: `Unsupported file type "${mimeType}". Upload a PDF, JPG or PNG.` };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: 'File is empty.' };
  }
  if (size > MAX_FILE_BYTES) {
    return { ok: false, reason: `File is too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB).` };
  }
  // Content sniffing: catches a renamed/corrupt file whose extension lies.
  if (magic && magic.length >= 4 && !matchesMagic(mimeType, magic)) {
    return { ok: false, reason: 'File appears corrupt or is not really a ' + ALLOWED_MIME[mimeType].toUpperCase() + '.' };
  }
  return { ok: true };
}

/** True when the leading bytes match the declared MIME type. */
export function matchesMagic(mimeType: string, head: Buffer): boolean {
  if (mimeType === 'application/pdf') {
    return head.subarray(0, 4).toString('latin1') === '%PDF';
  }
  if (mimeType === 'image/jpeg') {
    return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  }
  return false;
}

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
export const filePreviewUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const fileEmbedUrl = (id: string) => `https://drive.google.com/file/d/${id}/preview`;
