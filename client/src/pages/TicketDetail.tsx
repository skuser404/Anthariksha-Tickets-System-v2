import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle, Skeleton, StatusBadge } from '@/components/ui';
import { Timeline, type TimelineStep } from '@/components/Timeline';
import { TicketComments } from '@/components/TicketComments';
import { formatDate, inr } from '@/lib/utils';

interface TimelineResp {
  ticket: {
    id: string; ticket_code: string; trek_name: string; booking_email: string;
    booking_date: string; trek_date: string; persons: number; permit_price: number;
    commission_amount: number; status: string;
  };
  steps: TimelineStep[];
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['timeline', id],
    queryFn: async () => (await api.get(`/tickets/${id}/timeline`)).data.data as TimelineResp,
  });

  if (isLoading || !data) {
    return <div className="space-y-4"><Skeleton className="h-10 w-40" /><Skeleton className="h-64" /></div>;
  }

  const t = data.ticket;
  const locked = t.status === 'approved';

  return (
    <div className="space-y-6">
      <Link to="/tickets" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline">
        <ArrowLeft size={14} /> Back to my tickets
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t.ticket_code}</h1>
          <p className="text-sm text-slate-500">{t.trek_name} · {t.persons} pax</p>
        </div>
        <StatusBadge status={t.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Card>
            <CardTitle className="mb-3">Ticket information</CardTitle>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Booking email" value={t.booking_email} />
              <Detail label="Booking date" value={formatDate(t.booking_date)} />
              <Detail label="Trek date" value={formatDate(t.trek_date)} />
              <Detail label="Persons" value={String(t.persons)} />
              <Detail label="Permit total" value={inr(Number(t.permit_price) * t.persons)} />
              <Detail label="Commission" value={inr(t.commission_amount)} />
            </div>
          </Card>

          <Card>
            <CardTitle className="mb-3">Timeline</CardTitle>
            <Timeline steps={data.steps} />
          </Card>
        </div>

        <Card className="flex h-[34rem] flex-col">
          <CardTitle className="mb-3 flex items-center gap-2"><MessageSquare size={15} /> Comments & correction requests</CardTitle>
          <div className="min-h-0 flex-1">
            <TicketComments ticketId={t.id} ticketLocked={locked} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
