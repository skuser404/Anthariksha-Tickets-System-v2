import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle, Settings, LifeBuoy, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const items = [
    { label: 'Profile', icon: UserCircle, action: () => go('/profile') },
    { label: 'Settings', icon: Settings, action: () => go(user?.role === 'admin' ? '/admin/settings' : '/profile') },
    { label: 'Help & Support', icon: LifeBuoy, action: () => go('/help') },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/50 py-1 pl-1 pr-2 transition hover:bg-white/70 dark:bg-white/5 dark:hover:bg-white/10"
      >
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-xs font-semibold leading-tight">{user?.name}</p>
          <p className="text-[10px] capitalize text-slate-500">{user?.role}</p>
        </div>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass absolute right-0 z-50 mt-2 w-52 overflow-hidden p-1.5">
            <div className="border-b border-white/10 px-3 py-2">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
            {items.map((it) => (
              <button
                key={it.label}
                onClick={it.action}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-white/50 dark:hover:bg-white/10"
              >
                <it.icon size={16} className="text-slate-500" /> {it.label}
              </button>
            ))}
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-500 transition hover:bg-rose-500/10"
            >
              <LogOut size={16} /> Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
