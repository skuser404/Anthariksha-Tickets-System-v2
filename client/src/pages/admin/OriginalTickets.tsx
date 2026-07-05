import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button, Card, CardTitle, EmptyState, Input, Label, Skeleton, StatusBadge } from '@/components/ui';
import { formatDate, inr } from '@/lib/utils';

interface Original {
  id: string;
  ticket_code: string;
  booking_email: string;
  booking_date: string;
  trek_date: string;
  persons: number;
  permit_price: number;
  status: string;
  remarks: string | null;
}

const empty = { ticketCode: '', bookingEmail: '', bookingDate: '', trekDate: '', persons: 1, permitPrice: 500, remarks: '' };

export default function OriginalTicketsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  const { data, isLoading } = useQuery({
    queryKey: ['originals'],
    queryFn: async () => (await api.get('/registers/originals')).data.data as Original[],
  });

  const create = useMutation({
    mutationFn: async () =>
      api.post('/registers/originals', {
        ticketCode: form.ticketCode.trim(),
        bookingEmail: form.bookingEmail.trim(),
        bookingDate: form.bookingDate,
        trekDate: form.trekDate,
        persons: Number(form.persons),
        permitPrice: Number(form.permitPrice),
        remarks: form.remarks || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['originals'] });
      setForm(empty);
      toast.success('Original ticket recorded');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Archive className="text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">Original Tickets</h1>
          <p className="text-sm text-slate-500">Reference register of the official Aranya Vihara bookings.</p>
        </div>
      </div>

      <Card>
        <CardTitle className="mb-3">Add original ticket</CardTitle>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div><Label>Ticket ID *</Label><Input required value={form.ticketCode} onChange={set('ticketCode')} /></div>
          <div><Label>Booking Email *</Label><Input required type="email" value={form.bookingEmail} onChange={set('bookingEmail')} /></div>
          <div><Label>Persons *</Label><Input required type="number" min={1} value={form.persons} onChange={set('persons')} /></div>
          <div><Label>Booking Date *</Label><Input required type="date" value={form.bookingDate} onChange={set('bookingDate')} /></div>
          <div><Label>Trek Date *</Label><Input required type="date" value={form.trekDate} onChange={set('trekDate')} /></div>
          <div><Label>Permit Price *</Label><Input required type="number" min={0} value={form.permitPrice} onChange={set('permitPrice')} /></div>
          <div className="sm:col-span-2 lg:col-span-2"><Label>Remarks</Label><Input value={form.remarks} onChange={set('remarks')} /></div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Add
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Register</CardTitle>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState title="No original tickets yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Ticket</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Booking</th>
                  <th className="px-2 py-2">Trek date</th>
                  <th className="px-2 py-2">Pax</th>
                  <th className="px-2 py-2 text-right">Permit</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.map((o) => (
                  <tr key={o.id} className="hover:bg-white/5">
                    <td className="px-2 py-2.5 font-medium">{o.ticket_code}</td>
                    <td className="px-2 py-2.5 text-slate-500">{o.booking_email}</td>
                    <td className="px-2 py-2.5 text-slate-500">{formatDate(o.booking_date)}</td>
                    <td className="px-2 py-2.5 text-slate-500">{formatDate(o.trek_date)}</td>
                    <td className="px-2 py-2.5">{o.persons}</td>
                    <td className="px-2 py-2.5 text-right">{inr(Number(o.permit_price) * o.persons)}</td>
                    <td className="px-2 py-2.5"><StatusBadge status={o.status} /></td>
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
