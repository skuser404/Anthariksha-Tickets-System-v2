import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, Save, Loader2, Download, PlayCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError, tokenStore } from '@/lib/api';
import { Button, Card, CardTitle, Input, Label, Skeleton } from '@/components/ui';

interface SettingsMap {
  commission_per_person?: number;
  refund_window?: { full_days: number; half_days: number; refund_lead_days: number };
  org?: { name: string; booking_site: string };
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data.data as SettingsMap,
  });

  const [commission, setCommission] = useState(50);
  const [refund, setRefund] = useState({ full_days: 7, half_days: 4, refund_lead_days: 30 });
  const [org, setOrg] = useState({ name: '', booking_site: '' });

  useEffect(() => {
    if (!data) return;
    if (data.commission_per_person !== undefined) setCommission(Number(data.commission_per_person));
    if (data.refund_window) setRefund(data.refund_window);
    if (data.org) setOrg(data.org);
  }, [data]);

  const save = useMutation({
    mutationFn: async (payload: { key: string; value: unknown }) => api.put('/settings', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const runChecks = useMutation({
    mutationFn: async () => api.post('/intel/run-checks'),
    onSuccess: (res) => {
      const c = res.data.data.checks as Record<string, number>;
      toast.success(`Checks complete · ${c.pending_over_24h} stale, ${c.refunds_due_soon} due soon, ${c.refunds_overdue} overdue`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  async function exportDb() {
    try {
      const res = await fetch('/api/intel/export', { headers: { Authorization: `Bearer ${tokenStore.access}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `antariksha-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Database snapshot downloaded');
    } catch (e) {
      toast.error(apiError(e));
    }
  }

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-slate-500">System configuration. New values apply to future records only.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <CardTitle>Commission</CardTitle>
          <div>
            <Label>Commission per person (₹)</Label>
            <Input type="number" min={0} value={commission} onChange={(e) => setCommission(Number(e.target.value))} />
            <p className="mt-1 text-xs text-slate-500">Default ₹50. Applied to newly submitted tickets.</p>
          </div>
          <Button onClick={() => save.mutate({ key: 'commission_per_person', value: commission })} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save
          </Button>
        </Card>

        <Card className="space-y-4">
          <CardTitle>Refund rules</CardTitle>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>100% if ≥ days</Label><Input type="number" min={0} value={refund.full_days} onChange={(e) => setRefund((r) => ({ ...r, full_days: Number(e.target.value) }))} /></div>
            <div><Label>50% if ≥ days</Label><Input type="number" min={0} value={refund.half_days} onChange={(e) => setRefund((r) => ({ ...r, half_days: Number(e.target.value) }))} /></div>
            <div><Label>Refund lead days</Label><Input type="number" min={0} value={refund.refund_lead_days} onChange={(e) => setRefund((r) => ({ ...r, refund_lead_days: Number(e.target.value) }))} /></div>
          </div>
          <Button onClick={() => save.mutate({ key: 'refund_window', value: refund })} disabled={save.isPending}>
            <Save size={16} /> Save
          </Button>
        </Card>

        <Card className="space-y-4">
          <CardTitle>Organisation</CardTitle>
          <div><Label>System name</Label><Input value={org.name} onChange={(e) => setOrg((o) => ({ ...o, name: e.target.value }))} /></div>
          <div><Label>Booking site</Label><Input value={org.booking_site} onChange={(e) => setOrg((o) => ({ ...o, booking_site: e.target.value }))} /></div>
          <Button onClick={() => save.mutate({ key: 'org', value: org })} disabled={save.isPending}>
            <Save size={16} /> Save
          </Button>
        </Card>

        <Card className="space-y-3">
          <CardTitle>Backups & automation</CardTitle>
          <p className="text-sm text-slate-500">
            Enable <span className="font-medium">daily automatic backups</span> in Supabase
            (Project Settings → Database → Backups). Use a manual export below for an on-demand snapshot.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportDb}><Download size={15} /> Export database (JSON)</Button>
            <Button variant="outline" onClick={() => runChecks.mutate()} disabled={runChecks.isPending}>
              {runChecks.isPending ? <Loader2 className="animate-spin" size={15} /> : <PlayCircle size={15} />} Run smart checks now
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck size={12} /> Trek-price and refund-rule changes never alter historical tickets (each stores a snapshot).
          </p>
        </Card>
      </div>
    </div>
  );
}
