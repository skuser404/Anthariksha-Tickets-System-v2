import { Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Ticket, PlusCircle, ShieldCheck, Mountain, Search,
  Menu, X, Wallet, RotateCcw, IndianRupee, BarChart3, FileText, Archive, Repeat,
  Users, ScrollText, Settings as SettingsIcon, Bell, UserCircle, LifeBuoy, Ban,
  BookLock, Trophy, Activity, CalendarDays, Crown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui';
import { NotificationBell } from './NotificationBell';
import { ProfileMenu } from './ProfileMenu';
import { BottomNav } from './BottomNav';
import { ThemeMenu } from './ThemeMenu';
import { CommandPalette } from '@/components/CommandPalette';
import { AiAssistant } from '@/components/AiAssistant';
import { IdleTimeout } from '@/components/IdleTimeout';

type NavItem = { to: string; label: string; icon: typeof Ticket; end?: boolean };

const memberNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tickets/new', label: 'Add Ticket', icon: PlusCircle },
  { to: '/tickets', label: 'My Tickets', icon: Ticket },
  { to: '/earnings', label: 'Payment History', icon: Wallet },
  { to: '/refunds', label: 'Refund History', icon: RotateCcw },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserCircle },
  { to: '/help', label: 'Help & Support', icon: LifeBuoy },
];

const adminNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tickets/new', label: 'Add Ticket', icon: PlusCircle },
  { to: '/admin/tickets', label: 'Ticket Verification', icon: ShieldCheck },
  { to: '/admin/originals', label: 'Original Tickets', icon: Archive },
  { to: '/admin/replacements', label: 'Replacement Tickets', icon: Repeat },
  { to: '/refunds', label: 'Cancellation & Refunds', icon: Ban },
  { to: '/admin/payments', label: 'Payment Management', icon: Wallet },
  { to: '/admin/ledger', label: 'Financial Ledger', icon: BookLock },
  { to: '/admin/money-flow', label: 'Money Flow', icon: IndianRupee },
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/admin/reports', label: 'Reports', icon: FileText },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/admin/activity', label: 'Activity Feed', icon: Activity },
  { to: '/admin/treks', label: 'Trek Pricing', icon: Mountain },
  { to: '/admin/audit', label: 'Audit Logs', icon: ScrollText },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
];

export function DashboardLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const nav = user?.role === 'admin'
    ? (user.isSuper ? [...adminNav, { to: '/admin/admins', label: 'Admin Management', icon: Crown }] : adminNav)
    : memberNav;

  return (
    <div className="app-bg min-h-screen">
      {/* Sidebar */}
      <aside
        style={{ backgroundColor: 'rgb(var(--sidebar))' }}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-slate-200 p-4 transition-transform dark:border-slate-800 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src="/logo.png" alt="Antariksha" className="h-9 w-9 rounded-lg object-contain" />
          <div>
            <p className="text-sm font-bold leading-tight">Antariksha</p>
            <p className="text-[11px] text-slate-500">Trek Operations</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto pr-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800/60',
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {user?.role === 'admin' && (
          <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-400">
            <ShieldCheck size={12} /> Admin
          </span>
        )}
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>

          {/* Command-palette launcher */}
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="relative hidden max-w-sm flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/50 px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-white/70 dark:bg-white/5 dark:hover:bg-white/10 sm:flex"
          >
            <Search size={16} />
            <span className="flex-1">Search or jump to…</span>
            <kbd className="rounded-md border border-white/15 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <ThemeMenu />
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mx-auto w-full max-w-7xl p-4 pb-24 sm:p-6 lg:pb-6"
        >
          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </motion.main>
      </div>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      {user?.role !== 'admin' && <BottomNav />}
      <CommandPalette />
      <AiAssistant />
      <IdleTimeout />
    </div>
  );
}
