import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface Msg { role: 'user' | 'ai'; text: string }

/** Floating AI operations assistant — admin only. Intent-based NL Q&A. */
export function AiAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'ai', text: "Hi! Ask me about today's activity, top earners, overdue refunds, pending approvals, or balances." },
  ]);

  const { data: suggestions } = useQuery({
    enabled: open,
    queryKey: ['ai-suggestions'],
    queryFn: async () => (await api.get('/intel/assistant/suggestions')).data.data as string[],
  });

  if (user?.role !== 'admin') return null;

  async function send(question: string) {
    if (!question.trim()) return;
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setBusy(true);
    try {
      const res = await api.post('/intel/assistant/ask', { question });
      setMessages((m) => [...m, { role: 'ai', text: res.data.data.answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: apiError(e) }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[70] grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-white shadow-md transition hover:bg-brand-700 lg:bottom-8 lg:right-8"
        aria-label="AI assistant"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="glass fixed bottom-24 right-6 z-[70] flex h-[28rem] w-[22rem] flex-col overflow-hidden p-0 lg:right-8"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-600 text-white"><Sparkles size={16} /></span>
              <div>
                <p className="text-sm font-bold leading-tight">Operations Assistant</p>
                <p className="text-[10px] text-slate-500">Answers from live data</p>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-white/10'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {busy && <div className="flex justify-start"><div className="rounded-2xl bg-white/10 px-3 py-2"><Loader2 className="animate-spin" size={14} /></div></div>}

              {messages.length <= 1 && (
                <div className="space-y-1.5 pt-2">
                  {suggestions?.slice(0, 4).map((s) => (
                    <button key={s} onClick={() => send(s)} className="block w-full rounded-xl border border-white/10 px-3 py-1.5 text-left text-xs text-slate-500 hover:border-brand-500 hover:text-brand-500">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form className="flex items-center gap-2 border-t border-white/10 p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" className="h-9 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none" />
              <button type="submit" disabled={busy || !input.trim()} className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white disabled:opacity-50">
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
