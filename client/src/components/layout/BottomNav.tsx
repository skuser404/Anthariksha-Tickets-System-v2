import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Ticket, PlusCircle, Wallet, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/tickets', label: 'Tickets', icon: Ticket },
  { to: '/tickets/new', label: 'Add', icon: PlusCircle },
  { to: '/earnings', label: 'Earnings', icon: Wallet },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

/** Touch-friendly bottom navigation for members on small screens. */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-white/80 backdrop-blur-xl dark:bg-slate-900/80 lg:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cn(
                'flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition',
                isActive ? 'text-brand-500' : 'text-slate-500',
              )
            }
          >
            {({ isActive }) => (
              <>
                <it.icon size={20} className={isActive ? 'scale-110 transition' : 'transition'} />
                {it.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
