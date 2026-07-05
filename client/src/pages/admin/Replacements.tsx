import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Repeat, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button, Card, CardTitle, EmptyState, Input, Label, Select, Skeleton } from '@/components/ui';
import { formatDate, inr } from '@/lib/utils';
import type { TicketRow } from '../Tickets';

interface Replacement {
  id: string;
  old_ticket_code: string;
  new_ticket_code: string;
  booking_email: string;
  replacement_date: string;
  persons: number;
  permit_cost: number;
  remarks: string | null;
  old_ticket?: { trek_name: string; member?: { full_name: string } };
}

export default function ReplacementsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ oldTicketId: '', oldTicketCode: '', newTicketCode: '', bookingEmail: '', replacementDate: new Date().toISOString().slice(0, 10), persons: 1, permitCost: 500, remarks: '' });

  const { data: tickets } = useQuery({
    queryKey: ['approved-tickets'],
    queryFn: async () => (await api.get('/tickets', { params: { status: 'approved', pageSize: 100 } })).data.data as { items: TicketRow[] },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['replacements'],
    queryFn: async () => (await api.get('/registers/replacements')).data.data as Replacement[],
  });

  // Auto-fill from the selected old ticket.
  useEffect(() => {
    const t = tickets?.items.find((x) => x.id === form.oldTicketId);
    if (t) {
      setForm((f) => ({
        ...f,
        oldTicketCode: t.ticket_code,
        bookingEmail: t.booking_email,
        persons: t.persons,
        permitCost: Number(t.permit_price) * t.persons,
      }));
    }
  }, [form.oldTicketId, tickets]);

  const create = useMutation({
    mutationFn: async () =>
      api.post('/registers/replacements', {
        oldTicketId: form.oldTicketId || undefined,
        oldTicketCode: form.oldTicketCode.trim(),
        newTicketCode: form.newTicketCode.trim(),
        bookingEmail: form.bookingEmail.trim(),
        replacementDate: form.replacementDate,
        persons: Number(form.persons),
        permitCost: Number(form.permitCost),
        remarks: form.remarks || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['replacements'] });
      qc.invalidateQueries({ queryKey: ['approved-tickets'] });
      setForm((f) => ({ ...f, oldTicketId: '', oldTicketCode: '', newTicketCode: '', remarks: '' }));
      toast.success('Replacement recorded');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Repeat className="text-violet-500" />
        <div>
          <h1 className="text-2xl font-bold">Replacement Tickets</h1>
          <p className="text-sm text-slate-500">Record a replacement for an existing ticket.</p>
        </div>
      </div>

      <Card>
        <CardTitle className="mb-3">New replacement</CardTitle>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="lg:col-span-2">
            <Label>Old ticket (approved)</Label>
            <Select value={form.oldTicketId} onChange={set('oldTicketId')}>
              <option value="">Select or enter code manually…</option>
              {tickets?.items.map((t) => <option key={t.id} value={t.id}>{t.ticket_code} — {t.trek_name}</option>)}
            </Select>
          </div>
          <div><Label>Old Ticket Code *</Label><Input required value={form.oldTicketCode} onChange={set('oldTicketCode')} /></div>
          <div><Label>New Ticket Code *</Label><Input required value={form.newTicketCode} onChange={set('newTicketCode')} /></div>
          <div><Label>Booking Email *</Label><Input required type="email" value={form.bookingEmail} onChange={set('bookingEmail')} /></div>
          <div><Label>Replacement Date *</Label><Input required type="date" value={form.replacementDate} onChange={set('replacementDate')} /></div>
          <div><Label>Persons *</Label><Input required type="number" min={1} value={form.persons} onChange={set('persons')} /></div>
          <div><Label>Permit Cost *</Label><Input required type="number" min={0} value={form.permitCost} onChange={set('permitCost')} /></div>
          <div className="sm:col-span-2"><Label>Remarks</Label><Input value={form.remarks} onChange={set('remarks')} /></div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Record
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Replacement history</CardTitle>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState title="No replacements yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Old → New</th>
                  <th className="px-2 py-2">Member</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Pax</th>
                  <th className="px-2 py-2 text-right">Permit cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="px-2 py-2.5 font-medium">{r.old_ticket_code} <span className="text-slate-400">→</span> {r.new_ticket_code}</td>
                    <td className="px-2 py-2.5">{r.old_ticket?.member?.full_name ?? '—'}</td>
                    <td className="px-2 py-2.5 text-slate-500">{formatDate(r.replacement_date)}</td>
                    <td className="px-2 py-2.5">{r.persons}</td>
                    <td className="px-2 py-2.5 text-right">{inr(r.permit_cost)}</td>
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
