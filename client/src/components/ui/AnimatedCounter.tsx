import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  /** Format the animated value (e.g. currency). */
  format?: (n: number) => string;
  duration?: number;
  decimals?: number;
}

/** Counts up to `value` with an ease-out curve when it enters/changes. */
export function AnimatedCounter({ value, format, duration = 900, decimals = 0 }: Props) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const from = fromRef.current;
    const delta = value - from;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + delta * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  const rounded = decimals ? Number(display.toFixed(decimals)) : Math.round(display);
  return <>{format ? format(rounded) : rounded.toLocaleString('en-IN')}</>;
}
