import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Calculator, Info, CalendarCheck, UploadCloud, FileText, X } from 'lucide-react';
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
  district?: string | null;
  booking_instructions?: string | null;
}
interface Member { id: string; full_name: string; email: string }
interface TrekDate {
  id: string;
  trek_id: string;
  trek_date: string;
  status: 'available' | 'full' | 'closed';
  max_persons: number | null;
  notes: string | null;
}

const COMMISSION_PER_PERSON = 50;
const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 10 * 1024 * 1024;

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
  const [permit, setPermit] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (!f) return setPermit(null);
    if (!ACCEPTED.includes(f.type)) {
      toast.error('Please upload a PDF, JPG or PNG.');
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error('File is too large (max 10 MB).');
      return;
    }
    setPermit(f);
  }
  const [form, setForm] = useState({
    memberId: '',
    ticketCode: '',
    bookingEmail: '',
    bookingAccountName: '',
    bookingDate: '',
    trekDate: '',
    trekId: '',
    persons: 1,
    remarks: '',
  });

  const selectedTrek = useMemo(() => treks?.find((t) => t.id === form.trekId), [treks, form.trekId]);
  const permitTotal = (selectedTrek?.permit_price ?? 0) * form.persons;
  const commission = COMMISSION_PER_PERSON * form.persons;

  // Dates the admin has opened for this trek. Members choose from these only —
  // there is no free calendar, and the API re-checks the choice on submit.
  const { data: trekDates, isLoading: datesLoading } = useQuery({
    queryKey: ['trek-dates', form.trekId],
    enabled: !!form.trekId,
    queryFn: async () =>
      (await api.get('/treks/dates', { params: { trekId: form.trekId } })).data.data as TrekDate[],
  });

  // Admin-configured cap on the persons dropdown.
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data.data as Record<string, unknown>,
  });
  const maxPersons = Math.min(20, Math.max(1, Number(settings?.max_persons_per_ticket ?? 10)));

  const today = new Date().toISOString().slice(0, 10);
  // Only future, open dates are offered.
  const openDates = useMemo(
    () => (trekDates ?? []).filter((d) => d.status === 'available' && d.trek_date >= today),
    [trekDates, today],
  );

  // Availability: how many people are already booked on each offered date.
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
      if (!permit) throw new Error('Please attach the permit document (PDF, JPG or PNG)');

      const res = await api.post('/tickets', {
        memberId: isAdmin ? form.memberId : undefined,
        ticketCode: form.ticketCode.trim(),
        trekId: selectedTrek.id,
        trekName: selectedTrek.name,
        bookingEmail: form.bookingEmail.trim(),
        bookingAccountName: form.bookingAccountName.trim() || undefined,
        bookingDate: form.bookingDate,
        trekDate: form.trekDate,
        persons: form.persons,
        remarks: form.remarks || undefined,
      });

      // The ticket exists now; push the permit to Google Drive against its id.
      // If this fails the ticket survives and the permit can be re-attached
      // from the ticket page, so the member never loses their data entry.
      const ticketId = res.data.data.id as string;
      const body = new FormData();
      body.append('file', permit);
      setUploading(true);
      try {
        await api.post(`/tickets/${ticketId}/documents`, body);
      } catch (err) {
        throw new Error(
          `Ticket ${form.ticketCode} was saved, but the permit upload failed: ${apiError(err)} — open the ticket to attach it again.`,
        );
      } finally {
        setUploading(false);
      }
      return res;
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
              <Label>Booking Account Name *</Label>
              <Input
                required
                value={form.bookingAccountName}
                onChange={set('bookingAccountName')}
                placeholder="Name the permit was booked under"
              />
            </div>
            <div>
              <Label>Booking Date *</Label>
              <Input required type="date" value={form.bookingDate} onChange={set('bookingDate')} max={today} />
              <p className="mt-1 text-xs text-slate-500">The date you booked on the official site.</p>
            </div>
            <div>
              <Label>Trek *</Label>
              <Select
                required
                value={form.trekId}
                onChange={(e) => setForm((f) => ({ ...f, trekId: e.target.value, trekDate: '' }))}
              >
                <option value="">Select a trek…</option>
                {treks?.filter((t) => t.is_active).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.district ? ` (${t.district})` : ''} — {inr(t.permit_price)}/person
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Trek Date *</Label>
              <Select required value={form.trekDate} onChange={set('trekDate')} disabled={!form.trekId || datesLoading}>
                <option value="">
                  {!form.trekId ? 'Select a trek first…' : datesLoading ? 'Loading dates…' : 'Select a date…'}
                </option>
                {openDates.map((d) => (
                  <option key={d.id} value={d.trek_date}>
                    {formatDate(d.trek_date)}
                    {d.notes ? ` — ${d.notes}` : ''}
                  </option>
                ))}
              </Select>
              {form.trekId && !datesLoading && openDates.length === 0 && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  No dates are currently open for this trek. Check back later or contact an admin.
                </p>
              )}
            </div>
            <div>
              <Label>Persons *</Label>
              <Select required value={form.persons} onChange={set('persons')}>
                {Array.from({ length: maxPersons }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
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

          {/* Permit document — uploaded to Google Drive on submit */}
          <div>
            <Label>Permit document *</Label>
            {permit ? (
              <div className="flex items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
                <FileText className="shrink-0 text-brand-500" size={20} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{permit.name}</p>
                  <p className="text-xs text-slate-500">{(permit.size / 1024).toFixed(0)} KB · {permit.type.split('/')[1].toUpperCase()}</p>
                </div>
                <button
                  type="button"
                  aria-label="Remove file"
                  onClick={() => { setPermit(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-rose-500"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0] ?? null); }}
                className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-brand-500 hover:bg-brand-500/5 dark:border-slate-700"
              >
                <UploadCloud className="text-brand-500" size={26} />
                <span className="text-sm font-medium">Click to upload or drag your permit here</span>
                <span className="text-xs text-slate-500">PDF, JPG or PNG · max 10 MB</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Stored securely in Google Drive under {form.trekDate ? formatDate(form.trekDate) : 'the trek date'} → {selectedTrek?.name ?? 'trek'} → your name.
            </p>
          </div>

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
            <Button type="submit" disabled={mutation.isPending || !permit}>
              {mutation.isPending && <Loader2 className="animate-spin" size={16} />}
              {uploading ? 'Uploading permit…' : 'Submit Ticket'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
