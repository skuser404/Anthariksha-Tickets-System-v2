import { useEffect, useRef, useState } from 'react';

/**
 * "Sign in with Google" using Google Identity Services.
 *
 * The script is loaded on demand rather than in index.html so the landing page
 * does not pay for it, and so the button simply does not render when no client
 * id is configured (rather than showing a control that cannot work).
 */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SRC = 'https://accounts.google.com/gsi/client';

function loadScript(): Promise<void> {
  if (document.querySelector(`script[src="${SRC}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
}

export function GoogleSignIn({ onCredential, disabled }: { onCredential: (c: string) => void; disabled?: boolean }) {
  const holder = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || !holder.current) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !window.google || !holder.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => onCredential(r.credential),
        });
        window.google.accounts.id.renderButton(holder.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'signin_with',
          shape: 'pill',
        });
      })
      .catch(() => !cancelled && setFailed(true));

    return () => { cancelled = true; };
  }, [clientId, onCredential]);

  // Nothing configured, or Google is unreachable: stay silent so the password
  // form remains the obvious path instead of showing a dead button.
  if (!clientId || failed) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
        or
        <span className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
      </div>
      <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
        <div ref={holder} className="flex justify-center" />
      </div>
    </div>
  );
}
