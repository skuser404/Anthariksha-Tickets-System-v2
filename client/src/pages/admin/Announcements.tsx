import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Trash2, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button, Card, CardTitle, EmptyState, Input, Label, Select, Skeleton, Textarea } from '@/components/ui';

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'important';
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  author?: { full_name: string };
}

const blank = {
  title: '',
  message: '',
  priority: 'normal' as 'normal' | 'important',
  startsAt: '',
  endsAt: '',
};

/** `datetime-local` value -> ISO, or null when left blank. */
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['announcements-admin'],
    queryFn: async () => (await api.get('/announcements')).data.data as Announcement[],
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['announcements-admin'] });
    qc.invalidateQueries({ queryKey: ['announcements-active'] });
  };

  const create = useMutation({
    mutationFn: async () =>
      api.post('/announcements', {
        title: form.title.trim(),
        message: form.message.trim(),
        priority: form.priority,
        startsAt: toIso(form.startsAt),
        endsAt: toIso(form.endsAt),
      }),
    onSuccess: () => { invalidate(); setForm(blank); setShowForm(false); toast.success('Announcement published'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const toggle = useMutation({
    mutationFn: async (a: Announcement) => api.patch(`/announcements/${a.id}`, { isActive: !a.is_active }),
    onSuccess: () => { invalidate(); toast.success('Announcement updated'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => { invalidate(); toast.success('Announcement deleted'); },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-sm text-slate-500">Shown as a notice on every member's dashboard.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}><Plus size={16} /> New announcement</Button>
      </div>

      {showForm && (
        <Card>
          <CardTitle>New announcement</CardTitle>
          <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label>Title *</Label>
                <Input required maxLength={160} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Upload the original permit document" />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as 'normal' | 'important' }))}>
                  <option value="normal">Normal</option>
                  <option value="important">Important</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea required rows={3} maxLength={4000} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Make sure the Ticket ID and trek date are clearly visible in the document you upload." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Show from</Label>
                <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
                <p className="mt-1 text-xs text-slate-500">Leave blank to show immediately.</p>
              </div>
              <div>
                <Label>Show until</Label>
                <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
                <p className="mt-1 text-xs text-slate-500">Leave blank to show until you disable it.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="animate-spin" size={16} />} Publish
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState icon={<Megaphone className="text-slate-400" />} title="No announcements" hint="Publish a notice to show it on member dashboards." />
      ) : (
        <div className="space-y-2">
          {data!.map((a) => (
            <Card key={a.id} className={a.is_active ? '' : 'opacity-60'}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.priority === 'important' && <AlertTriangle size={15} className="shrink-0 text-amber-500" />}
                    <p className="font-semibold">{a.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset ${a.is_active ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-500 ring-slate-500/20'}`}>
                      {a.is_active ? 'Live' : 'Hidden'}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{a.message}</p>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {a.author?.full_name ?? 'Admin'} · {new Date(a.created_at).toLocaleString('en-IN')}
                    {a.starts_at && ` · from ${new Date(a.starts_at).toLocaleDateString('en-IN')}`}
                    {a.ends_at && ` · until ${new Date(a.ends_at).toLocaleDateString('en-IN')}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => toggle.mutate(a)}>
                    {a.is_active ? <EyeOff size={14} /> : <Eye size={14} />} {a.is_active ? 'Hide' : 'Show'}
                  </Button>
                  <button
                    type="button"
                    aria-label={`Delete ${a.title}`}
                    onClick={() => remove.mutate(a.id)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
