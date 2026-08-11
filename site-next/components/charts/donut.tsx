"use client";

import { useEffect, useRef, useState } from "react";

export interface DonutSegment {
  label: string;
  value: number;
  /** Any CSS color — in practice always a design token, e.g. "var(--verified)". */
  color: string;
}

// One SVG donut, shared by the QA split and the Engine cost breakdown.
//
// This replaces an ECharts pie. ECharts was ~820 KB of the bundle and every
// chart on the site only ever drew a pie or a horizontal bar, neither of
// which needs a charting engine. Two things fall out of doing it in SVG:
//
//  1. Colors are CSS custom properties, so a theme change repaints the chart
//     for free. The ECharts version had to re-read the tokens off the DOM and
//     call setOption(option, true) on every instance in response to a
//     `lt:themechange` event -- a full chart re-init that made the theme
//     toggle the single slowest interaction on the site (537ms). That whole
//     mechanism (lib/chart-tokens.ts, the event, the listener) is now gone.
//  2. It server-renders. The ECharts canvas could only appear after the
//     dynamic import resolved, so every chart was a skeleton on first paint.
//
// Geometry: pathLength="100" normalises the circumference to 100 units, so a
// segment's stroke-dasharray is literally its percentage -- no 2*pi*r math,
// and no drift when the radius changes.
export function Donut({
  segments,
  size = 168,
  thickness = 0.19,
  ariaLabel,
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  /** Ring width as a fraction of the diameter. */
  thickness?: number;
  ariaLabel: string;
  /** Centre overlay (the big percentage, usually). */
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const total = segments.reduce((s, x) => s + x.value, 0);
  const stroke = size * thickness;
  const radius = (size - stroke) / 2;

  // Running start offset per segment, in the same normalised 0–100 units.
  let cursor = 0;
  const arcs = segments.map((seg) => {
    const pct = total ? (seg.value / total) * 100 : 0;
    const start = cursor;
    cursor += pct;
    return { ...seg, pct, start };
  });

  return (
    <div
      ref={ref}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Track — also the empty state when there is no data at all. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--chart-track)"
          strokeWidth={stroke}
        />
        {arcs.map((a) =>
          a.pct <= 0 ? null : (
            <circle
              key={a.label}
              className="donut-arc"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              pathLength={100}
              strokeDasharray={shown ? `${a.pct} ${100 - a.pct}` : "0 100"}
              strokeDashoffset={-a.start}
            >
              <title>{`${a.label}: ${a.value.toLocaleString()} (${Math.round(a.pct)}%)`}</title>
            </circle>
          )
        )}
      </svg>
      {children && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
