import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle, XCircle, WarningCircle, Info, X } from '@phosphor-icons/react';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  /** Pops a small banner at the top of the screen — never buried in page scroll. */
  showToast: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLE: Record<ToastKind, { Icon: typeof CheckCircle; cls: string }> = {
  success: { Icon: CheckCircle, cls: 'bg-emerald-600 text-white' },
  error: { Icon: XCircle, cls: 'bg-rose-600 text-white' },
  warning: { Icon: WarningCircle, cls: 'bg-amber-500 text-slate-950' },
  info: { Icon: Info, cls: 'bg-slate-800 dark:bg-slate-700 text-white' }
};

const AUTO_DISMISS_MS: Record<ToastKind, number> = {
  success: 3500,
  info: 3500,
  warning: 5500,
  error: 6500
};

/**
 * App-wide toast host — mount once at the root. Every screen used to show
 * success/error feedback as a message sitting inline wherever the form
 * happened to be, which is invisible the moment the user has scrolled away
 * from it. This renders fixed to the top of the viewport instead, so
 * feedback is seen regardless of scroll position or which screen triggered it.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current;
      setToasts(prev => [...prev, { id, kind, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS[kind]);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed top-3 sm:top-4 inset-x-0 z-[300] flex flex-col items-center gap-2 px-3 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map(t => {
          const { Icon, cls } = KIND_STYLE[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto w-full sm:w-auto max-w-md flex items-start gap-2 pl-3.5 pr-2.5 py-2.5 rounded-xl shadow-2xl text-[13px] font-sans font-semibold animate-in fade-in slide-in-from-top-3 duration-200 ${cls}`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0 mt-px" weight="bold" />
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 p-0.5 rounded-md opacity-70 hover:opacity-100 hover:bg-black/10 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
