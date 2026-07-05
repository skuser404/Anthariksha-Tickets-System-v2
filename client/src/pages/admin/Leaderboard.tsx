import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Mountain, Target, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle, EmptyState, Skeleton } from '@/components/ui';
import { inr } from '@/lib/utils';

interface Member {
  memberId: string; name: string; total: number; approved: number; rejected: number; cancelled: number;
  earned: number; balance: number; approvalRate: number; avgPersons: number; refundRatio: number;
}
interface LB { members: Member[]; topEarners: Member[]; topApproved: Member[]; bestApprovalRate: Member[]; mostActive: Member[]; }
interface Trek { trek: string; persons: number; revenue: number; tickets: number; }

const medal = (i: number) => (i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-500');

function MiniBoard({ title, icon: Icon, rows, render }: { title: string; icon: typeof Trophy; rows: Member[]; render: (m: Member) => string }) {
  return (
    <Card className="space-y-3">
      <CardTitle className="flex items-center gap-2"><Icon size={15} /> {title}</CardTitle>
      {rows.length === 0 ? <EmptyState title="No data" /> : (
        <ol className="space-y-2">
          {rows.map((m, i) => (
            <li key={m.memberId} className="flex items-center gap-3">
              <Medal size={16} className={medal(i)} />
              <span className="flex-1 truncate text-sm font-medium">{m.name}</span>
              <span className="text-sm font-semibold text-brand-500">{render(m)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default function LeaderboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['leaderboard'], queryFn: async () => (await api.get('/intel/leaderboard')).data.data as LB });
  const { data: treks } = useQuery({ queryKey: ['top-treks'], queryFn: async () => (await api.get('/intel/top-treks')).data.data as Trek[] });

  if (isLoading || !data) {
    return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-sm text-slate-500">Member performance & rankings.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniBoard title="Top Earners" icon={Trophy} rows={data.topEarners} render={(m) => inr(m.earned)} />
        <MiniBoard title="Most Approved" icon={Medal} rows={data.topApproved} render={(m) => `${m.approved}`} />
        <MiniBoard title="Best Approval Rate" icon={Target} rows={data.bestApprovalRate} render={(m) => `${m.approvalRate}%`} />
        <MiniBoard title="Most Active" icon={Activity} rows={data.mostActive} render={(m) => `${m.total}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-3 lg:col-span-2">
          <CardTitle>All members</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Member</th>
                  <th className="px-2 py-2">Tickets</th>
                  <th className="px-2 py-2">Approved</th>
                  <th className="px-2 py-2">Approval %</th>
                  <th className="px-2 py-2">Avg pax</th>
                  <th className="px-2 py-2">Refund %</th>
                  <th className="px-2 py-2 text-right">Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.members.map((m) => (
                  <tr key={m.memberId} className="hover:bg-white/5">
                    <td className="px-2 py-2.5 font-medium">{m.name}</td>
                    <td className="px-2 py-2.5">{m.total}</td>
                    <td className="px-2 py-2.5">{m.approved}</td>
                    <td className="px-2 py-2.5">{m.approvalRate}%</td>
                    <td className="px-2 py-2.5">{m.avgPersons}</td>
                    <td className="px-2 py-2.5">{m.refundRatio}%</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-emerald-500">{inr(m.earned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="space-y-3">
          <CardTitle className="flex items-center gap-2"><Mountain size={15} /> Top treks</CardTitle>
          <ol className="space-y-2">
            {(treks ?? []).slice(0, 8).map((t, i) => (
              <li key={t.trek} className="flex items-center gap-3">
                <Medal size={16} className={medal(i)} />
                <span className="flex-1 truncate text-sm font-medium">{t.trek}</span>
                <span className="text-sm font-semibold text-brand-500">{inr(t.revenue)}</span>
              </li>
            ))}
            {(treks?.length ?? 0) === 0 && <EmptyState title="No approved tickets yet" />}
          </ol>
        </Card>
      </div>
    </div>
  );
}
