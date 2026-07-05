import { useState } from 'react';
import { Mail, Clock, Send } from 'lucide-react';
import { toast } from 'sonner';
import { PublicShell } from '@/components/public/PublicShell';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold">Contact & Support</h1>
        <p className="mt-2 text-slate-500">Questions about your account, payments or verification? Reach out.</p>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <Mail className="text-brand-600 dark:text-brand-400" />
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-slate-500">support@antariksha.test</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <Clock className="text-brand-600 dark:text-brand-400" />
              <div>
                <p className="font-medium">Support hours</p>
                <p className="text-sm text-slate-500">Mon–Sat, 9:00 AM – 7:00 PM IST</p>
              </div>
            </div>
          </div>

          <form
            className="space-y-3 rounded-2xl border border-slate-200 p-6 dark:border-slate-800"
            onSubmit={(e) => { e.preventDefault(); toast.success('Thanks! Your message has been noted.'); setForm({ name: '', email: '', message: '' }); }}
          >
            <p className="font-semibold">Feedback form</p>
            <input required placeholder="Your name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900" />
            <input required type="email" placeholder="Your email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900" />
            <textarea required rows={4} placeholder="How can we help?" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900" />
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Send size={15} /> Send message
            </button>
          </form>
        </div>
      </div>
    </PublicShell>
  );
}
