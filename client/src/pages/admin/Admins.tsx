import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserPlus, Loader2, Power, Trash2, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardTitle, EmptyState, Input, Label, Skeleton } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface Admin {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_super: boolean;
  last_login_at: string | null;
  created_at: string;
}

const randomPw = () => 'Av' + Math.random().toString(36).slice(2, 8) + '@' + Math.floor(10 + Math.random() * 89);

export default function AdminsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: randomPw(), isSuper: false });

  const { data, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => (await api.get('/admins')).data.data as Admin[],
  });

  const create = useMutation({
    mutationFn: async () => api.post('/admins', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      setShowForm(false);
      setForm({ fullName: '', email: '', phone: '', password: randomPw(), isSuper: false });
      toast.success('Admin created · credentials emailed');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const toggleActive = useMutation({
    mutationFn: async (a: Admin) => api.patch(`/admins/${a.id}`, { isActive: !a.is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); toast.success('Updated'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const toggleSuper = useMutation({
    mutationFn: async (a: Admin) => api.patch(`/admins/${a.id}`, { isSuper: !a.is_super }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); toast.success('Permission updated'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: async (a: Admin) => {
      const password = window.prompt(`Deleting ${a.full_name}. Confirm with YOUR password:`);
      if (!password) throw new Error('Cancelled');
      return api.delete(`/admins/${a.id}`, { data: { password } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admins'] }); toast.success('Admin deleted'); },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-violet-500" />
          <div>
            <h1 className="text-2xl font-bold">Admin Management</h1>
            <p className="text-sm text-slate-500">Super-admin only · {data?.length ?? 0} admins</p>
          </div>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}><UserPlus size={18} /> New Admin</Button>
      </div>

      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-2.5 text-xs text-violet-600 dark:text-violet-400">
        Super-admins can manage admins, users, settings and backups. Regular admins can verify tickets and
        manage payments/refunds but cannot delete admins, create super-admins, or permanently delete users.
      </div>

      {showForm && (
        <Card>
          <CardTitle className="mb-3">Create admin</CardTitle>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <div><Label>Full name *</Label><Input required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} /></div>
            <div><Label>Email *</Label><Input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>Temp password *</Label><Input required minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.isSuper} onChange={(e) => setForm((f) => ({ ...f, isSuper: e.target.checked }))} />
              Grant <span className="font-medium">Super-Admin</span> (full access)
            </label>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>{create.isPending && <Loader2 className="animate-spin" size={16} />} Create</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState title="No admins" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Admin</th>
                  <th className="px-2 py-2">Permission</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Last login</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.map((a) => {
                  const isSelf = a.id === user?.id;
                  return (
                    <tr key={a.id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/40">
                      <td className="px-2 py-2.5">
                        <p className="font-medium">{a.full_name}{isSelf && <span className="ml-1 text-xs text-slate-400">(you)</span>}</p>
                        <p className="text-xs text-slate-500">{a.email}</p>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${a.is_super ? 'bg-violet-500/15 text-violet-500 ring-violet-500/30' : 'bg-slate-500/15 text-slate-400 ring-slate-500/30'}`}>
                          {a.is_super && <Crown size={11} />} {a.is_super ? 'Super Admin' : 'Admin'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${a.is_active ? 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30' : 'bg-slate-500/15 text-slate-400 ring-slate-500/30'}`}>
                          {a.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-slate-500">{a.last_login_at ? formatDate(a.last_login_at) : 'Never'}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" disabled={isSelf} onClick={() => toggleSuper.mutate(a)} title="Toggle super-admin">
                            <Crown size={14} /> {a.is_super ? 'Demote' : 'Promote'}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={isSelf} onClick={() => toggleActive.mutate(a)}>
                            <Power size={14} /> {a.is_active ? 'Disable' : 'Enable'}
                          </Button>
                          <Button size="sm" variant="danger" disabled={isSelf} onClick={() => remove.mutate(a)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
