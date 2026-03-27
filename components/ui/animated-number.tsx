'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

/**
 * Smoothly animates a number from its previous value to a new one
 * using requestAnimationFrame — no external dependencies.
 * Easing: ease-out-cubic for natural deceleration.
 */
export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number | null>(null);
  const startRef = useRef(value);
  const endRef = useRef(value);

  useEffect(() => {
    if (endRef.current === value) return;

    const from = startRef.current = display;
    const to = endRef.current = value;
    const duration = 500;
    const startTime = performance.now();

    if (raf.current !== null) cancelAnimationFrame(raf.current);

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        raf.current = null;
      }
    }

    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Keep startRef in sync after each successful render
  useEffect(() => { startRef.current = display; }, [display]);

  return <span className={className}>{display}</span>;
}
