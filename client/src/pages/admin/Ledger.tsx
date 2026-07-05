import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookLock, Plus, Loader2, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button, Card, CardTitle, EmptyState, Input, Label, Select, Skeleton, StatCard } from '@/components/ui';
import { inr } from '@/lib/utils';

interface Entry {
  id: string;
  type: string;
  flow: 'in' | 'out' | 'liability';
  amount: number;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  member?: { full_name: string } | null;
  creator?: { full_name: string } | null;
}
interface LedgerResp {
  items: Entry[];
  total: number;
  totals: Record<string, number>;
  inflow: number;
  outflow: number;
  net: number;
}

const TYPE_LABELS: Record<string, string> = {
  commission_earned: 'Commission Earned',
  commission_paid: 'Commission Paid',
  refund_expected: 'Refund Expected',
  refund_received: 'Refund Received',
  permit_cost: 'Permit Cost',
  manual_adjustment: 'Manual Adjustment',
};

const flowStyle = (flow: string) =>
  flow === 'in' ? 'text-emerald-500' : flow === 'out' ? 'text-rose-500' : 'text-amber-500';

export default function LedgerPage() {
  const qc = useQueryClient();
  const [type, setType] = useState('');
  const [showAdj, setShowAdj] = useState(false);
  const [adj, setAdj] = useState({ amount: '', flow: 'out', notes: '', referenceNumber: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['ledger', type],
    queryFn: async () => (await api.get('/ledger', { params: { type: type || undefined } })).data.data as LedgerResp,
  });

  const adjust = useMutation({
    mutationFn: async () => api.post('/ledger/adjustment', { amount: Number(adj.amount), flow: adj.flow, notes: adj.notes, referenceNumber: adj.referenceNumber || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] });
      setAdj({ amount: '', flow: 'out', notes: '', referenceNumber: '' });
      setShowAdj(false);
      toast.success('Adjustment posted to the ledger');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookLock className="text-violet-400" />
          <div>
            <h1 className="text-2xl font-bold">Financial Ledger</h1>
            <p className="text-sm text-slate-500">Append-only · every financial event is recorded permanently.</p>
          </div>
        </div>
        <Button onClick={() => setShowAdj((s) => !s)}><Plus size={16} /> Manual adjustment</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Total Inflow" count={data?.inflow ?? 0} format={inr} icon={ArrowDownLeft} tone="text-emerald-500" />
        <StatCard label="Total Outflow" count={data?.outflow ?? 0} format={inr} icon={ArrowUpRight} tone="text-rose-500" />
        <StatCard label="Net Position" count={data?.net ?? 0} format={inr} icon={Scale} tone="text-violet-500" />
      </div>

      {showAdj && (
        <Card>
          <CardTitle className="mb-3">Manual adjustment</CardTitle>
          <form className="grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); adjust.mutate(); }}>
            <div><Label>Amount (₹)</Label><Input required type="number" min={1} value={adj.amount} onChange={(e) => setAdj((a) => ({ ...a, amount: e.target.value }))} /></div>
            <div><Label>Direction</Label><Select value={adj.flow} onChange={(e) => setAdj((a) => ({ ...a, flow: e.target.value }))}><option value="out">Outflow</option><option value="in">Inflow</option></Select></div>
            <div><Label>Reference</Label><Input value={adj.referenceNumber} onChange={(e) => setAdj((a) => ({ ...a, referenceNumber: e.target.value }))} /></div>
            <div><Label>Notes *</Label><Input required value={adj.notes} onChange={(e) => setAdj((a) => ({ ...a, notes: e.target.value }))} /></div>
            <div className="sm:col-span-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAdj(false)}>Cancel</Button>
              <Button type="submit" disabled={adjust.isPending}>{adjust.isPending && <Loader2 className="animate-spin" size={16} />} Post entry</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle>Ledger entries</CardTitle>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="max-w-[220px]">
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No ledger entries yet" hint="Approvals, payments and refunds post here automatically." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Member</th>
                  <th className="px-2 py-2">Reference</th>
                  <th className="px-2 py-2">Notes</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((e) => (
                  <tr key={e.id} className="hover:bg-white/5">
                    <td className="px-2 py-2.5 text-slate-500">{new Date(e.created_at).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-2.5">{TYPE_LABELS[e.type] ?? e.type}</td>
                    <td className="px-2 py-2.5">{e.member?.full_name ?? '—'}</td>
                    <td className="px-2 py-2.5 font-mono text-xs text-slate-500">{e.reference_number ?? '—'}</td>
                    <td className="px-2 py-2.5 text-slate-500">{e.notes ?? '—'}</td>
                    <td className={`px-2 py-2.5 text-right font-semibold ${flowStyle(e.flow)}`}>
                      {e.flow === 'out' ? '−' : e.flow === 'in' ? '+' : ''}{inr(e.amount)}
                    </td>
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
