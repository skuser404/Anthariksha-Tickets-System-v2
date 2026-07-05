import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, PiggyBank, CalendarClock, CheckCircle2, Ban, Loader2, Info, Hourglass } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardTitle, EmptyState, Input, Label, Select, Skeleton } from '@/components/ui';
import { formatDate, inr } from '@/lib/utils';
import type { TicketRow } from './Tickets';

interface RefundRow {
  id: string;
  cancellation_date: string;
  days_before_trek: number;
  refund_percent: number;
  refund_amount: number;
  expected_refund_date: string;
  received_date: string | null;
  status: 'pending' | 'processing' | 'completed';
  ticket?: { ticket_code: string; trek_name: string; member?: { full_name: string } };
}
interface RefundResponse {
  items: RefundRow[];
  summary: { refundPending: number; refundCompleted: number; refundValue: number; refundExpected: number; refundReceived: number };
}

export default function RefundsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['refunds'],
    queryFn: async () => (await api.get('/refunds')).data.data as RefundResponse,
  });

  const s = data?.summary;
  const cards = [
    { label: 'Refund Pending', value: s?.refundPending ?? 0, icon: RotateCcw, tone: 'text-sky-500' },
    { label: 'Refund Completed', value: s?.refundCompleted ?? 0, icon: CheckCircle2, tone: 'text-teal-500' },
    { label: 'Refund Value', value: inr(s?.refundValue), icon: PiggyBank, tone: 'text-violet-500' },
    { label: 'Refund Expected', value: inr(s?.refundExpected), icon: CalendarClock, tone: 'text-amber-500' },
    { label: 'Refund Received', value: inr(s?.refundReceived), icon: CheckCircle2, tone: 'text-emerald-500' },
  ];

  const complete = useMutation({
    mutationFn: async (id: string) => api.post(`/refunds/${id}/complete`, { receivedDate: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refunds'] });
      toast.success('Refund marked as received');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const processing = useMutation({
    mutationFn: async (id: string) => api.post(`/refunds/${id}/processing`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refunds'] });
      toast.success('Refund marked as processing');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <RotateCcw className="text-sky-500" />
        <div>
          <h1 className="text-2xl font-bold">Refunds</h1>
          <p className="text-sm text-slate-500">Cancellations and refund tracking — recorded manually.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        Refund amounts are calculated for record-keeping only. No money is moved by this app — the
        official booking source issues refunds; admins update the status (Pending → Processing → Completed) manually.
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <c.icon className={c.tone} size={18} />
            </div>
            <span className="text-2xl font-bold tracking-tight">{c.value}</span>
          </Card>
        ))}
      </div>

      {isAdmin && <CancelTicketCard />}

      <Card className="space-y-3">
        <CardTitle>Refund timeline</CardTitle>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No refunds yet" hint="Refunds appear here after a ticket is cancelled." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Ticket</th>
                  {isAdmin && <th className="px-2 py-2">Member</th>}
                  <th className="px-2 py-2">Cancelled</th>
                  <th className="px-2 py-2">Days before</th>
                  <th className="px-2 py-2">%</th>
                  <th className="px-2 py-2 text-right">Refund</th>
                  <th className="px-2 py-2">Expected</th>
                  <th className="px-2 py-2">Status</th>
                  {isAdmin && <th className="px-2 py-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="px-2 py-2.5 font-medium">{r.ticket?.ticket_code}<p className="text-xs text-slate-500">{r.ticket?.trek_name}</p></td>
                    {isAdmin && <td className="px-2 py-2.5">{r.ticket?.member?.full_name}</td>}
                    <td className="px-2 py-2.5 text-slate-500">{formatDate(r.cancellation_date)}</td>
                    <td className="px-2 py-2.5">{r.days_before_trek}</td>
                    <td className="px-2 py-2.5">{r.refund_percent}%</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-violet-500">{inr(r.refund_amount)}</td>
                    <td className="px-2 py-2.5 text-slate-500">{formatDate(r.expected_refund_date)}</td>
                    <td className="px-2 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
                        r.status === 'completed' ? 'bg-teal-500/15 text-teal-500 ring-teal-500/30'
                        : r.status === 'processing' ? 'bg-amber-500/15 text-amber-500 ring-amber-500/30'
                        : 'bg-sky-500/15 text-sky-500 ring-sky-500/30'}`}>
                        {r.status === 'completed' ? `Received ${formatDate(r.received_date)}` : r.status === 'processing' ? 'Processing' : 'Pending'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          {r.status === 'pending' && r.refund_amount > 0 && (
                            <Button size="sm" variant="outline" disabled={processing.isPending} onClick={() => processing.mutate(r.id)}>
                              <Hourglass size={13} /> Processing
                            </Button>
                          )}
                          {r.status !== 'completed' && r.refund_amount > 0 ? (
                            <Button size="sm" variant="success" disabled={complete.isPending} onClick={() => complete.mutate(r.id)}>
                              {complete.isPending ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Received
                            </Button>
                          ) : r.status === 'completed' ? <span className="text-xs text-slate-400">—</span> : <span className="text-xs text-slate-400">—</span>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Admin: cancel an approved/pending ticket and auto-calculate the refund. */
function CancelTicketCard() {
  const qc = useQueryClient();
  const [ticketId, setTicketId] = useState('');
  const [cancellationDate, setCancellationDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<{ permitTotal: number; percent: number; amount: number; daysBefore: number; expectedRefundDate: string } | null>(null);

  const { data: tickets } = useQuery({
    queryKey: ['cancelable-tickets'],
    queryFn: async () =>
      (await api.get('/tickets', { params: { status: 'approved', pageSize: 100 } })).data.data as { items: TicketRow[] },
  });

  useEffect(() => {
    if (!ticketId || !cancellationDate) {
      setPreview(null);
      return;
    }
    let active = true;
    api
      .get('/refunds/preview', { params: { ticketId, cancellationDate } })
      .then((r) => active && setPreview(r.data.data))
      .catch(() => active && setPreview(null));
    return () => {
      active = false;
    };
  }, [ticketId, cancellationDate]);

  const cancel = useMutation({
    mutationFn: async () => api.post('/refunds/cancel', { ticketId, cancellationDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refunds'] });
      qc.invalidateQueries({ queryKey: ['cancelable-tickets'] });
      toast.success('Ticket cancelled & refund calculated');
      setTicketId('');
      setPreview(null);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Card className="space-y-4">
      <CardTitle className="flex items-center gap-2"><Ban size={15} /> Cancel a ticket</CardTitle>
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end">
        <div>
          <Label>Approved ticket *</Label>
          <Select value={ticketId} onChange={(e) => setTicketId(e.target.value)}>
            <option value="">Select ticket…</option>
            {tickets?.items.map((t) => (
              <option key={t.id} value={t.id}>{t.ticket_code} — {t.trek_name} ({t.persons} pax)</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Cancellation date *</Label>
          <Input type="date" value={cancellationDate} onChange={(e) => setCancellationDate(e.target.value)} />
        </div>
        <Button disabled={!ticketId || cancel.isPending} onClick={() => cancel.mutate()}>
          {cancel.isPending ? <Loader2 className="animate-spin" size={16} /> : <Ban size={16} />} Cancel
        </Button>
      </div>

      {preview && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-sm sm:grid-cols-4">
          <div><p className="text-slate-500">Permit total</p><p className="font-semibold">{inr(preview.permitTotal)}</p></div>
          <div><p className="text-slate-500">Days before trek</p><p className="font-semibold">{preview.daysBefore}</p></div>
          <div><p className="text-slate-500">Refund %</p><p className="font-semibold">{preview.percent}%</p></div>
          <div><p className="text-slate-500">Refund amount</p><p className="font-semibold text-violet-500">{inr(preview.amount)}</p></div>
          <div className="col-span-2 sm:col-span-4 text-xs text-slate-500">
            Expected refund by <span className="font-medium">{formatDate(preview.expectedRefundDate)}</span> (cancellation + 30 days).
            Policy: ≥7 days = 100%, 4–6 days = 50%, &lt;4 days = 0%.
          </div>
        </div>
      )}
    </Card>
  );
}
