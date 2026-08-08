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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

/**
 * The folder chain a permit is filed under, relative to the configured root:
 *
 *   2026 / August / 09-08-2026 - Kudremukh Trek / Sunil Kumar
 *
 * `trekDate` is an ISO date (YYYY-MM-DD) and is formatted DD-MM-YYYY to match
 * the operational naming convention.
 */
export function buildFolderPath(trekDate: string, trekName: string, memberName: string): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trekDate);
  if (!m) throw new Error(`Invalid trek date "${trekDate}" (expected YYYY-MM-DD)`);
  const [, year, month, day] = m;

  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error(`Invalid month in "${trekDate}"`);

  return [
    year,
    MONTHS[monthIndex],
    sanitiseFolderName(`${day}-${month}-${year} - ${trekName}`),
    sanitiseFolderName(memberName),
  ];
}

/** Canonical stored filename: `Ticket.pdf`, `Ticket-v2.jpg`, … */
export function buildFileName(mimeType: string, version: number): string {
  const ext = ALLOWED_MIME[mimeType];
  if (!ext) throw new Error(`Unsupported file type: ${mimeType}`);
  return version <= 1 ? `Ticket.${ext}` : `Ticket-v${version}.${ext}`;
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
