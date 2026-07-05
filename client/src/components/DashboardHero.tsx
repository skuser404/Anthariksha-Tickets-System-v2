import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Sparkles, Clock, AlertTriangle, TrendingUp, TrendingDown, Ticket, RotateCcw,
  CheckCircle2, Target, PlusCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface Insight { tone: 'info' | 'success' | 'warning' | 'danger'; icon: string; text: string }

const ICONS: Record<string, typeof Clock> = {
  Clock, AlertTriangle, TrendingUp, TrendingDown, Ticket, RotateCcw, CheckCircle2, Target, PlusCircle,
};
const TONES: Record<Insight['tone'], string> = {
  info: 'bg-brand-500/10 text-brand-500 ring-brand-500/20',
  success: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-500 ring-amber-500/20',
  danger: 'bg-rose-500/10 text-rose-500 ring-rose-500/20',
};

function greeting(h: number) {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHero() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: insights } = useQuery({
    queryKey: ['insights'],
    queryFn: async () => (await api.get('/dashboard/insights')).data.data as Insight[],
    refetchInterval: 120_000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-500">{greeting(now.getHours())} 👋</p>
          <h1 className="mt-0.5 text-2xl font-bold sm:text-3xl">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right">
          <p className="font-mono text-2xl font-bold tabular-nums">
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </p>
          <p className="text-[11px] text-slate-500">Local time</p>
        </div>
      </div>

      {(insights?.length ?? 0) > 0 && (
        <div className="relative mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Sparkles size={13} className="text-brand-500" /> Smart insights
          </p>
          <div className="flex flex-wrap gap-2">
            {insights?.map((ins, i) => {
              const Icon = ICONS[ins.icon] ?? Sparkles;
              return (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06 }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${TONES[ins.tone]}`}
                >
                  <Icon size={13} /> {ins.text}
                </motion.span>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
