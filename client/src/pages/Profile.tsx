import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCircle, Save, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button, Card, CardTitle, Input, Label, Skeleton } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface Me {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  totp_enabled: boolean;
  email_2fa?: boolean;
  login_alerts?: boolean;
  avatar_url?: string | null;
  last_login_at: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: async () => (await api.get('/users/me')).data.data as Me });

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const avatarRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  async function uploadAvatar(file: File) {
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5 MB');
    setAvatarBusy(true);
    try {
      const up = (await api.post('/users/me/avatar-url', { fileName: file.name })).data.data as { signedUrl: string; publicUrl: string };
      const res = await fetch(up.signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!res.ok) throw new Error('Upload failed');
      await api.patch('/users/me', { avatarUrl: up.publicUrl });
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success('Photo updated');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setAvatarBusy(false);
    }
  }

  useEffect(() => {
    if (data) {
      setFullName(data.full_name);
      setPhone(data.phone ?? '');
    }
  }, [data]);

  const saveProfile = useMutation({
    mutationFn: async () => api.patch('/users/me', { fullName, phone }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const changePw = useMutation({
    mutationFn: async () => api.post('/users/me/password', pw),
    onSuccess: () => {
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const security = useMutation({
    mutationFn: async (payload: { email2fa?: boolean; loginAlerts?: boolean }) => api.patch('/users/me/security', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); toast.success('Security preferences updated'); },
    onError: (e) => toast.error(apiError(e)),
  });

  if (isLoading || !data) return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <UserCircle className="text-brand-500" />
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-sm text-slate-500 capitalize">{data.role} account · joined {formatDate(data.created_at)}</p>
        </div>
      </div>

      <Card className="space-y-4">
        <CardTitle>Personal details</CardTitle>
        <div className="flex items-center gap-4">
          {data.avatar_url
            ? <img src={data.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
            : <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-600 text-xl font-bold text-white">{data.full_name.charAt(0).toUpperCase()}</div>}
          <div>
            <input ref={avatarRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            <Button size="sm" variant="outline" disabled={avatarBusy} onClick={() => avatarRef.current?.click()}>
              {avatarBusy ? <Loader2 className="animate-spin" size={14} /> : 'Change photo'}
            </Button>
            <p className="mt-1 text-xs text-slate-500">PNG or JPG.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Email</Label><Input value={data.email} disabled /></div>
          <div><Label>Last login</Label><Input value={data.last_login_at ? new Date(data.last_login_at).toLocaleString('en-IN') : 'Never'} disabled /></div>
        </div>
        <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
          {saveProfile.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save changes
        </Button>
      </Card>

      <Card className="space-y-4">
        <CardTitle className="flex items-center gap-2"><KeyRound size={15} /> Change password</CardTitle>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            changePw.mutate();
          }}
        >
          <div><Label>Current password</Label><Input required type="password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} /></div>
          <div><Label>New password (min 8)</Label><Input required type="password" minLength={8} value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} /></div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={changePw.isPending}>
              {changePw.isPending && <Loader2 className="animate-spin" size={16} />} Update password
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-4">
        <CardTitle className="flex items-center gap-2"><ShieldCheck size={15} /> Security</CardTitle>

        {data.role === 'admin' ? (
          <Toggle
            label="Two-factor authentication"
            hint={`Email OTP is always required for admins.${data.totp_enabled ? ' Authenticator app enrolled.' : ''}`}
            checked
            disabled
            onChange={() => {}}
          />
        ) : (
          <Toggle
            label="Email two-factor authentication"
            hint="Require a 6-digit email code at every login."
            checked={!!data.email_2fa}
            onChange={(v) => security.mutate({ email2fa: v })}
          />
        )}

        <Toggle
          label="Login alert emails"
          hint="Get an email whenever your account signs in."
          checked={data.login_alerts !== false}
          onChange={(v) => security.mutate({ loginAlerts: v })}
        />
      </Card>
    </div>
  );
}

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-slate-500">{hint}</p>
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-400/40'} ${disabled ? 'opacity-60' : ''}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
