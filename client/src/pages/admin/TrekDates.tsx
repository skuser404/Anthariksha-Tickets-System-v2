import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, Plus, Trash2, Mountain, Loader2, MapPin, Users, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button, Card, CardTitle, EmptyState, Input, Label, Select, Skeleton, Textarea } from '@/components/ui';
import { formatDate, inr } from '@/lib/utils';

interface Trek {
  id: string;
  name: string;
  permit_price: number;
  is_active: boolean;
  district: string | null;
  description: string | null;
}

interface TrekDate {
  id: string;
  trek_id: string;
  trek_date: string;
  status: 'available' | 'full' | 'closed';
  max_persons: number | null;
  notes: string | null;
  trek?: { id: string; name: string };
}

const STATUS_TONE: Record<TrekDate['status'], string> = {
  available: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
  full: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
  closed: 'bg-slate-500/10 text-slate-500 ring-slate-500/20',
};

export default function TrekDatesPage() {
  const qc = useQueryClient();
  const [trekForm, setTrekForm] = useState({ name: '', district: '', permitPrice: '', description: '' });
  const [showTrekForm, setShowTrekForm] = useState(false);
  const [dateForm, setDateForm] = useState({ trekId: '', trekDate: '', maxPersons: '', notes: '' });

  const { data: treks, isLoading: treksLoading } = useQuery({
    queryKey: ['treks'],
    queryFn: async () => (await api.get('/treks')).data.data as Trek[],
  });

  const { data: dates, isLoading: datesLoading } = useQuery({
    queryKey: ['trek-dates', 'all'],
    queryFn: async () => (await api.get('/treks/dates')).data.data as TrekDate[],
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['trek-dates'] });
    qc.invalidateQueries({ queryKey: ['treks'] });
  };

  const createTrek = useMutation({
    mutationFn: async () =>
      api.post('/treks', {
        name: trekForm.name.trim(),
        district: trekForm.district.trim() || undefined,
        permitPrice: Number(trekForm.permitPrice),
        description: trekForm.description.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setTrekForm({ name: '', district: '', permitPrice: '', description: '' });
      setShowTrekForm(false);
      toast.success('Trek added');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const toggleTrek = useMutation({
    mutationFn: async (t: Trek) => api.patch(`/treks/${t.id}`, { isActive: !t.is_active }),
    onSuccess: () => { invalidate(); toast.success('Trek updated'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const addDate = useMutation({
    mutationFn: async () =>
      api.post('/treks/dates', {
        trekId: dateForm.trekId,
        trekDate: dateForm.trekDate,
        maxPersons: dateForm.maxPersons ? Number(dateForm.maxPersons) : null,
        notes: dateForm.notes.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setDateForm((f) => ({ ...f, trekDate: '', maxPersons: '', notes: '' }));
      toast.success('Date opened for booking');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: TrekDate['status'] }) =>
      api.patch(`/treks/dates/${v.id}`, { status: v.status }),
    onSuccess: () => { invalidate(); toast.success('Date updated'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const removeDate = useMutation({
    mutationFn: async (id: string) => api.delete(`/treks/dates/${id}`),
    onSuccess: () => { invalidate(); toast.success('Date removed — members can no longer book it'); },
    onError: (e) => toast.error(apiError(e)),
  });

  // Group dates by trek so an admin reads one departure list per trek.
  const grouped = useMemo(() => {
    const map = new Map<string, TrekDate[]>();
    for (const d of dates ?? []) {
      const list = map.get(d.trek_id) ?? [];
      list.push(d);
      map.set(d.trek_id, list);
    }
    return map;
  }, [dates]);

  const activeTreks = (treks ?? []).filter((t) => t.is_active);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Treks &amp; Dates</h1>
          <p className="text-sm text-slate-500">
            Members can only book the treks and dates you open here.
          </p>
        </div>
        <Button onClick={() => setShowTrekForm((s) => !s)}>
          <Plus size={16} /> Add trek
        </Button>
      </div>

      {showTrekForm && (
        <Card>
          <CardTitle>New trek</CardTitle>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => { e.preventDefault(); createTrek.mutate(); }}
          >
            <div>
              <Label>Trek name *</Label>
              <Input required value={trekForm.name} onChange={(e) => setTrekForm((f) => ({ ...f, name: e.target.value }))} placeholder="Kudremukh" />
            </div>
            <div>
              <Label>District</Label>
              <Input value={trekForm.district} onChange={(e) => setTrekForm((f) => ({ ...f, district: e.target.value }))} placeholder="Chikkamagaluru" />
            </div>
            <div>
              <Label>Permit price per person *</Label>
              <Input required type="number" min={0} step="1" value={trekForm.permitPrice} onChange={(e) => setTrekForm((f) => ({ ...f, permitPrice: e.target.value }))} placeholder="575" />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea rows={2} value={trekForm.description} onChange={(e) => setTrekForm((f) => ({ ...f, description: e.target.value }))} placeholder="Shown to members on the booking form." />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={createTrek.isPending}>
                {createTrek.isPending && <Loader2 className="animate-spin" size={16} />} Save trek
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowTrekForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Open a date */}
      <Card>
        <CardTitle>Open a date for booking</CardTitle>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => { e.preventDefault(); addDate.mutate(); }}
        >
          <div className="sm:col-span-2">
            <Label>Trek *</Label>
            <Select required value={dateForm.trekId} onChange={(e) => setDateForm((f) => ({ ...f, trekId: e.target.value }))}>
              <option value="">Select a trek…</option>
              {activeTreks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Date *</Label>
            <Input required type="date" value={dateForm.trekDate} onChange={(e) => setDateForm((f) => ({ ...f, trekDate: e.target.value }))} />
          </div>
          <div>
            <Label>Max persons</Label>
            <Input type="number" min={1} value={dateForm.maxPersons} onChange={(e) => setDateForm((f) => ({ ...f, maxPersons: e.target.value }))} placeholder="No limit" />
          </div>
          <div className="sm:col-span-3">
            <Label>Note (shown to members)</Label>
            <Input value={dateForm.notes} onChange={(e) => setDateForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional — e.g. 'Weekend batch'" />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={addDate.isPending || !dateForm.trekId || !dateForm.trekDate}>
              {addDate.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Open
            </Button>
          </div>
        </form>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <Info size={13} className="mt-0.5 shrink-0" />
          Members see only these dates. Removing one stops new bookings; tickets already
          submitted for it are kept.
        </p>
      </Card>

      {/* Per-trek departures */}
      {treksLoading || datesLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : (treks?.length ?? 0) === 0 ? (
        <EmptyState icon={<Mountain className="text-slate-400" />} title="No treks yet" hint="Add a trek to start opening dates." />
      ) : (
        <div className="space-y-4">
          {treks!.map((t) => {
            const list = (grouped.get(t.id) ?? []).sort((a, b) => a.trek_date.localeCompare(b.trek_date));
            return (
              <Card key={t.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Mountain size={18} className="text-brand-500" />
                      <h2 className="font-semibold">{t.name}</h2>
                      {!t.is_active && (
                        <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] text-slate-500">Inactive</span>
                      )}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {t.district && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {t.district}</span>}
                      <span>{inr(t.permit_price)}/person</span>
                      <span>{list.length} date{list.length === 1 ? '' : 's'} open</span>
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => toggleTrek.mutate(t)}>
                    {t.is_active ? 'Disable' : 'Enable'}
                  </Button>
                </div>

                {list.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">No dates configured — members cannot book this trek yet.</p>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    {list.map((d) => (
                      <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm">
                        <CalendarDays size={14} className="shrink-0 text-slate-400" />
                        <span className="font-medium">{formatDate(d.trek_date)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] capitalize ring-1 ring-inset ${STATUS_TONE[d.status]}`}>
                          {d.status}
                        </span>
                        {d.max_persons !== null && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Users size={11} /> max {d.max_persons}
                          </span>
                        )}
                        {d.notes && <span className="text-xs text-slate-500">· {d.notes}</span>}
                        <div className="ml-auto flex items-center gap-1.5">
                          <Select
                            className="h-8 w-28 text-xs"
                            value={d.status}
                            onChange={(e) => setStatus.mutate({ id: d.id, status: e.target.value as TrekDate['status'] })}
                          >
                            <option value="available">Available</option>
                            <option value="full">Full</option>
                            <option value="closed">Closed</option>
                          </Select>
                          <button
                            type="button"
                            aria-label={`Remove ${d.trek_date}`}
                            onClick={() => removeDate.mutate(d.id)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
