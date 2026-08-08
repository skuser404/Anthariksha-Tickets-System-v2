import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText, ExternalLink, Download, UploadCloud, Archive, FolderOpen,
  Loader2, Eye, EyeOff, AlertTriangle, CheckCircle2, History,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

interface Doc {
  id: string;
  drive_file_id: string;
  drive_file_url: string;
  drive_folder_url: string | null;
  file_name: string;
  mime_type: string;
  file_size: number;
  version: number;
  is_current: boolean;
  archived_at: string | null;
  uploaded_at: string;
  embedUrl: string;
}

export interface VerificationCheck {
  code: string;
  label: string;
  severity: 'pass' | 'warning' | 'danger';
  message: string;
}

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Permit document panel. The file lives in a private Drive folder, so preview
 * streams through the API rather than linking straight to Drive (which would
 * 404 for anyone not signed into the service account).
 */
export function TicketDocument({ ticketId, onChecks }: { ticketId: string; onChecks?: (c: { checks: VerificationCheck[]; blocking: number }) => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', ticketId],
    queryFn: async () => (await api.get(`/tickets/${ticketId}/documents`)).data.data as { items: Doc[]; current: Doc | null },
  });

  useQuery({
    queryKey: ['verification-checks', ticketId],
    enabled: isAdmin,
    queryFn: async () => {
      const r = (await api.get(`/tickets/${ticketId}/verification-checks`)).data.data as { checks: VerificationCheck[]; blocking: number };
      onChecks?.(r);
      return r;
    },
  });

  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return api.post(`/tickets/${ticketId}/documents`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', ticketId] });
      qc.invalidateQueries({ queryKey: ['verification-checks', ticketId] });
      toast.success('Permit uploaded to Google Drive');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const archive = useMutation({
    mutationFn: async () => api.post(`/tickets/${ticketId}/documents/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', ticketId] });
      qc.invalidateQueries({ queryKey: ['verification-checks', ticketId] });
      toast.success('Document archived (recoverable in Drive)');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  function pick(f: File | null) {
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) return toast.error('Please upload a PDF, JPG or PNG.');
    if (f.size > MAX_BYTES) return toast.error('File is too large (max 10 MB).');
    uploadDoc.mutate(f);
  }

  const current = data?.current ?? null;
  const history = (data?.items ?? []).filter((d) => !d.is_current);

  // Preview/download URLs carry a 5-minute, single-document token because an
  // <iframe> cannot send an Authorization header. Minted on demand so it never
  // sits in the DOM longer than needed.
  const { data: viewToken } = useQuery({
    enabled: !!current,
    queryKey: ['doc-view-token', ticketId, current?.id],
    // Refresh comfortably inside the 5-minute expiry.
    refetchInterval: 4 * 60 * 1000,
    queryFn: async () =>
      (await api.post(`/tickets/${ticketId}/documents/${current!.id}/view-token`)).data.data.token as string,
  });

  const contentUrl =
    current && viewToken
      ? `${api.defaults.baseURL}/tickets/${ticketId}/documents/${current.id}/content?t=${encodeURIComponent(viewToken)}`
      : '';

  if (isLoading) return <p className="text-xs text-slate-400">Loading document…</p>;

  return (
    <div className="space-y-3">
      {!current ? (
        <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-center">
          <AlertTriangle className="mx-auto mb-1 text-amber-500" size={20} />
          <p className="text-sm font-medium">No permit uploaded</p>
          <p className="mb-3 text-xs text-slate-500">A permit document is required before this ticket can be approved.</p>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadDoc.isPending}>
            {uploadDoc.isPending ? <Loader2 className="animate-spin" size={14} /> : <UploadCloud size={14} />} Upload permit
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <FileText className="shrink-0 text-brand-500" size={20} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{current.file_name}</p>
              <p className="text-xs text-slate-500">
                v{current.version} · {(current.file_size / 1024).toFixed(0)} KB · {new Date(current.uploaded_at).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setShowPreview((s) => !s)}>
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />} {showPreview ? 'Hide' : 'View'} document
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(contentUrl, '_blank', 'noopener')}>
              <ExternalLink size={14} /> New tab
            </Button>
            <a href={contentUrl} download={current.file_name}>
              <Button size="sm" variant="outline"><Download size={14} /> Download</Button>
            </a>
            {isAdmin && current.drive_folder_url && (
              <a href={current.drive_folder_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline"><FolderOpen size={14} /> Drive folder</Button>
              </a>
            )}
            {isAdmin && (
              <>
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadDoc.isPending}>
                  {uploadDoc.isPending ? <Loader2 className="animate-spin" size={14} /> : <UploadCloud size={14} />} Replace
                </Button>
                <Button size="sm" variant="outline" onClick={() => archive.mutate()} disabled={archive.isPending}>
                  <Archive size={14} /> Archive
                </Button>
              </>
            )}
          </div>

          {showPreview && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
              {current.mime_type === 'application/pdf' ? (
                <iframe title="Permit document" src={contentUrl} className="h-[28rem] w-full" />
              ) : (
                <img src={contentUrl} alt="Permit document" className="max-h-[28rem] w-full object-contain" />
              )}
            </div>
          )}
        </>
      )}

      {history.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-500"
          >
            <History size={13} /> {history.length} previous version{history.length > 1 ? 's' : ''}
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs">
                  <Archive size={12} className="shrink-0 text-slate-400" />
                  <span className="flex-1 truncate">v{h.version} · {h.file_name}</span>
                  <span className="text-slate-400">{h.archived_at ? new Date(h.archived_at).toLocaleDateString('en-IN') : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ''; }}
      />
    </div>
  );
}

/** Renders the server-side pre-approval checklist. */
export function VerificationChecklist({ checks }: { checks: VerificationCheck[] }) {
  if (checks.length === 0) return null;
  const tone = {
    pass: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-rose-500',
  } as const;
  return (
    <div className="space-y-1">
      {checks.map((c) => (
        <div key={c.code} className="flex items-start gap-2 text-xs">
          {c.severity === 'pass' ? (
            <CheckCircle2 size={13} className={`mt-0.5 shrink-0 ${tone.pass}`} />
          ) : (
            <AlertTriangle size={13} className={`mt-0.5 shrink-0 ${tone[c.severity]}`} />
          )}
          <span className={c.severity === 'pass' ? 'text-slate-500' : tone[c.severity]}>
            <span className="font-medium">{c.label}:</span> {c.message}
          </span>
        </div>
      ))}
    </div>
  );
}
