import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardTitle, EmptyState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Event { date: string; type: string; label: string; ref?: string }

const TYPE_DOT: Record<string, string> = {
  booking: 'bg-sky-500',
  trek: 'bg-brand-500',
  approval: 'bg-emerald-500',
  cancellation: 'bg-rose-500',
  refund_expected: 'bg-amber-500',
  refund_received: 'bg-teal-500',
  payment: 'bg-violet-500',
};
const TYPE_LABEL: Record<string, string> = {
  booking: 'Booking', trek: 'Trek', approval: 'Approval', cancellation: 'Cancellation',
  refund_expected: 'Refund due', refund_received: 'Refund received', payment: 'Payment',
};

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', month],
    queryFn: async () => (await api.get('/calendar', { params: { month } })).data.data as { events: Event[] },
  });

  const byDate = useMemo(() => {
    const m = new Map<string, Event[]>();
    for (const e of data?.events ?? []) {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date)!.push(e);
    }
    return m;
  }, [data]);

  // Build the month grid (Mon-first).
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-brand-500" />
          <div>
            <h1 className="text-2xl font-bold">Calendar</h1>
            <p className="text-sm text-slate-500">Bookings, treks, approvals, refunds & payments.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-xl border border-white/10 p-2 hover:bg-white/5" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
          <span className="min-w-[140px] text-center font-semibold">{cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
          <button className="rounded-xl border border-white/10 p-2 hover:bg-white/5" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(TYPE_LABEL).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-slate-500"><span className={cn('h-2.5 w-2.5 rounded-full', TYPE_DOT[k])} /> {v}</span>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          {isLoading ? <Skeleton className="h-96" /> : (
            <>
              <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-slate-500">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((date, i) => {
                  if (!date) return <div key={i} />;
                  const events = byDate.get(date) ?? [];
                  const day = Number(date.slice(-2));
                  const isToday = date === todayStr;
                  return (
                    <button
                      key={date}
                      onClick={() => setSelected(date)}
                      className={cn(
                        'flex aspect-square flex-col items-center justify-start rounded-xl border p-1.5 text-sm transition hover:border-brand-500',
                        selected === date ? 'border-brand-500 bg-brand-500/10' : 'border-white/10',
                        isToday && 'ring-1 ring-brand-500',
                      )}
                    >
                      <span className={cn('text-xs', isToday && 'font-bold text-brand-500')}>{day}</span>
                      <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                        {events.slice(0, 4).map((e, j) => <span key={j} className={cn('h-1.5 w-1.5 rounded-full', TYPE_DOT[e.type])} />)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        <Card className="space-y-3">
          <CardTitle>{selected ? new Date(selected).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Select a day'}</CardTitle>
          {!selected ? (
            <EmptyState title="No day selected" hint="Click a date to see its records." />
          ) : (byDate.get(selected)?.length ?? 0) === 0 ? (
            <EmptyState title="Nothing on this day" />
          ) : (
            <ul className="space-y-2">
              {byDate.get(selected)!.map((e, i) => (
                <li key={i} className="flex items-center gap-2.5 rounded-xl border border-white/10 px-3 py-2 text-sm">
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TYPE_DOT[e.type])} />
                  <span className="flex-1">{e.label}</span>
                  <span className="text-[10px] uppercase text-slate-400">{TYPE_LABEL[e.type]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
