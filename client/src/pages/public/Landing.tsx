import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Ticket, Wallet, RotateCcw, BarChart3, BookLock, ArrowRight,
  CheckCircle2, ChevronDown, Mountain,
} from 'lucide-react';
import { PublicShell } from '@/components/public/PublicShell';

const features = [
  { icon: Ticket, title: 'Ticket submission & verification', body: 'Members submit permit bookings; admins verify with smart duplicate detection.' },
  { icon: Wallet, title: 'Commission & payments', body: 'Automatic ₹50/person commission, manual payout records, and live balances.' },
  { icon: RotateCcw, title: 'Refund tracking', body: 'Policy-based refund calculation (100/50/0%) with manual status updates.' },
  { icon: BookLock, title: 'Immutable financial ledger', body: 'Every financial event is recorded permanently and can never be altered.' },
  { icon: BarChart3, title: 'Analytics & reports', body: 'Money-flow dashboards plus CSV / Excel / PDF reports for accounting.' },
  { icon: ShieldCheck, title: 'Secure by design', body: 'Role-based access, admin 2FA, audit logs, and account lockout.' },
];

const steps = [
  { n: 1, title: 'Book the permit', body: 'Members book on the official Aranya Vihara website.' },
  { n: 2, title: 'Submit the details', body: 'Enter the ticket into Antariksha — commission is calculated instantly.' },
  { n: 3, title: 'Admin verifies', body: 'An admin approves the ticket; commission is credited and ledgered.' },
  { n: 4, title: 'Get settled', body: 'Admins record payouts manually; balances and reports stay in sync.' },
];

const faqs = [
  { q: 'Is this a public booking website?', a: 'No. It is a private internal portal for ~20–25 members and administrators. Permits are booked on the official site; this app tracks and settles them.' },
  { q: 'Does the app process payments?', a: 'Never. It only calculates and records. All money moves outside the app; admins record manual payments and refund statuses.' },
  { q: 'How is commission calculated?', a: '₹50 per person, credited once an admin approves the ticket.' },
  { q: 'How do I get an account?', a: 'Accounts are created by administrators. There is no public sign-up.' },
];

export default function Landing() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <PublicShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <motion.img
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            src="/logo.png" alt="Antariksha" className="mx-auto mb-6 h-20 w-20 rounded-2xl object-contain"
          />
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Trek Operations & Commission Management
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            A private, secure platform for tracking permit submissions, verification, member
            commissions, refunds and settlements — with a complete, immutable audit trail.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700">
              Member Login <ArrowRight size={16} />
            </Link>
            <Link to="/login?admin=1" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
              <ShieldCheck size={16} /> Admin Login
            </Link>
          </motion.div>
          <p className="mt-4 text-xs text-slate-400">Private internal portal · accounts are created by administrators</p>
        </div>
      </section>

      {/* About */}
      <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">About Antariksha</h2>
            <p className="mt-3 text-slate-500">
              Antariksha streamlines the back-office of trek permit operations. Members record the
              permits they've booked; administrators verify them, manage commissions and refunds,
              and settle payments — all with clear financial visibility and reliable reporting
              suitable for daily use.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {['No public booking — internal tracking only', 'Calculation & records only, no money movement', 'Complete audit trail that can never be deleted'].map((x) => (
                <li key={x} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> {x}</li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[['20–25', 'Members'], ['₹50', 'Per person'], ['100%', 'Auditable'], ['0', 'Gateways']].map(([v, l]) => (
              <div key={l} className="rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-slate-800 dark:bg-slate-900">
                <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{v}</p>
                <p className="text-xs text-slate-500">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold">Everything operations needs</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand-500/40 dark:border-slate-800 dark:bg-slate-900">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600/10 text-brand-600 dark:text-brand-400"><f.icon size={18} /></span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold">How it works</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{s.n}</span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold">Frequently asked questions</h2>
        <div className="mt-8 divide-y divide-slate-200 dark:divide-slate-800">
          {faqs.map((f, i) => (
            <div key={f.q} className="py-4">
              <button className="flex w-full items-center justify-between text-left font-medium" onClick={() => setOpen(open === i ? null : i)}>
                {f.q} <ChevronDown size={18} className={`transition ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && <p className="mt-2 text-sm text-slate-500">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <Mountain className="mx-auto mb-3 text-brand-600 dark:text-brand-400" />
          <h2 className="text-2xl font-bold">Ready to sign in?</h2>
          <p className="mt-2 text-slate-500">Access your dashboard to manage tickets, commissions and settlements.</p>
          <Link to="/login" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700">
            Go to login <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
