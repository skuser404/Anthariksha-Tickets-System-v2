import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, LayoutDashboard, Ticket, PlusCircle, Wallet, RotateCcw, Bell, UserCircle,
  ShieldCheck, Users, FileText, BarChart3, IndianRupee, Mountain, ScrollText,
  Settings as SettingsIcon, Archive, Repeat, Moon, CornerDownLeft,
  BookLock, Trophy, Activity, CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

interface Cmd {
  label: string;
  icon: typeof Ticket;
  hint?: string;
  run: () => void;
  admin?: boolean;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const go = (path: string) => () => { setOpen(false); navigate(path); };

  const commands: Cmd[] = useMemo(() => {
    const isAdmin = user?.role === 'admin';
    const common: Cmd[] = [
      { label: 'Go to Dashboard', icon: LayoutDashboard, run: go('/') },
      { label: 'My Tickets', icon: Ticket, run: go('/tickets') },
      { label: 'Add Ticket', icon: PlusCircle, hint: 'Create', run: go('/tickets/new') },
      { label: 'Payment History', icon: Wallet, run: go('/earnings') },
      { label: 'Refunds', icon: RotateCcw, run: go('/refunds') },
      { label: 'Notifications', icon: Bell, run: go('/notifications') },
      { label: 'Profile', icon: UserCircle, run: go('/profile') },
      { label: 'Toggle dark / light', icon: Moon, run: () => { setOpen(false); toggle(); } },
    ];
    const admin: Cmd[] = [
      { label: 'Ticket Verification', icon: ShieldCheck, run: go('/admin/tickets'), admin: true },
      { label: 'Members', icon: Users, run: go('/admin/members'), admin: true },
      { label: 'Payment Management', icon: Wallet, run: go('/admin/payments'), admin: true },
      { label: 'Financial Ledger', icon: BookLock, run: go('/admin/ledger'), admin: true },
      { label: 'Money Flow', icon: IndianRupee, run: go('/admin/money-flow'), admin: true },
      { label: 'Leaderboard', icon: Trophy, run: go('/admin/leaderboard'), admin: true },
      { label: 'Activity Feed', icon: Activity, run: go('/admin/activity'), admin: true },
      { label: 'Calendar', icon: CalendarDays, run: go('/admin/calendar'), admin: true },
      { label: 'Reports', icon: FileText, run: go('/admin/reports'), admin: true },
      { label: 'Analytics', icon: BarChart3, run: go('/admin/analytics'), admin: true },
      { label: 'Original Tickets', icon: Archive, run: go('/admin/originals'), admin: true },
      { label: 'Replacement Tickets', icon: Repeat, run: go('/admin/replacements'), admin: true },
      { label: 'Trek Pricing', icon: Mountain, run: go('/admin/treks'), admin: true },
      { label: 'Audit Logs', icon: ScrollText, run: go('/admin/audit'), admin: true },
      { label: 'Settings', icon: SettingsIcon, run: go('/admin/settings'), admin: true },
    ];
    return isAdmin ? [...common, ...admin] : common;
  }, [user]);

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { if (active >= filtered.length) setActive(0); }, [filtered.length, active]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="glass w-full max-w-xl overflow-hidden p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                  if (e.key === 'Enter') { e.preventDefault(); filtered[active]?.run(); }
                }}
                placeholder="Type a command or search…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
              <kbd className="rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] text-slate-400">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No matching commands</p>}
              {filtered.map((c, i) => (
                <button
                  key={c.label}
                  onMouseEnter={() => setActive(i)}
                  onClick={c.run}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${i === active ? 'bg-brand-500/15 text-brand-500' : 'hover:bg-white/5'}`}
                >
                  <c.icon size={16} className={i === active ? 'text-brand-500' : 'text-slate-400'} />
                  <span className="flex-1 text-left text-current">{c.label}</span>
                  {c.hint && <span className="text-[10px] text-slate-400">{c.hint}</span>}
                  {i === active && <CornerDownLeft size={14} className="text-brand-500" />}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
