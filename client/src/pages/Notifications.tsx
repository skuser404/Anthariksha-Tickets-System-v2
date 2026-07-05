import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, EmptyState, Skeleton } from '@/components/ui';

interface Notif {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications')).data.data as { items: Notif[]; unread: number },
  });

  const markAll = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markOne = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="text-brand-500" />
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-slate-500">{data?.unread ?? 0} unread</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
          <CheckCheck size={15} /> Mark all read
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={<Bell className="text-slate-400" />} title="No notifications" hint="You're all caught up." />
      ) : (
        <div className="space-y-2">
          {data?.items.map((n) => (
            <Card
              key={n.id}
              className={`flex cursor-pointer items-start gap-3 p-4 transition hover:bg-white/5 ${n.is_read ? 'opacity-70' : ''}`}
              onClick={() => !n.is_read && markOne.mutate(n.id)}
            >
              <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-slate-400' : 'bg-brand-500'}`} />
              <div className="flex-1">
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-slate-500">{n.body}</p>
                <p className="mt-1 text-[11px] text-slate-400">{new Date(n.created_at).toLocaleString('en-IN')}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
