import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertTriangle, Tag as TagIcon, StickyNote, Plus, Loader2, Check, Ban, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Tag, StatusBadge, Textarea, Label } from '@/components/ui';
import { Timeline, type TimelineStep } from '@/components/Timeline';
import { TicketComments } from '@/components/TicketComments';
import { TicketDocument, VerificationChecklist, type VerificationCheck } from '@/components/TicketDocument';
import { PRESET_TAGS, formatDate, inr } from '@/lib/utils';

interface TicketLite {
  id: string;
  ticket_code: string;
  trek_name: string;
  booking_email: string;
  booking_date: string;
  trek_date: string;
  persons: number;
  permit_price: number;
  commission_amount: number;
  status: string;
  tags?: string[];
  flags?: { code: string; severity: 'warning' | 'danger'; message: string }[];
  member?: { full_name: string; email: string };
}

export function TicketDrawer({ ticket, onClose, onVerified }: { ticket: TicketLite | null; onClose: () => void; onVerified?: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [decision, setDecision] = useState<'approved' | 'not_confirmed' | null>(null);
  const [reason, setReason] = useState('');
  const [checks, setChecks] = useState<{ checks: VerificationCheck[]; blocking: number }>({ checks: [], blocking: 0 });

  const id = ticket?.id;

  const { data: timeline } = useQuery({
    enabled: !!id,
    queryKey: ['timeline', id],
    queryFn: async () => (await api.get(`/tickets/${id}/timeline`)).data.data as { steps: TimelineStep[] },
  });

  const { data: notes } = useQuery({
    enabled: !!id && isAdmin,
    queryKey: ['notes', id],
    queryFn: async () => (await api.get(`/tickets/${id}/notes`)).data.data as { id: string; body: string; created_at: string; author?: { full_name: string } }[],
  });

  const addNote = useMutation({
    mutationFn: async () => api.post(`/tickets/${id}/notes`, { body: note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes', id] }); setNote(''); },
    onError: (e) => toast.error(apiError(e)),
  });

  const saveTags = useMutation({
    mutationFn: async (tags: string[]) => api.put(`/tickets/${id}/tags`, { tags }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tickets'] }); toast.success('Tags updated'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const verify = useMutation({
    mutationFn: async (v: { decision: 'approved' | 'not_confirmed'; remarks?: string; override?: boolean }) =>
      api.post(`/tickets/${id}/verify`, v),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
      qc.invalidateQueries({ queryKey: ['timeline', id] });
      qc.invalidateQueries({ queryKey: ['verification-checks', id] });
      toast.success(v.decision === 'approved' ? 'Ticket approved — commission credited' : 'Ticket rejected');
      setDecision(null);
      setReason('');
      onVerified?.();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const tags = ticket?.tags ?? [];
  const addTag = (t: string) => { if (t && !tags.includes(t)) saveTags.mutate([...tags, t]); };
  const removeTag = (t: string) => saveTags.mutate(tags.filter((x) => x !== t));

  return (
    <AnimatePresence>
      {ticket && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={onClose}>
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-white/80 p-5 backdrop-blur-xl dark:bg-slate-900/80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">{ticket.ticket_code}</h2>
                <p className="text-sm text-slate-500">{ticket.trek_name} · {ticket.persons} pax</p>
              </div>
              <button onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>

            <div className="mb-4 flex items-center gap-2"><StatusBadge status={ticket.status} /></div>

            {/* Flags */}
            {(ticket.flags?.length ?? 0) > 0 && (
              <div className="mb-4 space-y-1.5">
                {ticket.flags!.map((f, i) => (
                  <div key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${f.severity === 'danger' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {f.message}
                  </div>
                ))}
              </div>
            )}

            {/* Details */}
            <div className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 p-4 text-sm">
              <Detail label="Member" value={ticket.member?.full_name ?? '—'} />
              <Detail label="Booking email" value={ticket.booking_email} />
              <Detail label="Booking date" value={formatDate(ticket.booking_date)} />
              <Detail label="Trek date" value={formatDate(ticket.trek_date)} />
              <Detail label="Permit total" value={inr(Number(ticket.permit_price) * ticket.persons)} />
              <Detail label="Commission" value={inr(ticket.commission_amount)} />
            </div>

            {/* Permit document (Google Drive) */}
            <div className="mb-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <FileCheck size={13} /> Permit document
              </p>
              <TicketDocument ticketId={ticket.id} onChecks={setChecks} />
            </div>

            {/* Pre-approval checklist (admin) */}
            {isAdmin && checks.checks.length > 0 && (
              <div className="mb-5 rounded-2xl border border-white/10 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-500">Verification checklist</p>
                <VerificationChecklist checks={checks.checks} />
              </div>
            )}

            {/* Verify actions */}
            {isAdmin && ticket.status === 'pending_verification' && (
              <div className="mb-5 space-y-2">
                {decision === null ? (
                  <div className="flex gap-2">
                    <Button variant="success" className="flex-1" onClick={() => setDecision('approved')}>
                      <Check size={16} /> Approve
                    </Button>
                    <Button variant="danger" className="flex-1" onClick={() => setDecision('not_confirmed')}>
                      <Ban size={16} /> Reject
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-2xl border border-white/10 p-3">
                    <Label>
                      {decision === 'approved'
                        ? checks.blocking > 0
                          ? `Override ${checks.blocking} failed check(s) — justification required`
                          : 'Approval note (optional)'
                        : 'Rejection reason (required) *'}
                    </Label>
                    <Textarea
                      rows={3}
                      autoFocus
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={decision === 'approved' ? 'Why this is safe to approve…' : 'e.g. The permit PDF is for a different trek date.'}
                    />
                    {decision === 'approved' && checks.blocking > 0 && (
                      <p className="flex items-start gap-1.5 text-xs text-rose-500">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        {checks.blocking} blocking check(s) failed. Approving anyway is recorded in the audit log.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant={decision === 'approved' ? 'success' : 'danger'}
                        className="flex-1"
                        disabled={
                          verify.isPending ||
                          (decision === 'not_confirmed' && !reason.trim()) ||
                          (decision === 'approved' && checks.blocking > 0 && !reason.trim())
                        }
                        onClick={() =>
                          verify.mutate({
                            decision,
                            remarks: reason.trim() || undefined,
                            override: decision === 'approved' && checks.blocking > 0,
                          })
                        }
                      >
                        {verify.isPending ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                        Confirm {decision === 'approved' ? 'approval' : 'rejection'}
                      </Button>
                      <Button variant="outline" onClick={() => { setDecision(null); setReason(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tags (admin) */}
            {isAdmin && (
              <div className="mb-5">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><TagIcon size={13} /> Tags</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((t) => <Tag key={t} label={t} onRemove={() => removeTag(t)} />)}
                  {tags.length === 0 && <span className="text-xs text-slate-400">No tags</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESET_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                    <button key={t} onClick={() => addTag(t)} className="rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[11px] capitalize text-slate-500 hover:border-brand-500 hover:text-brand-500">+ {t}</button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="custom tag" className="h-8 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-xs outline-none" />
                  <Button size="sm" variant="outline" onClick={() => { addTag(newTag.toLowerCase().trim()); setNewTag(''); }}><Plus size={13} /></Button>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="mb-5">
              <p className="mb-3 text-xs font-semibold text-slate-500">Lifecycle</p>
              {timeline ? <Timeline steps={timeline.steps} /> : <p className="text-xs text-slate-400">Loading…</p>}
            </div>

            {/* Comments / correction requests */}
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold text-slate-500">Comments</p>
              <div className="h-80 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <TicketComments ticketId={ticket.id} />
              </div>
            </div>

            {/* Admin notes */}
            {isAdmin && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><StickyNote size={13} /> Private notes</p>
                <div className="flex gap-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a private note…" className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-sm outline-none" onKeyDown={(e) => e.key === 'Enter' && note && addNote.mutate()} />
                  <Button size="sm" disabled={!note || addNote.isPending} onClick={() => addNote.mutate()}>{addNote.isPending ? <Loader2 className="animate-spin" size={14} /> : 'Add'}</Button>
                </div>
                <div className="mt-3 space-y-2">
                  {notes?.map((n) => (
                    <div key={n.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                      <p>{n.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{n.author?.full_name ?? 'Admin'} · {new Date(n.created_at).toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                  {(notes?.length ?? 0) === 0 && <p className="text-xs text-slate-400">No notes yet.</p>}
                </div>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
