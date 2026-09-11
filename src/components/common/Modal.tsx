import React, { useEffect, useId, useRef } from 'react';
import { X } from '@phosphor-icons/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Width preset — defaults to `md`. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional extra controls rendered next to the close button. */
  headerActions?: React.ReactNode;
  /**
   * Hide the header's `X` button — for a modal that's meant to be a hard
   * stop (e.g. a gate the user must complete), so there's no dead-looking
   * control sitting next to a no-op `onClose`. ESC and backdrop click still
   * call `onClose` as normal; pass a no-op there too if it must stay open.
   */
  hideCloseButton?: boolean;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl'
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible centered dialog: dimmed + blurred backdrop, `role="dialog"`,
 * `aria-modal`, labelled by its title, ESC to close, body scroll-lock,
 * a Tab focus-trap, and focus restore to the trigger on close.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  headerActions,
  hideCloseButton = false
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const labelId = useId();

  // Focus trap + ESC + focus restore
  useEffect(() => {
    if (!isOpen) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const getItems = () =>
      panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            el => el.offsetParent !== null || el === document.activeElement
          )
        : [];

    // Focus the first focusable element (fall back to the panel itself)
    const initial = getItems()[0];
    (initial || panel)?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;

      const items = getItems();
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      restoreFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  // Body scroll-lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        className={`relative z-10 w-full ${SIZE_CLASS[size]} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200 focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex-shrink-0">
          <div className="min-w-0">
            <h2
              id={labelId}
              className="font-heading font-bold text-[17px] text-slate-900 dark:text-white"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-[12px] font-sans text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerActions}
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 overscroll-contain">{children}</div>
      </div>
    </div>
  );
};
