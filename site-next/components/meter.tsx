"use client";

import { useEffect, useRef, useState } from "react";
import type { BookMeter } from "@/lib/data";

// Simple linear progress bar -- deliberately NOT an ECharts instance (see the
// site-migration plan's explicit exception): a plain fill/track pair reads
// better as a meter than as a "chart" instance. Ported reveal-on-scroll fill
// animation from render.js's animateFills(), respecting prefers-reduced-motion.
function useRevealed() {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      // Synchronous reveal is intentional: skip the scroll-triggered animation
      // entirely rather than momentarily rendering an empty bar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed };
}

export function Meter({ name, value, of, cls, unit = "spreads" }: BookMeter & { unit?: string }) {
  const { ref, revealed } = useRevealed();
  const pct = of ? Math.round((value / of) * 100) : 0;
  const verified = cls === "green" || cls === "f-verified";

  return (
    <div ref={ref} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-text">{name}</span>
        <span className={verified ? "font-semibold text-verified-strong" : "font-semibold text-text"}>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-chart-track">
        <div
          className={
            "h-full rounded-full transition-[width] duration-700 ease-out " +
            (verified ? "bg-verified" : "bg-brand-500")
          }
          style={{ width: revealed ? `${pct}%` : "0%" }}
        />
      </div>
      <div className="text-xs text-text-subtle">
        {value.toLocaleString()} of {of.toLocaleString()} {unit}
      </div>
    </div>
  );
}
