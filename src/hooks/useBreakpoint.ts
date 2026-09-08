import { useState, useEffect } from 'react';

/**
 * Hook to detect whether the viewport width is >= 900px (Desktop / Tablet Landscape).
 * Synchronized with Tailwind `split: 900px` breakpoint.
 */
export function useIsDesktopSplit(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 900;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 900px)');
    setIsDesktop(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, []);

  return isDesktop;
}
