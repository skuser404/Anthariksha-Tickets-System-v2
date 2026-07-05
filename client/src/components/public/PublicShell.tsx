import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

const APP_VERSION = '1.0.0';

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <PublicNav />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}

export function PublicNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Antariksha" className="h-8 w-8 rounded-lg object-contain" />
          <span className="font-bold">Antariksha</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 dark:text-slate-300 md:flex">
          <a href="/#features" className="hover:text-slate-900 dark:hover:text-white">Features</a>
          <a href="/#how" className="hover:text-slate-900 dark:hover:text-white">How it works</a>
          <a href="/#faq" className="hover:text-slate-900 dark:hover:text-white">FAQ</a>
          <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            Member Login
          </Link>
          <Link to="/login?admin=1" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            Admin Login
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-6 w-6 rounded object-contain" />
          <span>© {new Date().getFullYear()} Antariksha Trek Operations</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy</Link>
          <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
          <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white">Support</Link>
          <span className="text-xs text-slate-400">v{APP_VERSION}</span>
        </div>
      </div>
    </footer>
  );
}
