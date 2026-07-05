import { LifeBuoy, Ticket, Wallet, RotateCcw, Mail } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui';

const faqs = [
  { q: 'How do I submit a ticket?', a: 'First book the permit on the Aranya Vihara website, then go to Add Ticket and enter the official Ticket ID, dates, trek and persons. Commission (₹50/person) is calculated automatically and credited once an admin approves.' },
  { q: 'When is my commission paid?', a: 'Commission is added when your ticket is approved. The admin records payouts against your balance — track them under My Earnings.' },
  { q: 'How are refunds calculated?', a: 'On cancellation: ≥7 days before the trek = 100%, 4–6 days = 50%, under 4 days = 0%. The refund is expected within 30 days of cancellation.' },
  { q: 'Why was my ticket Not Confirmed?', a: 'An admin could not verify the booking. The reason is shown in the ticket remarks and you are notified. Records are never deleted.' },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <LifeBuoy className="text-brand-500" />
        <div>
          <h1 className="text-2xl font-bold">Help & Support</h1>
          <p className="text-sm text-slate-500">Guides and answers for the Antariksha portal.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Ticket, label: 'Tickets', tone: 'text-brand-500' },
          { icon: Wallet, label: 'Payments', tone: 'text-teal-500' },
          { icon: RotateCcw, label: 'Refunds', tone: 'text-sky-500' },
        ].map((x) => (
          <Card key={x.label} className="flex items-center gap-3">
            <x.icon className={x.tone} />
            <span className="font-medium">{x.label}</span>
          </Card>
        ))}
      </div>

      <Card className="space-y-4">
        <CardTitle>Frequently asked questions</CardTitle>
        <div className="divide-y divide-white/5">
          {faqs.map((f) => (
            <div key={f.q} className="py-3">
              <p className="font-medium">{f.q}</p>
              <p className="mt-1 text-sm text-slate-500">{f.a}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex items-center gap-3">
        <Mail className="text-brand-500" />
        <div>
          <p className="font-medium">Need more help?</p>
          <p className="text-sm text-slate-500">Contact an administrator for account, payment or verification issues.</p>
        </div>
      </Card>
    </div>
  );
}
