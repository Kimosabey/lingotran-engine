"use client";

import { Donut } from "@/components/charts/donut";
import type { ChartPoint } from "@/lib/data";

// The Engine page's usage-window donut. The legend is a real list rather than
// leader-lined labels around the ring: six slices with names as long as
// "QA (2nd image read)" never laid out cleanly around a circle, and the list
// carries the exact percentage as text next to each swatch anyway.
const PALETTE = [
  "var(--brand-500)",
  "var(--brand-700)",
  "var(--flag)",
  "var(--amber)",
  "var(--brand-300)",
  "var(--verified)",
];

export function CostDonut({ data }: { data: ChartPoint[] }) {
  const segments = data.map((c, i) => ({
    label: c.k,
    value: c.v,
    color: PALETTE[i % PALETTE.length],
  }));
  const top = [...data].sort((a, b) => b.v - a.v)[0];

  return (
    <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center sm:gap-9">
      <Donut
        segments={segments}
        size={220}
        thickness={0.26}
        ariaLabel={
          "Share of the usage window by activity: " +
          data.map((c) => `${c.k} ${c.v}%`).join(", ")
        }
      >
        <span className="font-display text-2xl font-medium text-text">{top?.v}%</span>
        <span className="max-w-[92px] text-center text-[10px] leading-tight text-text-subtle">
          {top?.k}
        </span>
      </Donut>
      <ul className="flex min-w-0 flex-1 flex-col gap-2.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-baseline gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="min-w-0 flex-1 text-text-muted">{s.label}</span>
            <b className="shrink-0 font-mono text-sm tabular-nums text-text">{s.value}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
