import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  HardDrive, CheckCircle2, XCircle, Loader2, RefreshCw, Save, FolderOpen, AlertTriangle, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardTitle, Input, Label, Skeleton } from '@/components/ui';

interface DriveStatus {
  configured: boolean;
  connected: boolean;
  rootFolderId: string | null;
  rootFolderName: string | null;
  rootFolderUrl: string | null;
  serviceAccountEmail: string | null;
  storageUsed: string | null;
  storageLimit: string | null;
  isSharedDrive: boolean;
  message: string;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
}

const bytes = (v: string | null) => {
  if (!v) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let x = n;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i += 1; }
  return `${x.toFixed(x < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

export default function DriveSettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [folderId, setFolderId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['drive-status'],
    queryFn: async () => (await api.get('/drive/status')).data.data as DriveStatus,
  });

  useEffect(() => {
    if (data?.rootFolderId) setFolderId(data.rootFolderId);
  }, [data?.rootFolderId]);

  const save = useMutation({
    mutationFn: async () => api.put('/drive/settings', { rootFolderId: folderId.trim() || null }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['drive-status'] });
      const s = res.data.data as DriveStatus;
      if (s.connected) toast.success('Saved and connected');
      else toast.warning(s.message);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const test = useMutation({
    mutationFn: async () => api.post('/drive/test'),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['drive-status'] });
      const s = res.data.data as DriveStatus;
      if (s.connected) toast.success(s.message);
      else toast.error(s.message);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const reconnect = useMutation({
    mutationFn: async () => api.post('/drive/reconnect'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drive-status'] }); toast.success('Drive client reset'); },
    onError: (e) => toast.error(apiError(e)),
  });

  if (!user?.isSuper) {
    return (
      <Card>
        <div className="p-2 text-center">
          <AlertTriangle className="mx-auto mb-2 text-amber-500" size={24} />
          <p className="font-medium">Super-admin access required</p>
          <p className="text-sm text-slate-500">Only a super-admin can change Google Drive configuration.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><HardDrive className="text-brand-500" /> Google Drive</h1>
        <p className="text-sm text-slate-500">Where ticket permit documents are stored.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <Card>
            <CardTitle>Connection status</CardTitle>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-2">
                {data?.connected ? (
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={18} />
                ) : (
                  <XCircle className="mt-0.5 shrink-0 text-rose-500" size={18} />
                )}
                <div>
                  <p className="font-medium">{data?.connected ? 'Connected' : 'Not connected'}</p>
                  <p className="text-sm text-slate-500">{data?.message}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Service account" value={data?.serviceAccountEmail ?? 'Not configured'} />
                <Field label="Root folder" value={data?.rootFolderName ?? '—'} />
                <Field label="Drive type" value={data?.isSharedDrive ? 'Shared Drive ✅' : 'My Drive folder ⚠️'} />
                <Field label="Storage used" value={data?.storageLimit ? `${bytes(data.storageUsed)} of ${bytes(data.storageLimit)}` : bytes(data?.storageUsed ?? null)} />
                <Field label="Last sync" value={data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString('en-IN') : 'Never'} />
                <Field label="Last result" value={data?.lastSyncStatus ?? '—'} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => test.mutate()} disabled={test.isPending}>
                  {test.isPending ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />} Test connection
                </Button>
                <Button size="sm" variant="outline" onClick={() => reconnect.mutate()} disabled={reconnect.isPending}>
                  <RefreshCw size={14} /> Reconnect
                </Button>
                {data?.rootFolderUrl && (
                  <a href={data.rootFolderUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><FolderOpen size={14} /> Open in Drive</Button>
                  </a>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Root folder</CardTitle>
            <div className="mt-3 space-y-3">
              <div>
                <Label>Google Drive folder ID</Label>
                <Input
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  placeholder="1AbCdEfGhIjKlMnOpQrStUvWxYz"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Open the folder in Drive — the ID is the last part of the URL
                  (<code>drive.google.com/drive/folders/&lt;ID&gt;</code>).
                </p>
              </div>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !folderId.trim()}>
                {save.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save & verify
              </Button>
            </div>
          </Card>

          <Card>
            <CardTitle>Folder structure</CardTitle>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-300">
{`<root folder>/
└── 2026/
    └── August/
        └── 09-08-2026 - Kudremukh Trek/
            └── Sunil Kumar/
                ├── Ticket.pdf
                └── _archived/
                    └── 2026-08-05-11-30-00 Ticket.pdf`}
            </pre>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
              <Info size={13} className="mt-0.5 shrink-0" />
              Folders are reused when they already exist — replacing a permit archives the old
              version rather than deleting it.
            </p>
          </Card>

          {!data?.configured && (
            <Card>
              <CardTitle>Setup required</CardTitle>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-500">
                <li>Create a Google Cloud project and enable the <b>Google Drive API</b>.</li>
                <li>Create a <b>service account</b> and download its JSON key.</li>
                <li>
                  Set <code>GOOGLE_DRIVE_CREDENTIALS</code> on the API server to that JSON
                  (raw or base64). It is never stored in the database.
                </li>
                <li>
                  Create a <b>Shared Drive</b> folder and share it with the service-account email
                  as <b>Content manager</b>. Service accounts have no personal storage quota, so a
                  plain My Drive folder will fail with <code>storageQuotaExceeded</code>.
                </li>
                <li>Paste the folder ID above and click <b>Save &amp; verify</b>.</li>
              </ol>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="truncate text-sm font-medium" title={value}>{value}</p>
    </div>
  );
}
