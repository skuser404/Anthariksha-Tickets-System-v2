import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, EmptyState, Input, Skeleton } from '@/components/ui';

interface Log {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  ip_address: string | null;
  created_at: string;
  actor?: { full_name: string; email: string } | null;
}

const actionTone = (action: string) => {
  if (action.includes('approve') || action.includes('activate') || action.includes('complete')) return 'text-emerald-500';
  if (action.includes('reject') || action.includes('cancel') || action.includes('deactivate')) return 'text-rose-500';
  if (action.includes('payment') || action.includes('refund')) return 'text-violet-500';
  return 'text-slate-400';
};

export default function AuditLogsPage() {
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', action],
    queryFn: async () => (await api.get('/audit', { params: { action: action || undefined } })).data.data as { items: Log[]; total: number },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ScrollText className="text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-slate-500">Append-only record of every sensitive action. {data?.total ?? 0} entries.</p>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
          <Input className="pl-9" placeholder="Filter by action (e.g. payment, approve)…" value={action} onChange={(e) => setAction(e.target.value)} />
        </div>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No audit entries" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Entity</th>
                  <th className="px-2 py-2">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((l) => (
                  <tr key={l.id} className="hover:bg-white/5">
                    <td className="px-2 py-2.5 text-slate-500">{new Date(l.created_at).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-2.5">{l.actor?.full_name ?? 'System'}</td>
                    <td className={`px-2 py-2.5 font-medium ${actionTone(l.action)}`}>{l.action}</td>
                    <td className="px-2 py-2.5 text-slate-500">{l.entity}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ''}</td>
                    <td className="px-2 py-2.5 font-mono text-xs text-slate-500">{l.ip_address ?? '—'}</td>
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
