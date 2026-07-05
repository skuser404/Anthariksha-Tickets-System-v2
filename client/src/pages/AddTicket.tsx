import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Calculator, Info, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, Input, Label, Select, Textarea } from '@/components/ui';
import { Confetti } from '@/components/ui/Confetti';
import { cn, formatDate, inr } from '@/lib/utils';

interface Trek {
  id: string;
  name: string;
  permit_price: number;
  is_active: boolean;
}
interface Member { id: string; full_name: string; email: string }

const COMMISSION_PER_PERSON = 50;

export default function AddTicketPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: treks } = useQuery({
    queryKey: ['treks'],
    queryFn: async () => (await api.get('/treks')).data.data as Trek[],
  });

  // Admins can assign the ticket to a member (booked using the member's account).
  const { data: members } = useQuery({
    queryKey: ['members'],
    enabled: isAdmin,
    queryFn: async () => (await api.get('/users/members')).data.data as Member[],
  });

  const [celebrate, setCelebrate] = useState(false);
  const [form, setForm] = useState({
    memberId: '',
    ticketCode: '',
    bookingEmail: '',
    bookingDate: '',
    trekDate: '',
    trekId: '',
    persons: 1,
    remarks: '',
  });

  const selectedTrek = useMemo(() => treks?.find((t) => t.id === form.trekId), [treks, form.trekId]);
  const permitTotal = (selectedTrek?.permit_price ?? 0) * form.persons;
  const commission = COMMISSION_PER_PERSON * form.persons;

  // Availability: upcoming booked dates for the chosen trek.
  const { data: availability } = useQuery({
    queryKey: ['availability', selectedTrek?.name],
    enabled: !!selectedTrek,
    queryFn: async () =>
      (await api.get('/tickets/availability', { params: { trek: selectedTrek!.name } })).data.data as { date: string; persons: number; count: number }[],
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'persons' ? Number(e.target.value) : e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedTrek) throw new Error('Please select a trek');
      if (isAdmin && !form.memberId) throw new Error('Please select the member this ticket belongs to');
      return api.post('/tickets', {
        memberId: isAdmin ? form.memberId : undefined,
        ticketCode: form.ticketCode.trim(),
        trekId: selectedTrek.id,
        trekName: selectedTrek.name,
        bookingEmail: form.bookingEmail.trim(),
        bookingDate: form.bookingDate,
        trekDate: form.trekDate,
        persons: form.persons,
        remarks: form.remarks || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
      qc.invalidateQueries({ queryKey: ['member-stats'] });
      setCelebrate(true);
      toast.success(isAdmin ? 'Ticket added to the member’s account 🎉' : 'Ticket submitted for verification 🎉');
      setTimeout(() => navigate(isAdmin ? '/admin/tickets' : '/tickets'), 1600);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {celebrate && <Confetti />}
      <div>
        <h1 className="text-2xl font-bold">Add Ticket</h1>
        <p className="text-sm text-slate-500">
          {isAdmin
            ? 'Add a permit on behalf of a member — it goes to their account so they can see it.'
            : 'Submit a permit you already booked on the Aranya Vihara website.'}
        </p>
      </div>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-5"
        >
          {isAdmin && (
            <div>
              <Label>Assign to member *</Label>
              <Select required value={form.memberId} onChange={set('memberId')}>
                <option value="">Select a member…</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} — {m.email}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-slate-500">
                The ticket is recorded under this member's account and they're notified.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Ticket ID *</Label>
              <Input required value={form.ticketCode} onChange={set('ticketCode')} placeholder="AV-100231" />
            </div>
            <div>
              <Label>Booking Email *</Label>
              <Input required type="email" value={form.bookingEmail} onChange={set('bookingEmail')} placeholder="bookings@aranyavihara.test" />
            </div>
            <div>
              <Label>Booking Date *</Label>
              <Input required type="date" value={form.bookingDate} onChange={set('bookingDate')} />
            </div>
            <div>
              <Label>Trek Date *</Label>
              <Input required type="date" value={form.trekDate} onChange={set('trekDate')} />
            </div>
            <div>
              <Label>Trek *</Label>
              <Select required value={form.trekId} onChange={set('trekId')}>
                <option value="">Select a trek…</option>
                {treks?.filter((t) => t.is_active).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {inr(t.permit_price)}/person
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Persons *</Label>
              <Input required type="number" min={1} max={100} value={form.persons} onChange={set('persons')} />
            </div>
          </div>

          {/* Trek availability — upcoming booked dates */}
          {selectedTrek && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <CalendarCheck size={16} className="text-brand-500" /> {selectedTrek.name} — upcoming booked dates
              </div>
              {(availability?.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-500">No upcoming bookings for this trek yet — all dates are open.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availability!.map((a) => (
                    <span
                      key={a.date}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ring-1 ring-inset',
                        a.date === form.trekDate
                          ? 'bg-brand-500/15 text-brand-600 ring-brand-500/30 dark:text-brand-400'
                          : 'bg-white text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700',
                      )}
                    >
                      {formatDate(a.date)} · {a.persons} pax
                    </span>
                  ))}
                </div>
              )}
              {form.trekDate && availability?.some((a) => a.date === form.trekDate) && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Heads up: {selectedTrek.name} already has bookings on {formatDate(form.trekDate)}.
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Remarks</Label>
            <Textarea rows={2} value={form.remarks} onChange={set('remarks')} placeholder="Optional notes…" />
          </div>

          {/* Live calculation panel */}
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-500">
              <Calculator size={16} /> Auto Calculation
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Permit / person</p>
                <p className="font-semibold">{inr(selectedTrek?.permit_price ?? 0)}</p>
              </div>
              <div>
                <p className="text-slate-500">Permit total</p>
                <p className="font-semibold">{inr(permitTotal)}</p>
              </div>
              <div>
                <p className="text-slate-500">Your commission</p>
                <p className="font-semibold text-emerald-500">{inr(commission)}</p>
              </div>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <Info size={12} /> Commission is ₹{COMMISSION_PER_PERSON} per person and is credited once an admin approves the ticket.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/tickets')}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" size={16} />} Submit Ticket
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
