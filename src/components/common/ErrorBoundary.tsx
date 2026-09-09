import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time crashes anywhere below it and shows a plain recovery card
 * instead of a blank white screen. State is local-only (localStorage), so a
 * reload is the safe recovery path.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 text-center">
            <h2 className="text-[16px] font-heading font-bold text-slate-900 dark:text-white">
              Something went wrong. Reload the app.
            </h2>
            <p className="mt-2 text-[13px] font-sans text-slate-500 dark:text-slate-400">
              The screen hit an unexpected error. Your saved data is safe on this device.
            </p>
            <button
              type="button"
              onClick={() => location.reload()}
              className="mt-4 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-[13px] font-sans font-bold transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
