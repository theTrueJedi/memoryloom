import { useState, useEffect } from 'react';

/**
 * Hook to detect if the user is on a mobile device.
 * Uses a combination of viewport width and touch capability.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= breakpoint || 'ontouchstart' in window;
  });

  useEffect(() => {
    const checkMobile = () => {
      const isNarrow = window.innerWidth <= breakpoint;
      const hasTouch = 'ontouchstart' in window;
      setIsMobile(isNarrow || hasTouch);
    };

    // Check on mount
    checkMobile();

    // Listen for resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}
