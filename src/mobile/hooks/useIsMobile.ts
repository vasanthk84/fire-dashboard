import { useEffect, useState } from 'react';

/**
 * True when the viewport is narrower than `breakpoint` (default 920px, per
 * the mobile handoff's "<920px" rule). Uses matchMedia so it updates live if
 * the window is resized across the breakpoint, letting App.tsx swap shells
 * without losing any planner state (both shells share the same hooks).
 */
export function useIsMobile(breakpoint = 920): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return isMobile;
}
