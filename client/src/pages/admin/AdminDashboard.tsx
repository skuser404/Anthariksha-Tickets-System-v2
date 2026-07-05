import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Ticket, Users, Receipt, BadgeIndianRupee, RotateCcw, TrendingUp, Wallet,
  Clock, PiggyBank, ShieldCheck, UserCheck, Ban, Repeat, CalendarDays,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { Card, CardTitle, Skeleton, StatCard } from '@/components/ui';
import { DashboardHero } from '@/components/DashboardHero';
import { inr } from '@/lib/utils';

interface AdminData {
  cards: Record<string, number>;
  charts: {
    dailyTrend: { date: string; tickets: number; persons: number }[];
    monthly: { month: string; revenue: number; commission: number }[];
    mostBookedTrek: { trek: string; persons: number }[];
  };
}

const tip = (v: number) => inr(v);
const darkTip = { borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff' };

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await api.get('/dashboard/admin')).data.data as AdminData,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const c = data.cards;
  const inrCards = (arr: { label: string; count: number; icon: typeof Ticket; tone: string; currency?: boolean }[]) => arr;
  const today = inrCards([
    { label: "Today's Tickets", count: c.todaysTickets, icon: Ticket, tone: 'text-brand-500' },
    { label: "Today's Persons", count: c.todaysPersons, icon: Users, tone: 'text-sky-500' },
    { label: "Today's Permit Cost", count: c.todaysPermitCost, currency: true, icon: Receipt, tone: 'text-amber-500' },
    { label: "Today's Commission", count: c.todaysCommission, currency: true, icon: BadgeIndianRupee, tone: 'text-emerald-500' },
    { label: "Today's Refund", count: c.todaysRefundAmount, currency: true, icon: RotateCcw, tone: 'text-rose-500' },
    { label: "Today's Revenue", count: c.todaysRevenue, currency: true, icon: TrendingUp, tone: 'text-teal-500' },
    { label: "Today's Expenses", count: c.todaysExpenses, currency: true, icon: Wallet, tone: 'text-orange-500' },
    { label: 'Net Profit', count: c.netProfit, currency: true, icon: TrendingUp, tone: 'text-emerald-500' },
  ]);
  const ops = inrCards([
    { label: 'Monthly Revenue', count: c.monthlyRevenue, currency: true, icon: TrendingUp, tone: 'text-brand-500' },
    { label: 'Pending Verifications', count: c.pendingVerifications, icon: Clock, tone: 'text-amber-500' },
    { label: 'Pending Refunds', count: c.pendingRefunds, icon: RotateCcw, tone: 'text-sky-500' },
    { label: 'Pending Payments', count: c.pendingPayments, icon: PiggyBank, tone: 'text-violet-500' },
    { label: 'Total Members', count: c.totalMembers, icon: Users, tone: 'text-sky-500' },
    { label: 'Active Members', count: c.activeMembers, icon: UserCheck, tone: 'text-emerald-500' },
    { label: 'Total Tickets', count: c.totalTickets, icon: Ticket, tone: 'text-brand-500' },
    { label: 'Cancelled Tickets', count: c.cancelledTickets, icon: Ban, tone: 'text-rose-500' },
    { label: 'Replacement Tickets', count: c.replacementTickets, icon: Repeat, tone: 'text-violet-500' },
  ]);

  return (
    <div className="space-y-6">
      <DashboardHero />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-500"><CalendarDays size={15} /> Today</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
          {today.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <StatCard label={card.label} count={card.count} format={card.currency ? inr : undefined} icon={card.icon} tone={card.tone} />
            </motion.div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500">Operations</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {ops.map((card) => (
            <StatCard key={card.label} label={card.label} count={card.count} format={card.currency ? inr : undefined} icon={card.icon} tone={card.tone} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <CardTitle className="flex items-center gap-2"><TrendingUp size={15} /> Daily ticket trend (30 days)</CardTitle>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.charts.dailyTrend}>
              <defs>
                <linearGradient id="t" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3479ff" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#3479ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip contentStyle={darkTip} />
              <Area type="monotone" dataKey="tickets" stroke="#3479ff" fill="url(#t)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="space-y-4">
          <CardTitle className="flex items-center gap-2"><TrendingUp size={15} /> Monthly revenue & commission</CardTitle>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.charts.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip formatter={tip} contentStyle={darkTip} />
              <Bar dataKey="revenue" name="Revenue" fill="#3479ff" radius={[6, 6, 0, 0]} />
              <Bar dataKey="commission" name="Commission" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <CardTitle className="flex items-center gap-2"><Users size={15} /> Most booked treks (by persons)</CardTitle>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.charts.mostBookedTrek} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
              <YAxis type="category" dataKey="trek" tick={{ fontSize: 11 }} stroke="#94a3b8" width={120} />
              <Tooltip contentStyle={darkTip} />
              <Bar dataKey="persons" name="Persons" fill="#10b981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
