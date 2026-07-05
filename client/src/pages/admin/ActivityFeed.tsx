import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Activity, Ticket, Wallet, RotateCcw, Repeat, Settings, ShieldCheck, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, EmptyState, Skeleton } from '@/components/ui';

interface Item { id: string; actor: string; text: string; action: string; entity: string; at: string; }

const iconFor = (action: string) => {
  if (action.startsWith('ticket')) return Ticket;
  if (action.startsWith('payment') || action.startsWith('ledger')) return Wallet;
  if (action.startsWith('refund')) return RotateCcw;
  if (action.startsWith('replacement')) return Repeat;
  if (action.startsWith('member')) return UserPlus;
  if (action.startsWith('settings') || action.startsWith('trek')) return Settings;
  return ShieldCheck;
};

const groupOf = (iso: string) => {
  const d = new Date(iso); const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, yest)) return 'Yesterday';
  if (now.getTime() - d.getTime() < 7 * 86400000) return 'This Week';
  return 'Earlier';
};

export default function ActivityFeedPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: async () => (await api.get('/intel/activity')).data.data as Item[],
    refetchInterval: 30_000,
  });

  const groups = ['Today', 'Yesterday', 'This Week', 'Earlier'];
  const byGroup = (g: string) => (data ?? []).filter((i) => groupOf(i.at) === g);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="text-brand-500" />
        <div>
          <h1 className="text-2xl font-bold">Activity Feed</h1>
          <p className="text-sm text-slate-500">Live operational timeline from the audit log.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const rows = byGroup(g);
            if (rows.length === 0) return null;
            return (
              <div key={g}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{g}</p>
                <Card className="divide-y divide-white/5 p-0">
                  {rows.map((i, idx) => {
                    const Icon = iconFor(i.action);
                    return (
                      <motion.div key={i.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }} className="flex items-center gap-3 px-4 py-3">
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500/10 text-brand-500"><Icon size={15} /></span>
                        <div className="flex-1">
                          <p className="text-sm"><span className="font-medium">{i.actor}</span> {i.text}</p>
                          <p className="text-[11px] text-slate-400">{new Date(i.at).toLocaleString('en-IN')}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
