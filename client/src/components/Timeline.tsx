import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export interface TimelineStep {
  label: string;
  at: string | null;
  done: boolean;
}

/** Vertical lifecycle timeline for a ticket. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative ml-3 space-y-4 border-l border-white/10 pl-6">
      {steps.map((s, i) => (
        <motion.li
          key={`${s.label}-${i}`}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="relative"
        >
          <span
            className={`absolute -left-[31px] grid h-5 w-5 place-items-center rounded-full ring-4 ring-slate-950/0 ${
              s.done ? 'bg-emerald-500 text-white' : 'border border-white/20 bg-slate-500/20'
            }`}
          >
            {s.done && <Check size={12} />}
          </span>
          <p className={`text-sm font-medium ${s.done ? '' : 'text-slate-400'}`}>{s.label}</p>
          {s.at && <p className="text-xs text-slate-500">{formatDate(s.at)}</p>}
        </motion.li>
      ))}
    </ol>
  );
}
