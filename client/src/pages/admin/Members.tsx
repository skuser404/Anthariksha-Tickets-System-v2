import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Loader2, Search, Power, ExternalLink, KeyRound, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardTitle, EmptyState, Input, Label, Skeleton } from '@/components/ui';
import { formatDate, inr } from '@/lib/utils';

interface Member {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  total_earned: number;
  total_paid: number;
  balance: number;
}

export default function MembersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['members-full'],
    queryFn: async () => (await api.get('/users/members')).data.data as Member[],
  });

  const create = useMutation({
    mutationFn: async () => api.post('/users/members', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members-full'] });
      setForm({ fullName: '', email: '', phone: '', password: '' });
      setShowForm(false);
      toast.success('Member account created');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const toggle = useMutation({
    mutationFn: async (m: Member) => api.patch(`/users/members/${m.id}`, { isActive: !m.is_active }),
    onSuccess: (_d, m) => {
      qc.invalidateQueries({ queryKey: ['members-full'] });
      toast.success(`${m.full_name} ${m.is_active ? 'deactivated' : 'activated'}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const edit = useMutation({
    mutationFn: async (m: Member) => {
      const fullName = window.prompt('Full name', m.full_name) ?? m.full_name;
      const phone = window.prompt('Phone', m.phone ?? '') ?? m.phone ?? '';
      return api.patch(`/users/members/${m.id}`, { fullName, phone });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members-full'] }); toast.success('Member updated'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const resetPw = useMutation({
    mutationFn: async (m: Member) => api.post(`/users/members/${m.id}/reset-password`),
    onSuccess: (res) => toast.success(`New password emailed. Temp: ${res.data.data.tempPassword}`, { duration: 8000 }),
    onError: (e) => toast.error(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: async (m: Member) => {
      if (!window.confirm(`Permanently delete ${m.full_name}? This cannot be undone.`)) throw new Error('Cancelled');
      try {
        return await api.delete(`/users/members/${m.id}`);
      } catch (err) {
        // Member has history — offer an explicit force purge.
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          const proceed = window.confirm(
            `${m.full_name} has records (tickets / payments / ledger).\n\n` +
            `FORCE DELETE will permanently erase this member AND all their tickets, payments, ` +
            `refunds and ledger history. This cannot be undone.\n\nProceed?`,
          );
          if (!proceed) throw new Error('Cancelled');
          return await api.post(`/users/members/${m.id}/purge`);
        }
        throw err;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members-full'] }); toast.success('Member deleted'); },
    onError: (e) => { if ((e as Error).message !== 'Cancelled') toast.error(apiError(e)); },
  });

  const filtered = data?.filter(
    (m) => m.full_name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="text-sky-500" />
          <div>
            <h1 className="text-2xl font-bold">Members</h1>
            <p className="text-sm text-slate-500">{data?.length ?? 0} member accounts</p>
          </div>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <UserPlus size={18} /> New Member
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardTitle className="mb-3">Create member account</CardTitle>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div><Label>Full name *</Label><Input required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} /></div>
            <div><Label>Email *</Label><Input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>Temp password * (min 8)</Label><Input required type="text" minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="animate-spin" size={16} />} Create
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
          <Input className="pl-9" placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (filtered?.length ?? 0) === 0 ? (
          <EmptyState title="No members found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Member</th>
                  <th className="px-2 py-2">Last login</th>
                  <th className="px-2 py-2 text-right">Earned</th>
                  <th className="px-2 py-2 text-right">Paid</th>
                  <th className="px-2 py-2 text-right">Balance</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered?.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="px-2 py-2.5"><p className="font-medium">{m.full_name}</p><p className="text-xs text-slate-500">{m.email}</p></td>
                    <td className="px-2 py-2.5 text-slate-500">{m.last_login_at ? formatDate(m.last_login_at) : 'Never'}</td>
                    <td className="px-2 py-2.5 text-right text-emerald-500">{inr(m.total_earned)}</td>
                    <td className="px-2 py-2.5 text-right text-teal-500">{inr(m.total_paid)}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-violet-500">{inr(m.balance)}</td>
                    <td className="px-2 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${m.is_active ? 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30' : 'bg-slate-500/15 text-slate-400 ring-slate-500/30'}`}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Link to={`/admin/members/${m.id}`}><Button size="sm" variant="outline"><ExternalLink size={14} /> Profile</Button></Link>
                        <Button size="sm" variant="ghost" onClick={() => edit.mutate(m)} title="Edit"><Pencil size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => resetPw.mutate(m)} title="Reset password"><KeyRound size={14} /></Button>
                        <Button size="sm" variant={m.is_active ? 'ghost' : 'success'} onClick={() => toggle.mutate(m)}>
                          <Power size={14} /> {m.is_active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove.mutate(m)} title="Delete member"><Trash2 size={14} /></Button>
                      </div>
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
