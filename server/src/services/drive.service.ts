import { Readable } from 'node:stream';
import { google, type drive_v3 } from 'googleapis';
import { ApiError } from '../lib/http.js';
import { env } from '../config/env.js';
import { supabase } from '../lib/supabase.js';
import {
  buildFileName,
  buildFolderPath,
  escapeDriveQuery,
  fileEmbedUrl,
  filePreviewUrl,
  folderUrl,
  validateUpload,
  REJECTED_FOLDER,
} from '../lib/drive-path.js';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SCOPES = ['https://www.googleapis.com/auth/drive'];

/** Resolved folder ids, keyed by `parentId/name`. Drive lookups are slow. */
const folderCache = new Map<string, string>();

let client: drive_v3.Drive | null = null;

/**
 * Service-account credentials come from the environment, never the database —
 * a private key in a settings table would be readable by anything with DB
 * access and would end up in backups.
 *
 * Accepts either the raw service-account JSON or its base64 encoding.
 */
function loadCredentials(): { client_email: string; private_key: string } {
  const raw = env.drive.credentials;
  if (!raw) {
    throw new ApiError(503, 'Google Drive is not configured (GOOGLE_DRIVE_CREDENTIALS is unset).');
  }
  let json: string = raw.trim();
  if (!json.startsWith('{')) {
    try {
      json = Buffer.from(json, 'base64').toString('utf8');
    } catch {
      throw new ApiError(500, 'GOOGLE_DRIVE_CREDENTIALS is neither JSON nor valid base64.');
    }
  }
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ApiError(500, 'GOOGLE_DRIVE_CREDENTIALS is not valid JSON.');
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new ApiError(500, 'Service account JSON is missing client_email or private_key.');
  }
  // Escaped newlines survive most env-var transports; Google needs real ones.
  return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, '\n') };
}

/** Which credential style is configured. OAuth wins when both are present. */
export function driveAuthMode(): 'oauth' | 'service_account' | 'none' {
  const d = env.drive;
  if (d.oauthClientId && d.oauthClientSecret && d.oauthRefreshToken) return 'oauth';
  if (d.credentials) return 'service_account';
  return 'none';
}

function drive(): drive_v3.Drive {
  if (client) return client;
  const mode = driveAuthMode();

  if (mode === 'oauth') {
    // Files are created as the authorising user, so they draw on that account's
    // storage. This is the only workable option outside Google Workspace.
    const auth = new google.auth.OAuth2(env.drive.oauthClientId, env.drive.oauthClientSecret);
    auth.setCredentials({ refresh_token: env.drive.oauthRefreshToken });
    client = google.drive({ version: 'v3', auth });
    return client;
  }

  const { client_email, private_key } = loadCredentials();
  const auth = new google.auth.JWT({ email: client_email, key: private_key, scopes: SCOPES });
  client = google.drive({ version: 'v3', auth });
  return client;
}

/** Drop cached auth/folders (used after the configuration changes). */
export function resetDriveClient() {
  client = null;
  folderCache.clear();
}

export function isDriveConfigured(): boolean {
  return driveAuthMode() !== 'none';
}

/** The configured root folder id: DB setting wins, env var is the fallback. */
export async function getRootFolderId(): Promise<string> {
  const { data } = await supabase.from('settings').select('value').eq('key', 'google_drive').maybeSingle();
  const fromDb = (data?.value as { rootFolderId?: string | null } | undefined)?.rootFolderId;
  const id = fromDb || env.drive.rootFolderId;
  if (!id) {
    throw new ApiError(503, 'Google Drive root folder is not set. Configure it in Settings → Google Drive.');
  }
  return id;
}

/**
 * Find a child folder by name, creating it only if absent.
 *
 * Concurrent submissions can race here, so a create that loses the race is
 * resolved by re-querying and taking the existing folder — that is what keeps
 * duplicate folders from appearing.
 */
