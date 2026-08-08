import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, X, ExternalLink, Info, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui';

interface Guide {
  bookingUrl?: string;
  supportContact?: string;
  steps?: { title: string; body: string }[];
  importantNotes?: string[];
}

/**
 * Step-by-step booking guide. Every value is admin-editable and read from
 * settings, so nothing here is hardcoded in the frontend.
 */
export function HowToBook() {
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data.data as Record<string, unknown>,
    staleTime: 5 * 60_000,
  });

  const guide = (data?.booking_guide ?? {}) as Guide;
  const steps = guide.steps ?? [];

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BookOpen size={16} /> How to book
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="How to book a permit"
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-white p-6 dark:bg-slate-900"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">How to book a permit</h2>
                  <p className="text-sm text-slate-500">Book on the official site, then record it here.</p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
              </div>

              {steps.length === 0 ? (
                <p className="text-sm text-slate-500">
                  An admin has not published the booking steps yet.
                </p>
              ) : (
                <ol className="space-y-3">
                  {steps.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-500/10 text-sm font-semibold text-brand-500">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.title}</p>
                        <p className="text-sm text-slate-500">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {guide.bookingUrl && (
                <a href={guide.bookingUrl} target="_blank" rel="noopener noreferrer" className="mt-4 block">
                  <Button className="w-full">
                    <ExternalLink size={16} /> Open booking website
                  </Button>
                </a>
              )}

              {(guide.importantNotes?.length ?? 0) > 0 && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <Info size={13} /> Before you submit
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-400">
                    {guide.importantNotes!.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}

              {guide.supportContact && (
                <p className="mt-3 text-xs text-slate-500">Need help? {guide.supportContact}</p>
              )}

              <Link to="/tickets/new" onClick={() => setOpen(false)} className="mt-4 block">
                <Button variant="outline" className="w-full"><PlusCircle size={16} /> Add my ticket</Button>
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
