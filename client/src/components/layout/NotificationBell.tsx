import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface Notif {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications')).data.data as { items: Notif[]; unread: number },
    refetchInterval: 30_000,
  });

  const markAll = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data?.unread ?? 0;

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass absolute right-0 z-50 mt-2 w-80 overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              <button
                onClick={() => markAll.mutate()}
                className="inline-flex items-center gap-1 text-xs text-brand-500 hover:underline"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            </div>
            <div className="max-h-80 divide-y divide-white/5 overflow-y-auto">
              {(data?.items ?? []).length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">You're all caught up 🎉</p>
              )}
              {data?.items.map((n) => (
                <div key={n.id} className={`px-4 py-3 ${n.is_read ? 'opacity-60' : 'bg-brand-500/5'}`}>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.body}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{formatDate(n.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
