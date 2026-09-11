import React, { useEffect, useRef, useState } from 'react';

interface ScreenTransitionProps {
  /** Identifies which screen is active — changing this triggers the slide. */
  screenKey: string;
  /** +1 slides the incoming screen in from the right (a "later" tab in the nav bar), -1 from the left. */
  direction: number;
  children: React.ReactNode;
}

const DURATION_MS = 1000;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Slides between screens toward the direction the destination tab sits in
 * the nav bar relative to the one being left — a tab further down/right in
 * NAV_ITEMS slides the new screen in from the right (and the old one exits
 * left); an earlier tab does the reverse.
 *
 * The active screen always renders the live `children` prop directly, so
 * store/data updates while sitting on one tab show up immediately. Only the
 * *outgoing* screen is a frozen snapshot — just enough to slide it off —
 * then it's dropped so it can't affect scroll height once gone.
 */
export const ScreenTransition: React.FC<ScreenTransitionProps> = ({ screenKey, direction, children }) => {
  const [outgoing, setOutgoing] = useState<{ node: React.ReactNode; dir: number } | null>(null);
  const [settled, setSettled] = useState(true);
  // Latest children rendered under the *previous* key, so when the key
  // changes we have something to show sliding out (captured before it's
  // overwritten below).
  const lastForKeyRef = useRef<{ key: string; node: React.ReactNode }>({ key: screenKey, node: children });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastForKeyRef.current.key === screenKey) {
      lastForKeyRef.current = { key: screenKey, node: children };
      return;
    }

    if (prefersReducedMotion()) {
      lastForKeyRef.current = { key: screenKey, node: children };
      return;
    }

    setOutgoing({ node: lastForKeyRef.current.node, dir: direction });
    setSettled(false);
    lastForKeyRef.current = { key: screenKey, node: children };

    // Double rAF: paint the start position with transitions off first, then
    // flip to the resting position with transitions on — otherwise the very
    // first frame has nothing to animate from.
    const raf1 = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setSettled(true));
    });
    const cleanupTimer = window.setTimeout(() => setOutgoing(null), DURATION_MS + 60);

    return () => {
      cancelAnimationFrame(raf1);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(cleanupTimer);
    };
  }, [screenKey, direction, children]);

  return (
    <div className="relative w-full">
      {outgoing && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 w-full"
          style={{
            transform: settled ? `translateX(${-outgoing.dir * 100}%)` : 'translateX(0)',
            transition: settled ? `transform ${DURATION_MS}ms ${EASING}` : 'none',
            willChange: 'transform'
          }}
        >
          {outgoing.node}
        </div>
      )}
      <div
        style={{
          transform: settled ? 'translateX(0)' : `translateX(${direction * 100}%)`,
          transition: settled ? `transform ${DURATION_MS}ms ${EASING}` : 'none',
          willChange: 'transform'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ScreenTransition;
