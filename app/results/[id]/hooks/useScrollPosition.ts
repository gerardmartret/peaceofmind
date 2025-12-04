/**
 * useScrollPosition Hook
 * 
 * Tracks the current scroll position of the window.
 * Used for sticky headers and conditional styling based on scroll.
 */

import { useState, useEffect } from 'react';

export interface UseScrollPositionReturn {
  scrollY: number;
}

/**
 * Hook to track window scroll position
 * @returns Current vertical scroll position in pixels
 */
export function useScrollPosition(): UseScrollPositionReturn {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return { scrollY };
}

