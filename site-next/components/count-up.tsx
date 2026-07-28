"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const SIMPLE_INT = /^[\d,]+$/;
const PERCENT_INT = /^(\d+)%$/;

interface Animatable {
  target: number;
  format: (n: number) => string;
}

// Only animates values whose shape we can reformat mid-count without
// guessing -- a bare number, a comma-grouped integer string ("1,147"), or
// a plain integer percentage ("96%"). Anything else (units mixed with
// separate text, decimals, ranges, ...) renders as static text, unchanged.
function parseAnimatable(value: string | number): Animatable | null {
  if (typeof value === "number") {
    return { target: value, format: (n) => Math.round(n).toLocaleString() };
  }
  if (SIMPLE_INT.test(value)) {
    const target = parseInt(value.replace(/,/g, ""), 10);
    return Number.isNaN(target) ? null : { target, format: (n) => Math.round(n).toLocaleString() };
  }
  const pct = value.match(PERCENT_INT);
  if (pct) {
    const target = parseInt(pct[1], 10);
    return { target, format: (n) => `${Math.round(n)}%` };
  }
  return null;
}

export function CountUp({ value, durationMs = 900 }: { value: string | number; durationMs?: number }) {
  const parsed = useMemo(() => parseAnimatable(value), [value]);
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState<string | number>(value);

  useEffect(() => {
    if (!parsed) return;
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(parsed.format(parsed.target));
      return;
    }

    setDisplay(parsed.format(0));
    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic, matches --ease-out's feel
          setDisplay(parsed.format(parsed.target * eased));
          if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [parsed, durationMs]);

  return <span ref={ref}>{parsed ? display : value}</span>;
}
