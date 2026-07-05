import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Ticket, Users, Receipt, BadgeIndianRupee, TrendingUp, Timer, Percent, Ban, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, Input, Label, Select, Skeleton, StatCard } from '@/components/ui';
import { STATUS_LABELS, inr } from '@/lib/utils';

interface Member { id: string; full_name: string }
interface Trek { id: string; name: string }
interface Result { tickets: number; persons: number; permitCost: number; commission: number; netProfit: number }

export default function AnalyticsPage() {
  const [filters, setFilters] = useState({ from: '', to: '', trek: '', status: '', memberId: '' });
  const [applied, setApplied] = useState(filters);

  const { data: members } = useQuery({ queryKey: ['members'], queryFn: async () => (await api.get('/users/members')).data.data as Member[] });
  const { data: treks } = useQuery({ queryKey: ['treks'], queryFn: async () => (await api.get('/treks')).data.data as Trek[] });
  const { data: ops } = useQuery({
    queryKey: ['ops-metrics'],
    queryFn: async () => (await api.get('/analytics/operations')).data.data as { approvalPct: number; cancellationRatio: number; avgVerificationHours: number; avgRefundDays: number },
  });

  const { data, isFetching } = useQuery({
    queryKey: ['analytics', applied],
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(applied).filter(([, v]) => v));
      return (await api.get('/analytics', { params })).data.data as Result;
    },
  });

  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  const cards = [
    { label: 'Tickets', value: data?.tickets ?? 0, icon: Ticket, tone: 'text-brand-500' },
    { label: 'Persons', value: data?.persons ?? 0, icon: Users, tone: 'text-sky-500' },
    { label: 'Permit Cost', value: inr(data?.permitCost), icon: Receipt, tone: 'text-amber-500' },
    { label: 'Commission', value: inr(data?.commission), icon: BadgeIndianRupee, tone: 'text-emerald-500' },
    { label: 'Net Profit', value: inr(data?.netProfit), icon: TrendingUp, tone: 'text-violet-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="text-brand-500" />
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-slate-500">Filter tickets by date, trek, status or member.</p>
        </div>
      </div>

      {/* Operational KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Approval %" count={ops?.approvalPct ?? 0} format={(n) => `${n}%`} icon={Percent} tone="text-emerald-500" />
        <StatCard label="Cancellation Ratio" count={ops?.cancellationRatio ?? 0} format={(n) => `${n}%`} icon={Ban} tone="text-rose-500" />
        <StatCard label="Avg Verification" count={ops?.avgVerificationHours ?? 0} format={(n) => `${n}h`} icon={Timer} tone="text-amber-500" />
        <StatCard label="Avg Refund Time" count={ops?.avgRefundDays ?? 0} format={(n) => `${n}d`} icon={Clock} tone="text-sky-500" />
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div>
            <Label>From (trek date)</Label>
            <Input type="date" value={filters.from} onChange={set('from')} />
          </div>
          <div>
            <Label>To (trek date)</Label>
            <Input type="date" value={filters.to} onChange={set('to')} />
          </div>
          <div>
            <Label>Trek</Label>
            <Select value={filters.trek} onChange={set('trek')}>
              <option value="">All treks</option>
              {treks?.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={filters.status} onChange={set('status')}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </div>
          <div>
            <Label>Member</Label>
            <Select value={filters.memberId} onChange={set('memberId')}>
              <option value="">All members</option>
              {members?.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </Select>
          </div>
          <Button onClick={() => setApplied(filters)}>Apply filters</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {isFetching && !data
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : cards.map((c) => (
              <Card key={c.label} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{c.label}</span>
                  <c.icon className={c.tone} size={18} />
                </div>
                <span className="text-2xl font-bold tracking-tight">{c.value}</span>
              </Card>
            ))}
      </div>
      <p className="text-xs text-slate-500">Permit cost, commission and profit reflect approved tickets in the selected scope.</p>
    </div>
  );
}