async function ensureFolder(parentId: string, name: string): Promise<string> {
  const cacheKey = `${parentId}/${name}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  const q = [
    `name = '${escapeDriveQuery(name)}'`,
    `mimeType = '${FOLDER_MIME}'`,
    `'${escapeDriveQuery(parentId)}' in parents`,
    'trashed = false',
  ].join(' and ');

  const existing = await drive().files.list({
    q,
    fields: 'files(id, name)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const found = existing.data.files?.[0]?.id;
  if (found) {
    folderCache.set(cacheKey, found);
    return found;
  }

  const created = await drive().files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  });

  let id = created.data.id;
  if (!id) throw new ApiError(502, `Google Drive did not return an id for folder "${name}".`);

  // Lost a creation race? Prefer the oldest folder so everyone converges.
  const recheck = await drive().files.list({
    q,
    fields: 'files(id, createdTime)',
    orderBy: 'createdTime',
    pageSize: 2,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const oldest = recheck.data.files?.[0]?.id;
  if (oldest && oldest !== id) {
    await drive().files.delete({ fileId: id, supportsAllDrives: true }).catch(() => {});
    id = oldest;
  }

  folderCache.set(cacheKey, id);
  return id;
}

/** Resolve (creating if needed) the `22-08-2026 - Kudremukh` departure folder. */
export async function ensureTicketFolder(trekDate: string, trekName: string) {
  const root = await getRootFolderId();
  const segments = buildFolderPath(trekDate, trekName);
  let parent = root;
  for (const segment of segments) {
    // Sequential by nature: each folder is the parent of the next.
    // eslint-disable-next-line no-await-in-loop
    parent = await ensureFolder(parent, segment);
  }
  return { folderId: parent, folderUrl: folderUrl(parent), path: segments.join('/') };
}

/**
 * Move a rejected permit into `Rejected Tickets/22-08-2026 - Kudremukh`.
 *
 * Rejections archive rather than delete: the document is the evidence for why
 * the ticket was refused, so destroying it would break the audit trail.
 */
export async function archiveRejected(
  fileId: string,
  currentFolderId: string,
  trekDate: string,
  trekName: string,
) {
  const root = await getRootFolderId();
  const bin = await ensureFolder(root, REJECTED_FOLDER);
  const dated = await ensureFolder(bin, buildFolderPath(trekDate, trekName)[0]);
  await drive().files.update({
    fileId,
    addParents: dated,
    removeParents: currentFolderId,
    fields: 'id',
    supportsAllDrives: true,
  });
  return { rejectedFolderId: dated, rejectedFolderUrl: folderUrl(dated) };
}

export interface UploadedDoc {
  driveFileId: string;
  driveFileUrl: string;
  driveEmbedUrl: string;
  driveFolderId: string;
  driveFolderUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum: string | null;
}

/** Upload a permit into the ticket's folder and return its Drive coordinates. */
export async function uploadPermit(params: {
  buffer: Buffer;
  mimeType: string;
  trekDate: string;
  trekName: string;
  memberName: string;
  ticketCode: string;
  version: number;
}): Promise<UploadedDoc> {
  const check = validateUpload(params.mimeType, params.buffer.length, params.buffer.subarray(0, 8));
  if (!check.ok) throw new ApiError(422, check.reason!);

  const folder = await ensureTicketFolder(params.trekDate, params.trekName);
  const fileName = buildFileName(
    params.mimeType,
    params.version,
    params.ticketCode,
    params.memberName,
    params.trekDate,
  );

  const created = await drive().files.create({
    requestBody: { name: fileName, parents: [folder.folderId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: 'id, name, size, md5Checksum, mimeType, webViewLink',
    supportsAllDrives: true,
  });

  const id = created.data.id;
  if (!id) throw new ApiError(502, 'Google Drive did not return a file id.');

  return {
    driveFileId: id,
    driveFileUrl: created.data.webViewLink ?? filePreviewUrl(id),
    driveEmbedUrl: fileEmbedUrl(id),
    driveFolderId: folder.folderId,
    driveFolderUrl: folder.folderUrl,
    fileName: created.data.name ?? fileName,
    mimeType: created.data.mimeType ?? params.mimeType,
    fileSize: Number(created.data.size ?? params.buffer.length),
    checksum: created.data.md5Checksum ?? null,
  };
}

/**
 * Archive a superseded permit. The file is renamed and moved into an
 * `_archived` sub-folder rather than deleted, so version history survives.
 */
export async function archiveFile(fileId: string, parentFolderId: string, fileName: string) {
  const archiveFolder = await ensureFolder(parentFolderId, '_archived');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  await drive().files.update({
    fileId,
    addParents: archiveFolder,
    removeParents: parentFolderId,
    requestBody: { name: `${stamp} ${fileName}` },
    fields: 'id',
    supportsAllDrives: true,
  });
  return { archivedInto: archiveFolder };
}

/** Move a file to Drive's trash (recoverable for 30 days). */
export async function trashFile(fileId: string) {
  await drive().files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true });
}

/** Stream a file's bytes back through the API (used for inline preview). */
export async function downloadFile(fileId: string): Promise<{ stream: Readable; mimeType: string; name: string }> {
  const meta = await drive().files.get({
    fileId,
    fields: 'mimeType, name',
    supportsAllDrives: true,
  });
  const res = await drive().files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' },
  );
  return {
    stream: res.data as unknown as Readable,
    mimeType: meta.data.mimeType ?? 'application/octet-stream',
    name: meta.data.name ?? 'document',
  };
}

export interface DriveStatus {
  configured: boolean;
  connected: boolean;
  authMode?: 'oauth' | 'service_account' | 'none';
  rootFolderId: string | null;
  rootFolderName: string | null;
  rootFolderUrl: string | null;
  serviceAccountEmail: string | null;
  storageUsed: string | null;
  storageLimit: string | null;
  isSharedDrive: boolean;
  message: string;
}

/** Probe the connection: auth, root folder reachability and quota. */
export async function testConnection(): Promise<DriveStatus> {
  const base: DriveStatus = {
    configured: isDriveConfigured(),
    connected: false,
    rootFolderId: null,
    rootFolderName: null,
    rootFolderUrl: null,
    serviceAccountEmail: null,
    storageUsed: null,
    storageLimit: null,
    isSharedDrive: false,
    message: '',
  };

  const mode = driveAuthMode();
  base.authMode = mode;

  if (!base.configured) {
    return {
      ...base,
      message: 'Google Drive is not configured. Set GOOGLE_DRIVE_CREDENTIALS, or the GOOGLE_OAUTH_* variables.',
    };
  }

  try {
    if (mode === 'oauth') {
      const about = await drive().about.get({ fields: 'user(emailAddress)' });
      base.serviceAccountEmail = about.data.user?.emailAddress ?? 'OAuth user';
    } else {
      base.serviceAccountEmail = loadCredentials().client_email;
    }
    const rootId = await getRootFolderId();
    base.rootFolderId = rootId;
    base.rootFolderUrl = folderUrl(rootId);

    const folder = await drive().files.get({
      fileId: rootId,
      fields: 'id, name, driveId, capabilities(canAddChildren)',
      supportsAllDrives: true,
    });
    base.rootFolderName = folder.data.name ?? null;
    base.isSharedDrive = Boolean(folder.data.driveId);

    if (folder.data.capabilities?.canAddChildren === false) {
      return {
        ...base,
        message: `The service account can see "${folder.data.name}" but cannot add files to it. Share the folder with ${base.serviceAccountEmail} as Content manager / Editor.`,
      };
    }

    const about = await drive().about.get({ fields: 'storageQuota' });
    base.storageUsed = about.data.storageQuota?.usage ?? null;
    base.storageLimit = about.data.storageQuota?.limit ?? null;

    // Only a service account is quota-less. Under OAuth the files belong to the
    // authorising user, so a My Drive folder is perfectly fine.
    const quotaRisk = mode === 'service_account' && !base.isSharedDrive;

    return {
      ...base,
      connected: true,
      message: quotaRisk
        ? `Connected to "${base.rootFolderName}", but this is a My Drive folder and you are using a service account, which has no storage quota — uploads will fail with storageQuotaExceeded. Use a Shared Drive (Google Workspace), or switch to OAuth delegation.`
        : mode === 'oauth'
          ? `Connected as ${base.serviceAccountEmail} to "${base.rootFolderName}". Files are stored in that account's Drive.`
          : `Connected to shared drive folder "${base.rootFolderName}".`,
    };
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Unknown error';
    return { ...base, message: `Connection failed: ${msg}` };
  }
}

/**
 * Persist the root folder id and/or the last sync outcome.
 *
 * `rootFolderId` is only written when explicitly provided. Passing `undefined`
 * records the sync result and leaves the configured folder alone — a failed
 * connection test used to write its null folder id back over a working
 * configuration, silently un-configuring Drive.
 */
export async function saveDriveSettings(rootFolderId?: string | null, status?: string) {
  const current = (await getDriveSettings()) as { rootFolderId?: string | null };
  const value = {
    rootFolderId: rootFolderId === undefined ? (current.rootFolderId ?? null) : (rootFolderId || null),
    lastSyncAt: new Date().toISOString(),
    lastSyncStatus: status ?? null,
  };
  await supabase.from('settings').upsert({ key: 'google_drive', value }, { onConflict: 'key' });
  resetDriveClient();
  return value;
}

export async function getDriveSettings() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'google_drive').maybeSingle();
  return (data?.value as Record<string, unknown>) ?? { rootFolderId: null, lastSyncAt: null, lastSyncStatus: null };
}
