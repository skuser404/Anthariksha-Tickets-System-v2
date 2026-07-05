import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Ticket, Users, Wallet, BadgeIndianRupee, Scale, CalendarDays, CheckCircle2,
  Clock, XCircle, Ban, RotateCcw, PiggyBank, PlusCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Skeleton, Button, StatCard } from '@/components/ui';
import { DashboardHero } from '@/components/DashboardHero';
import { inr } from '@/lib/utils';

interface MemberStats {
  totalTickets: number;
  totalPersons: number;
  totalCommissionEarned: number;
  totalPaid: number;
  currentBalance: number;
  workingDays: number;
  approvedTickets: number;
  pendingVerification: number;
  notConfirmed: number;
  cancelled: number;
  refundPending: number;
  refundCompleted: number;
  avgTicketsPerDay: number;
  monthlyEarnings: number;
}

type CardDef = { label: string; count: number; icon: typeof Ticket; tone: string; format?: (n: number) => string };

const cards = (s: MemberStats): CardDef[] => [
  { label: 'Total Tickets', count: s.totalTickets, icon: Ticket, tone: 'text-brand-500' },
  { label: 'Total Persons', count: s.totalPersons, icon: Users, tone: 'text-sky-500' },
  { label: 'Commission Earned', count: s.totalCommissionEarned, format: inr, icon: BadgeIndianRupee, tone: 'text-emerald-500' },
  { label: 'Total Paid', count: s.totalPaid, format: inr, icon: Wallet, tone: 'text-teal-500' },
  { label: 'Current Balance', count: s.currentBalance, format: inr, icon: Scale, tone: 'text-violet-500' },
  { label: 'Working Days', count: s.workingDays, icon: CalendarDays, tone: 'text-amber-500' },
  { label: 'Approved', count: s.approvedTickets, icon: CheckCircle2, tone: 'text-emerald-500' },
  { label: 'Pending Verification', count: s.pendingVerification, icon: Clock, tone: 'text-amber-500' },
  { label: 'Not Confirmed', count: s.notConfirmed, icon: XCircle, tone: 'text-rose-500' },
  { label: 'Cancelled', count: s.cancelled, icon: Ban, tone: 'text-slate-400' },
  { label: 'Refund Pending', count: s.refundPending, icon: RotateCcw, tone: 'text-sky-500' },
  { label: 'Refund Completed', count: s.refundCompleted, icon: PiggyBank, tone: 'text-teal-500' },
  { label: 'Avg Tickets / Day', count: s.avgTicketsPerDay, icon: CalendarDays, tone: 'text-amber-500' },
  { label: 'Monthly Earnings', count: s.monthlyEarnings, format: inr, icon: BadgeIndianRupee, tone: 'text-emerald-500' },
];

export default function MemberDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['member-stats'],
    queryFn: async () => (await api.get('/dashboard/member')).data.data as MemberStats,
  });

  return (
    <div className="space-y-6">
      <DashboardHero />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-500">Your summary</h2>
        <Link to="/tickets/new">
          <Button size="sm"><PlusCircle size={16} /> Add Ticket</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {isLoading || !data
          ? Array.from({ length: 14 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : cards(data).map((c, i) => (
              <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <StatCard label={c.label} count={c.count} format={c.format} icon={c.icon} tone={c.tone} />
              </motion.div>
            ))}
      </div>
    </div>
  );
}
