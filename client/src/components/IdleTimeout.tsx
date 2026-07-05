import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

const IDLE_MS = 30 * 60 * 1000; // 30 minutes

/** Logs the user out after a period of inactivity (security: session timeout). */
export function IdleTimeout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!user) return;
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        logout();
        toast.message('Signed out due to inactivity.');
        navigate('/login');
      }, IDLE_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user, logout, navigate]);

  return null;
}
