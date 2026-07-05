import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Paperclip, Loader2, FileText, ImageIcon, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, EmptyState, Select, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  author_id: string;
  author_role: 'admin' | 'member';
  type: string;
  message: string;
  status: string;
  attachment_name: string | null;
  attachmentUrl: string | null;
  edited_at: string | null;
  created_at: string;
  author?: { full_name: string };
}

const TYPES = [
  { v: 'correction_request', l: 'Correction Request' },
  { v: 'ticket_info', l: 'Ticket Information' },
  { v: 'booking_issue', l: 'Booking Issue' },
  { v: 'cancellation_request', l: 'Cancellation Request' },
  { v: 'replacement_request', l: 'Replacement Request' },
  { v: 'general_question', l: 'General Question' },
  { v: 'other', l: 'Other' },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.v, t.l]));

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
  waiting_admin: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30',
  waiting_member: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-sky-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30',
  closed: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Open', waiting_admin: 'Waiting for Admin', waiting_member: 'Waiting for Member', resolved: 'Resolved', closed: 'Closed',
};

const MAX_BYTES = 10 * 1024 * 1024;

export function TicketComments({ ticketId, ticketLocked }: { ticketId: string; ticketLocked?: boolean }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [message, setMessage] = useState('');
  const [type, setType] = useState('correction_request');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['comments', ticketId],
    queryFn: async () => (await api.get(`/tickets/${ticketId}/comments`)).data.data as { items: Comment[]; status: string },
    refetchInterval: 20_000,
  });

  const send = useMutation({
    mutationFn: async () => {
      let attachmentPath: string | undefined;
      let attachmentName: string | undefined;
      if (file) {
        if (file.size > MAX_BYTES) throw new Error('Attachment exceeds 10 MB');
        setUploading(true);
        const up = (await api.post(`/tickets/${ticketId}/comments/upload-url`, { fileName: file.name })).data.data as { path: string; signedUrl: string };
        // Upload the file directly to Supabase Storage via the signed URL.
        const res = await fetch(up.signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } }).catch(() => null);
        if (!res || !res.ok) throw new Error('Attachment upload failed');
        attachmentPath = up.path;
        attachmentName = file.name;
        setUploading(false);
      }
      return api.post(`/tickets/${ticketId}/comments`, { type, message, attachmentPath, attachmentName });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', ticketId] });
      qc.invalidateQueries({ queryKey: ['timeline', ticketId] });
      setMessage(''); setFile(null);
      toast.success('Comment posted');
    },
    onError: (e) => { setUploading(false); toast.error(apiError(e)); },
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => api.post(`/tickets/${ticketId}/comments/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comments', ticketId] }); toast.success('Status updated'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const status = data?.status ?? 'open';

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_STYLE[status])}>
          {STATUS_LABEL[status]}
        </span>
        {isAdmin && (data?.items.length ?? 0) > 0 && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate('resolved')}><Check size={13} /> Resolve</Button>
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate('closed')}><X size={13} /> Close</Button>
          </div>
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No comments yet" hint="Start a correction request or ask a question below." />
        ) : (
          data?.items.map((c) => {
            const mine = c.author_id === user?.id;
            return (
              <div key={c.id} className={cn('flex gap-2', mine ? 'flex-row-reverse' : '')}>
                <div className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white', c.author_role === 'admin' ? 'bg-violet-600' : 'bg-brand-600')}>
                  {(c.author?.full_name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className={cn('max-w-[78%]', mine ? 'items-end text-right' : '')}>
                  <div className={cn('rounded-2xl px-3 py-2 text-sm', mine ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800')}>
                    <p className={cn('mb-0.5 text-[10px] font-semibold uppercase tracking-wide', mine ? 'text-white/70' : 'text-slate-400')}>{TYPE_LABEL[c.type] ?? c.type}</p>
                    <p className="whitespace-pre-wrap">{c.message}</p>
                    {c.attachmentUrl && (
                      <a href={c.attachmentUrl} target="_blank" rel="noreferrer" className={cn('mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs', mine ? 'bg-white/15' : 'bg-white dark:bg-slate-900')}>
                        {/\.(png|jpe?g|gif|webp)$/i.test(c.attachment_name ?? '') ? <ImageIcon size={13} /> : <FileText size={13} />}
                        <span className="truncate">{c.attachment_name}</span>
                      </a>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {c.author?.full_name} · {new Date(c.created_at).toLocaleString('en-IN')}{c.edited_at ? ' · edited' : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      {status === 'closed' ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">This conversation is closed.</p>
      ) : (
        <form
          className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800"
          onSubmit={(e) => { e.preventDefault(); if (message.trim()) send.mutate(); }}
        >
          {!isAdmin && (
            <Select value={type} onChange={(e) => setType(e.target.value)} className="h-9">
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </Select>
          )}
          {ticketLocked && !isAdmin && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">This ticket is approved & locked. Use a comment to request any change — an admin will action it.</p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={message}
              maxLength={500}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a message… (max 500 chars)"
              rows={2}
              className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900"
            />
            <div className="flex flex-col gap-1.5">
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button type="button" size="icon" variant="outline" onClick={() => fileRef.current?.click()} title="Attach JPG/PNG/PDF (max 10MB)">
                <Paperclip size={16} />
              </Button>
              <Button type="submit" size="icon" disabled={send.isPending || uploading || !message.trim()}>
                {send.isPending || uploading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              </Button>
            </div>
          </div>
          {file && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Paperclip size={12} /> {file.name}
              <button type="button" onClick={() => setFile(null)} className="text-rose-500">remove</button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
