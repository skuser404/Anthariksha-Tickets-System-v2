import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle, Search, Ticket as TicketIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, EmptyState, Input, Select, Skeleton, StatusBadge } from '@/components/ui';
import { STATUS_LABELS, formatDate, inr } from '@/lib/utils';

export interface TicketRow {
  id: string;
  ticket_code: string;
  trek_name: string;
  booking_email: string;
  booking_date: string;
  trek_date: string;
  persons: number;
  permit_price: number;
  commission_amount: number;
  status: string;
  member?: { full_name: string; email: string };
}

export default function TicketsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', search, status],
    queryFn: async () =>
      (await api.get('/tickets', { params: { search: search || undefined, status: status || undefined } })).data
        .data as { items: TicketRow[]; total: number },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Tickets</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} total submissions</p>
        </div>
        <Link to="/tickets/new">
          <Button>
            <PlusCircle size={18} /> Add Ticket
          </Button>
        </Link>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
            <Input
              className="pl-9"
              placeholder="Search ticket id, email, trek…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[220px]">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={<TicketIcon className="text-slate-400" />}
            title="No tickets found"
            hint="Submit a permit booking to get started."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Ticket</th>
                  <th className="px-3 py-2">Trek</th>
                  <th className="px-3 py-2">Trek Date</th>
                  <th className="px-3 py-2">Pax</th>
                  <th className="px-3 py-2">Permit</th>
                  <th className="px-3 py-2">Commission</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items.map((t) => (
                  <tr key={t.id} className="cursor-pointer transition hover:bg-slate-100/60 dark:hover:bg-slate-800/50" onClick={() => navigate(`/tickets/${t.id}`)}>
                    <td className="px-3 py-3 font-medium text-brand-600 dark:text-brand-400">{t.ticket_code}</td>
                    <td className="px-3 py-3">{t.trek_name}</td>
                    <td className="px-3 py-3 text-slate-500">{formatDate(t.trek_date)}</td>
                    <td className="px-3 py-3">{t.persons}</td>
                    <td className="px-3 py-3">{inr(Number(t.permit_price) * t.persons)}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-500">{inr(t.commission_amount)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={t.status} />
                    </td>
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
