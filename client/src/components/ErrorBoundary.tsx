import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';

interface State { hasError: boolean; message?: string }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : 'Something went wrong' };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('UI error boundary caught:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="app-bg grid min-h-screen place-items-center p-4">
        <div className="glass max-w-md p-10 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-rose-500/15 text-rose-500">
            <AlertTriangle size={30} />
          </div>
          <h1 className="text-2xl font-bold">Something broke</h1>
          <p className="mt-1 text-sm text-slate-500">{this.state.message}</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Reload
          </Button>
        </div>
      </div>
    );
  }
}
