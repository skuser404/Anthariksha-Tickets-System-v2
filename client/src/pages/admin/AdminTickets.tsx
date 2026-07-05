import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, ShieldCheck, Search, Loader2, AlertTriangle, CheckSquare, Download } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button, Card, EmptyState, Input, Select, Skeleton, StatusBadge, Tag } from '@/components/ui';
import { TicketDrawer } from '@/components/TicketDrawer';
import { exportCsv } from '@/lib/export';
import { PRESET_TAGS, STATUS_LABELS, formatDate, inr } from '@/lib/utils';

interface Flag { code: string; severity: 'warning' | 'danger'; message: string }
export interface QueueTicket {
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
  flags?: Flag[];
  member?: { full_name: string; email: string };
}

export default function AdminTicketsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('pending_verification');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<QueueTicket | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tickets', search, status],
    queryFn: async () =>
      (await api.get('/tickets', { params: { search: search || undefined, status: status || undefined, pageSize: 100 } })).data
        .data as { items: QueueTicket[]; total: number },
  });

  // Priority sort: danger-flagged first, then by trek date.
  const items = useMemo(() => {
    const rows = [...(data?.items ?? [])];
    return rows.sort((a, b) => {
      const ap = (a.flags ?? []).some((f) => f.severity === 'danger') ? 0 : 1;
      const bp = (b.flags ?? []).some((f) => f.severity === 'danger') ? 0 : 1;
      return ap - bp || a.trek_date.localeCompare(b.trek_date);
    });
  }, [data]);

  const pendingIds = items.filter((t) => t.status === 'pending_verification').map((t) => t.id);
  const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.has(id));

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pendingIds));

  const bulk = useMutation({
    mutationFn: async (decision: 'approved' | 'not_confirmed') =>
      api.post('/tickets/bulk-verify', { ids: [...selected], decision, remarks: undefined }),
    onSuccess: (res, decision) => {
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
      setSelected(new Set());
      const { succeeded, skipped } = res.data.data;
      toast.success(`${decision === 'approved' ? 'Approved' : 'Rejected'} ${succeeded}${skipped ? `, ${skipped} skipped` : ''}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const bulkTag = useMutation({
    mutationFn: async (tag: string) => api.post('/tickets/bulk-tags', { ids: [...selected], tags: [tag] }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
      toast.success(`Tagged ${res.data.data.updated} ticket(s)`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  function exportSelected() {
    const rows = items.filter((t) => selected.has(t.id));
    exportCsv({
      title: 'Tickets Export',
      columns: [
        { key: 'ticket_code', label: 'Ticket' }, { key: 'member', label: 'Member' }, { key: 'trek_name', label: 'Trek' },
        { key: 'trek_date', label: 'Trek Date', type: 'date' }, { key: 'persons', label: 'Pax', type: 'number' },
        { key: 'commission_amount', label: 'Commission', type: 'currency' }, { key: 'status', label: 'Status' },
      ],
      rows: rows.map((t) => ({ ...t, member: t.member?.full_name ?? '' })),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold">Verification Queue</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} in view · flagged tickets are prioritised</p>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
            <Input className="pl-9" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[220px]">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 px-4 py-2.5">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select className="h-8 max-w-[140px]" defaultValue="" onChange={(e) => { if (e.target.value) { bulkTag.mutate(e.target.value); e.target.value = ''; } }}>
                <option value="">Assign tag…</option>
                {PRESET_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Button size="sm" variant="outline" onClick={exportSelected}><Download size={14} /> Export</Button>
              <Button size="sm" variant="success" disabled={bulk.isPending} onClick={() => bulk.mutate('approved')}>
                {bulk.isPending ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Approve
              </Button>
              <Button size="sm" variant="danger" disabled={bulk.isPending} onClick={() => bulk.mutate('not_confirmed')}>
                <X size={14} /> Reject
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState title="Nothing to verify" hint="New submissions will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">
                    <button onClick={toggleAll} aria-label="Select all" className="grid place-items-center">
                      <CheckSquare size={16} className={allSelected ? 'text-brand-500' : 'text-slate-400'} />
                    </button>
                  </th>
                  <th className="px-2 py-2">Ticket</th>
                  <th className="px-2 py-2">Member</th>
                  <th className="px-2 py-2">Trek date</th>
                  <th className="px-2 py-2">Pax</th>
                  <th className="px-2 py-2">Commission</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((t) => {
                  const danger = (t.flags ?? []).some((f) => f.severity === 'danger');
                  const isPending = t.status === 'pending_verification';
                  return (
                    <tr key={t.id} className={`cursor-pointer transition hover:bg-white/5 ${selected.has(t.id) ? 'bg-brand-500/5' : ''}`} onClick={() => setDrawer(t)}>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        {isPending && <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-1.5 font-medium">
                          {danger && <AlertTriangle size={14} className="text-rose-500" />} {t.ticket_code}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="text-xs text-slate-500">{t.trek_name}</span>
                          {(t.tags ?? []).filter((x) => x !== 'pending').slice(0, 3).map((tag) => <Tag key={tag} label={tag} />)}
                        </div>
                      </td>
                      <td className="px-2 py-3"><p>{t.member?.full_name ?? '—'}</p><p className="text-xs text-slate-500">{t.member?.email}</p></td>
                      <td className="px-2 py-3 text-slate-500">{formatDate(t.trek_date)}</td>
                      <td className="px-2 py-3">{t.persons}</td>
                      <td className="px-2 py-3 font-semibold text-emerald-500">{inr(t.commission_amount)}</td>
                      <td className="px-2 py-3"><StatusBadge status={t.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <TicketDrawer ticket={drawer} onClose={() => setDrawer(null)} onVerified={() => setDrawer(null)} />
    </div>
  );
}
