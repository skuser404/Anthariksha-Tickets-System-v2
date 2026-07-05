import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Loader2, Receipt, Send, Info } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button, Card, CardTitle, Input, Label, Select, Skeleton, Textarea } from '@/components/ui';
import { formatDate, inr } from '@/lib/utils';

interface Member { id: string; full_name: string; email: string }
interface Financial { member_id: string; full_name: string; total_earned: number; total_paid: number; balance: number }
interface Payment { id: string; amount: number; payment_date: string; method: string; reference_number: string | null; receipt_no: string; member?: { full_name: string } }

const METHODS = [
  { v: 'upi', l: 'UPI' },
  { v: 'bank_transfer', l: 'Bank Transfer' },
  { v: 'cash', l: 'Cash' },
  { v: 'cheque', l: 'Cheque' },
  { v: 'other', l: 'Other' },
];

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ memberId: '', amount: '', paymentDate: new Date().toISOString().slice(0, 10), method: 'upi', referenceNumber: '', remarks: '' });

  const { data: members } = useQuery({ queryKey: ['members'], queryFn: async () => (await api.get('/users/members')).data.data as Member[] });
  const { data: financials, isLoading: finLoading } = useQuery({ queryKey: ['financials'], queryFn: async () => (await api.get('/payments/financials')).data.data as Financial[] });
  const { data: payments } = useQuery({ queryKey: ['payments-all'], queryFn: async () => (await api.get('/payments')).data.data as { items: Payment[] } });

  const selectedBalance = financials?.find((f) => f.member_id === form.memberId)?.balance;

  const pay = useMutation({
    mutationFn: async () =>
      api.post('/payments', {
        memberId: form.memberId,
        amount: Number(form.amount),
        paymentDate: form.paymentDate,
        method: form.method,
        referenceNumber: form.referenceNumber || undefined,
        remarks: form.remarks || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['financials'] });
      qc.invalidateQueries({ queryKey: ['payments-all'] });
      toast.success(`Payment recorded · Receipt ${res.data.data.receipt_no}`);
      setForm((f) => ({ ...f, amount: '', referenceNumber: '', remarks: '' }));
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Wallet className="text-teal-500" />
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-slate-500">Record commission payouts and track member balances.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400">
        <Info size={14} className="mt-0.5 shrink-0" />
        This records payments you made <span className="font-medium">outside the app</span> (cash, UPI, bank transfer, etc.).
        It only updates calculations and balances — no money is transferred by this application.
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* Record payment */}
        <Card className="space-y-4">
          <CardTitle>Record a payment</CardTitle>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.memberId || !form.amount) return toast.error('Select a member and amount');
              pay.mutate();
            }}
          >
            <div>
              <Label>Member *</Label>
              <Select required value={form.memberId} onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}>
                <option value="">Select member…</option>
                {members?.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name} — {m.email}</option>
                ))}
              </Select>
              {form.memberId && selectedBalance !== undefined && (
                <p className="mt-1 text-xs text-slate-500">Outstanding balance: <span className="font-semibold text-violet-500">{inr(selectedBalance)}</span></p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (₹) *</Label>
                <Input required type="number" min={1} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>Payment date *</Label>
                <Input required type="date" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
              </div>
              <div>
                <Label>Method</Label>
                <Select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
                  {METHODS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                </Select>
              </div>
              <div>
                <Label>Reference no.</Label>
                <Input value={form.referenceNumber} onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))} placeholder="UTR / txn id" />
              </div>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
            <Button type="submit" className="w-full" disabled={pay.isPending}>
              {pay.isPending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Record Payment
            </Button>
          </form>
        </Card>

        {/* Member balances */}
        <Card className="space-y-3">
          <CardTitle>Member balances</CardTitle>
          {finLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Member</th>
                    <th className="px-2 py-2 text-right">Earned</th>
                    <th className="px-2 py-2 text-right">Paid</th>
                    <th className="px-2 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {financials?.map((f) => (
                    <tr key={f.member_id} className="hover:bg-white/5">
                      <td className="px-2 py-2.5 font-medium">{f.full_name}</td>
                      <td className="px-2 py-2.5 text-right text-emerald-500">{inr(f.total_earned)}</td>
                      <td className="px-2 py-2.5 text-right text-teal-500">{inr(f.total_paid)}</td>
                      <td className="px-2 py-2.5 text-right font-semibold text-violet-500">{inr(f.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Recent payments */}
      <Card className="space-y-3">
        <CardTitle className="flex items-center gap-2"><Receipt size={15} /> Recent payments</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Receipt</th>
                <th className="px-2 py-2">Member</th>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Method</th>
                <th className="px-2 py-2">Reference</th>
                <th className="px-2 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payments?.items.map((p) => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="px-2 py-2.5 font-mono text-xs">{p.receipt_no}</td>
                  <td className="px-2 py-2.5">{p.member?.full_name}</td>
                  <td className="px-2 py-2.5 text-slate-500">{formatDate(p.payment_date)}</td>
                  <td className="px-2 py-2.5 capitalize">{p.method.replace('_', ' ')}</td>
                  <td className="px-2 py-2.5 text-slate-500">{p.reference_number ?? '—'}</td>
                  <td className="px-2 py-2.5 text-right font-semibold">{inr(p.amount)}</td>
                </tr>
              ))}
              {(payments?.items.length ?? 0) === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">No payments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
