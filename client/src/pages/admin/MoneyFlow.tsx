import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp, IndianRupee, PiggyBank, Wallet, Receipt, Percent } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle, Skeleton } from '@/components/ui';
import { inr } from '@/lib/utils';

interface MoneyFlow {
  cards: {
    totalPermitCost: number;
    totalCommission: number;
    totalPaidToMembers: number;
    pendingCommission: number;
    refundAmount: number;
    netProfit: number;
    grossRevenue: number;
    todaysRevenue: number;
    profitMargin: number;
  };
  expenseBreakdown: { name: string; value: number }[];
  monthlySeries: { month: string; revenue: number; commission: number; refund: number; profit: number }[];
  dailySeries: { date: string; revenue: number }[];
  trekBreakdown: { trek: string; tickets: number; persons: number; revenue: number; commission: number }[];
}

const PIE_COLORS = ['#3479ff', '#f43f5e', '#10b981'];

function tip(value: number) {
  return inr(value);
}

export default function MoneyFlowPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['money-flow'],
    queryFn: async () => (await api.get('/analytics/money-flow')).data.data as MoneyFlow,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const c = data.cards;
  const cards = [
    { label: "Today's Revenue", value: inr(c.todaysRevenue), icon: TrendingUp, tone: 'text-emerald-500' },
    { label: 'Gross Revenue', value: inr(c.grossRevenue), icon: IndianRupee, tone: 'text-brand-500' },
    { label: 'Total Permit Cost', value: inr(c.totalPermitCost), icon: Receipt, tone: 'text-sky-500' },
    { label: 'Total Commission', value: inr(c.totalCommission), icon: Wallet, tone: 'text-amber-500' },
    { label: 'Paid to Members', value: inr(c.totalPaidToMembers), icon: Wallet, tone: 'text-teal-500' },
    { label: 'Pending Commission', value: inr(c.pendingCommission), icon: PiggyBank, tone: 'text-violet-500' },
    { label: 'Refund Amount', value: inr(c.refundAmount), icon: PiggyBank, tone: 'text-rose-500' },
    { label: 'Net Profit', value: inr(c.netProfit), icon: TrendingUp, tone: 'text-emerald-500', sub: `${c.profitMargin}% margin` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <IndianRupee className="text-brand-500" />
        <div>
          <h1 className="text-2xl font-bold">Money Flow</h1>
          <p className="text-sm text-slate-500">Financial analytics across the operation.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{card.label}</span>
              <card.icon className={card.tone} size={18} />
            </div>
            <span className="text-2xl font-bold tracking-tight">{card.value}</span>
            {'sub' in card && card.sub && <span className="text-xs text-emerald-500">{card.sub}</span>}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <CardTitle className="flex items-center gap-2"><TrendingUp size={15} /> Monthly revenue, commission & profit</CardTitle>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip formatter={tip} contentStyle={{ borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff' }} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#3479ff" radius={[6, 6, 0, 0]} />
              <Bar dataKey="commission" name="Commission" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="space-y-4">
          <CardTitle className="flex items-center gap-2"><Percent size={15} /> Expense breakdown</CardTitle>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data.expenseBreakdown} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                {data.expenseBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={tip} contentStyle={{ borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="space-y-4">
          <CardTitle className="flex items-center gap-2"><TrendingUp size={15} /> Daily revenue (last 30 days)</CardTitle>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.dailySeries}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3479ff" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#3479ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip formatter={tip} contentStyle={{ borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff' }} />
              <Area type="monotone" dataKey="revenue" stroke="#3479ff" fill="url(#rev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="space-y-4">
          <CardTitle className="flex items-center gap-2"><TrendingUp size={15} /> Revenue by trek</CardTitle>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.trekBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="trek" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip formatter={tip} contentStyle={{ borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff' }} />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
