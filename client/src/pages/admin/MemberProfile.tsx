import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeIndianRupee, Wallet, Scale, Target, CalendarDays, Ticket, Power, KeyRound, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button, Card, CardTitle, EmptyState, Skeleton, StatCard, StatusBadge } from '@/components/ui';
import { formatDate, inr } from '@/lib/utils';

interface Profile {
  user: { id: string; full_name: string; email: string; phone: string | null; is_active: boolean; last_login_at: string | null; created_at: string };
  financials: { totalEarned: number; totalPaid: number; balance: number };
  performance: { totalTickets: number; approvalRate: number; avgTicketsPerDay: number; workingDays: number };
  tickets: { id: string; ticket_code: string; trek_name: string; persons: number; commission_amount: number; status: string; trek_date: string }[];
  payments: { id: string; amount: number; payment_date: string; method: string; receipt_no: string }[];
  loginHistory: { success: boolean; stage: string; ip_address: string | null; created_at: string }[];
}

export default function MemberProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['member-profile', id],
    queryFn: async () => (await api.get(`/users/members/${id}`)).data.data as Profile,
  });

  const toggle = useMutation({
    mutationFn: async (isActive: boolean) => api.patch(`/users/members/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member-profile', id] }); toast.success('Status updated'); },
    onError: (e) => toast.error(apiError(e)),
  });
  const resetPw = useMutation({
    mutationFn: async () => api.post(`/users/members/${id}/reset-password`),
    onSuccess: (res) => toast.success(`New password emailed. Temp: ${res.data.data.tempPassword}`, { duration: 8000 }),
    onError: (e) => toast.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (!window.confirm('Permanently delete this member? This action cannot be undone.')) throw new Error('Cancelled');
      try {
        return await api.delete(`/users/members/${id}`);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          const proceed = window.confirm(
            'This member has records (tickets / payments / ledger).\n\n' +
            'FORCE DELETE will permanently erase the member AND all their tickets, payments, ' +
            'refunds and ledger history. This cannot be undone.\n\nProceed?',
          );
          if (!proceed) throw new Error('Cancelled');
          return await api.post(`/users/members/${id}/purge`);
        }
        throw err;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members-full'] }); toast.success('Member deleted'); navigate('/admin/members'); },
    onError: (e) => { if ((e as Error).message !== 'Cancelled') toast.error(apiError(e)); },
  });

  if (isLoading || !data) {
    return <div className="space-y-4"><Skeleton className="h-10 w-48" /><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div></div>;
  }

  const { user, financials, performance } = data;

  return (
    <div className="space-y-6">
      <Link to="/admin/members" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline">
        <ArrowLeft size={14} /> Back to members
      </Link>

      <Card className="flex flex-wrap items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-xl font-bold text-white">
          {user.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{user.full_name}</h1>
          <p className="text-sm text-slate-500">{user.email}{user.phone ? ` · ${user.phone}` : ''}</p>
        </div>
        <div className="text-right text-sm">
          <span className={`rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${user.is_active ? 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30' : 'bg-slate-500/15 text-slate-400 ring-slate-500/30'}`}>
            {user.is_active ? 'Active' : 'Inactive'}
          </span>
          <p className="mt-1 text-xs text-slate-500">Joined {formatDate(user.created_at)}</p>
          <p className="text-xs text-slate-500">Last login {user.last_login_at ? formatDate(user.last_login_at) : 'never'}</p>
        </div>
      </Card>

      {/* Member actions */}
      <Card className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-medium text-slate-500">Actions</span>
        <Button size="sm" variant={user.is_active ? 'ghost' : 'success'} onClick={() => toggle.mutate(!user.is_active)} disabled={toggle.isPending}>
          <Power size={14} /> {user.is_active ? 'Disable account' : 'Enable account'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => resetPw.mutate()} disabled={resetPw.isPending}>
          {resetPw.isPending ? <Loader2 className="animate-spin" size={14} /> : <KeyRound size={14} />} Reset password
        </Button>
        <Button size="sm" variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
          {remove.isPending ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />} Delete member
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Commission Earned" value={inr(financials.totalEarned)} icon={BadgeIndianRupee} tone="text-emerald-500" />
        <StatCard label="Total Paid" value={inr(financials.totalPaid)} icon={Wallet} tone="text-teal-500" />
        <StatCard label="Balance" value={inr(financials.balance)} icon={Scale} tone="text-violet-500" />
        <StatCard label="Total Tickets" value={performance.totalTickets} icon={Ticket} tone="text-brand-500" />
        <StatCard label="Approval Rate" value={`${performance.approvalRate}%`} icon={Target} tone="text-emerald-500" />
        <StatCard label="Avg Tickets/Day" value={performance.avgTicketsPerDay} icon={CalendarDays} tone="text-amber-500" />
        <StatCard label="Working Days" value={performance.workingDays} icon={CalendarDays} tone="text-sky-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <CardTitle>Recent tickets</CardTitle>
          {data.tickets.length === 0 ? <EmptyState title="No tickets" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Ticket</th><th className="px-2 py-2">Trek</th><th className="px-2 py-2">Pax</th><th className="px-2 py-2">Status</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {data.tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-white/5">
                      <td className="px-2 py-2 font-medium">{t.ticket_code}</td>
                      <td className="px-2 py-2">{t.trek_name}</td>
                      <td className="px-2 py-2">{t.persons}</td>
                      <td className="px-2 py-2"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <CardTitle>Payment history</CardTitle>
          {data.payments.length === 0 ? <EmptyState title="No payments" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Receipt</th><th className="px-2 py-2">Date</th><th className="px-2 py-2">Method</th><th className="px-2 py-2 text-right">Amount</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {data.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="px-2 py-2 font-mono text-xs">{p.receipt_no}</td>
                      <td className="px-2 py-2 text-slate-500">{formatDate(p.payment_date)}</td>
                      <td className="px-2 py-2 capitalize">{p.method.replace('_', ' ')}</td>
                      <td className="px-2 py-2 text-right font-semibold">{inr(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <CardTitle>Login history</CardTitle>
          {data.loginHistory.length === 0 ? <EmptyState title="No login records" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-2">When</th><th className="px-2 py-2">Stage</th><th className="px-2 py-2">IP</th><th className="px-2 py-2">Result</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {data.loginHistory.map((l, i) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="px-2 py-2 text-slate-500">{new Date(l.created_at).toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2 capitalize">{l.stage}</td>
                      <td className="px-2 py-2 font-mono text-xs text-slate-500">{l.ip_address ?? '—'}</td>
                      <td className="px-2 py-2">{l.success ? <span className="text-emerald-500">Success</span> : <span className="text-rose-500">Failed</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
