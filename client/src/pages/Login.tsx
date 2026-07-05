import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mountain, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Input, Label } from '@/components/ui';

export default function LoginPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const [challengeToken, setChallengeToken] = useState('');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Simple math CAPTCHA shown after repeated failures (defense-in-depth; the API
  // also rate-limits and locks accounts).
  const [failCount, setFailCount] = useState(0);
  const [captcha, setCaptcha] = useState(() => ({ a: 1 + Math.floor(Math.random() * 8), b: 1 + Math.floor(Math.random() * 8) }));
  const [captchaInput, setCaptchaInput] = useState('');
  const captchaRequired = failCount >= 3;
  const newCaptcha = () => { setCaptcha({ a: 1 + Math.floor(Math.random() * 8), b: 1 + Math.floor(Math.random() * 8) }); setCaptchaInput(''); };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function finalize(data: any) {
    setSession(data.user, data.accessToken, data.refreshToken);
    toast.success(`Welcome back, ${data.user.name}!`);
    navigate('/');
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    if (captchaRequired && Number(captchaInput) !== captcha.a + captcha.b) {
      toast.error('Please solve the verification question.');
      newCaptcha();
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const data = res.data.data;
      setFailCount(0);
      if (data.twoFactorRequired) {
        setChallengeToken(data.challengeToken);
        setStage('otp');
        setCooldown(60);
        toast.message('A 6-digit code was sent to your email.', {
          description: 'Dev mode: check the API server console for the code.',
        });
      } else {
        finalize(data);
      }
    } catch (err) {
      setFailCount((c) => c + 1);
      newCaptcha();
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function onOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { challengeToken, code: otp });
      finalize(res.data.data);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    try {
      await api.post('/auth/resend-otp', { challengeToken });
      setCooldown(60);
      toast.success('A new code was sent.');
    } catch (err) {
      toast.error(apiError(err));
    }
  }

  return (
    <div className="app-bg grid min-h-screen place-items-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-md p-8"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo.png" alt="Antariksha" className="mb-3 h-14 w-14 rounded-2xl object-contain" />
          <h1 className="text-xl font-bold">Antariksha Trek Operations</h1>
          <p className="text-sm text-slate-500">Commission Management Portal</p>
          <Link to="/" className="mt-2 text-xs text-brand-500 hover:underline">← Back to home</Link>
        </div>

        <AnimatePresence mode="wait">
          {stage === 'password' ? (
            <motion.form
              key="pw"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              onSubmit={onPassword}
              className="space-y-4"
            >
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@antariksha.test"
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-500">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Remember me
                </label>
                <button type="button" className="text-brand-500 hover:underline" onClick={() => toast.message('Contact an admin to reset your password.')}>
                  Forgot password?
                </button>
              </div>
              {captchaRequired && (
                <div>
                  <Label>Verification — what is {captcha.a} + {captcha.b}?</Label>
                  <Input
                    inputMode="numeric"
                    required
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Answer"
                  />
                </div>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" size={16} />} Sign in
              </Button>
            </motion.form>
          ) : (
            <motion.form
              key="otp"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              onSubmit={onOtp}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 rounded-xl bg-brand-500/10 p-3 text-sm text-brand-500">
                <ShieldCheck size={18} /> Two-factor verification required for admins.
              </div>
              <div>
                <Label>Enter the 6-digit code</Label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="text-center text-lg tracking-[0.5em]"
                  autoFocus
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading || otp.length < 6}>
                {loading && <Loader2 className="animate-spin" size={16} />} Verify & continue
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" className="inline-flex items-center gap-1 text-slate-500 hover:underline" onClick={() => setStage('password')}>
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  type="button"
                  disabled={cooldown > 0}
                  onClick={resend}
                  className="text-brand-500 enabled:hover:underline disabled:opacity-50"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="mt-6 text-center text-xs text-slate-400">
          Private internal portal · Accounts are created by administrators
        </p>
      </motion.div>
    </div>
  );
}
