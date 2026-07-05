import { useQuery } from '@tanstack/react-query';
import { Wallet, BadgeIndianRupee, Scale } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle, EmptyState, Skeleton } from '@/components/ui';
import { formatDate, inr } from '@/lib/utils';

interface Ledger {
  totalEarned: number;
  totalPaid: number;
  balance: number;
  payments: { id: string; amount: number; payment_date: string; method: string; reference_number: string | null; receipt_no: string }[];
}

export default function EarningsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-ledger'],
    queryFn: async () => (await api.get('/payments/ledger')).data.data as Ledger,
  });

  const cards = [
    { label: 'Total Earned', value: inr(data?.totalEarned), icon: BadgeIndianRupee, tone: 'text-emerald-500' },
    { label: 'Total Paid', value: inr(data?.totalPaid), icon: Wallet, tone: 'text-teal-500' },
    { label: 'Current Balance', value: inr(data?.balance), icon: Scale, tone: 'text-violet-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Earnings</h1>
        <p className="text-sm text-slate-500">Commission earned and payments received.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{c.label}</span>
              <c.icon className={c.tone} size={18} />
            </div>
            <span className="text-2xl font-bold tracking-tight">{isLoading ? '…' : c.value}</span>
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        <CardTitle>Payment history</CardTitle>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.payments.length ?? 0) === 0 ? (
          <EmptyState title="No payments yet" hint="Payments from the admin will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Receipt</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Method</th>
                  <th className="px-2 py-2">Reference</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5">
                    <td className="px-2 py-2.5 font-mono text-xs">{p.receipt_no}</td>
                    <td className="px-2 py-2.5 text-slate-500">{formatDate(p.payment_date)}</td>
                    <td className="px-2 py-2.5 capitalize">{p.method.replace('_', ' ')}</td>
                    <td className="px-2 py-2.5 text-slate-500">{p.reference_number ?? '—'}</td>
                    <td className="px-2 py-2.5 text-right font-semibold">{inr(p.amount)}</td>
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
