import { useQuery } from '@tanstack/react-query';
import { Megaphone, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'important';
}

/**
 * Notice card at the top of the member dashboard.
 *
 * Deliberately not a modal: members see this every visit, and a dialog they
 * must dismiss each time becomes noise they learn to click past.
 */
export function AnnouncementBanner() {
  const { data } = useQuery({
    queryKey: ['announcements-active'],
    queryFn: async () => (await api.get('/announcements/active')).data.data as Announcement[],
    staleTime: 60_000,
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-2">
      {data.map((a) => {
        const important = a.priority === 'important';
        return (
          <div
            key={a.id}
            role="status"
            className={[
              'flex items-start gap-3 rounded-2xl border p-4',
              important
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40',
            ].join(' ')}
          >
            <div
              className={[
                'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl',
                important ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-brand-500/10 text-brand-500',
              ].join(' ')}
            >
              {important ? <AlertTriangle size={16} /> : <Megaphone size={16} />}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${important ? 'text-amber-700 dark:text-amber-300' : ''}`}>
                {important && 'Important — '}{a.title}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{a.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
