"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import type { ChartPoint } from "@/lib/data";

// Horizontal bar rows — the content-type / CEFR / orientation / item-type /
// answer-coverage / cost breakdowns.
//
// Previously an ECharts bar series. It is now plain DOM: a three-column grid
// of label, track, value. The reasons are the same as for the donut (see
// charts/donut.tsx) — the fill is a CSS gradient token, so it repaints on a
// theme change with no JavaScript at all, and the whole thing server-renders
// instead of waiting on a dynamic import.
//
// Long-tail collapse: a chart with many rows (an 18-tag content-type
// breakdown) is hard to scan — keep the top TOP_N individually and fold the
// remainder into one deemphasised "Other" row. Purely row-count driven, so
// the single-digit charts elsewhere on the site render exactly as before.
// Unlike the old tooltip, the folded rows are now *disclosable*: the ECharts
// hover tooltip that listed them was unreachable on touch.
const TOP_N = 8;
const COLLAPSE_THRESHOLD = TOP_N + 2;
const STAGGER_MS = 45;

interface Row extends ChartPoint {
  isOther?: boolean;
  otherTags?: ChartPoint[];
}

function useRevealed() {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, revealed };
}

export function BarChart({
  data,
  gradient,
  valuesArePercent = false,
}: {
  data: ChartPoint[];
  /** The cost chart's flag-to-brand fill, marking "expensive → cheap". */
  gradient?: "cost";
  /** Set when `v` is already a percentage (the cost breakdown sums to 100) —
   * labels then print "v%" rather than deriving a percent-of-total, which
   * would just restate the same number. */
  valuesArePercent?: boolean;
}) {
  const { ref, revealed } = useRevealed();
  const [openOther, setOpenOther] = useState(false);

  if (!data.length) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border-strong text-sm text-text-subtle">
        No data yet
      </div>
    );
  }

  // Descending — the largest bar reads first, at the top.
  const descending = [...data].sort((a, b) => b.v - a.v);
  let rows: Row[] = descending;
  if (descending.length > COLLAPSE_THRESHOLD) {
    const kept = descending.slice(0, TOP_N);
    const collapsed = descending.slice(TOP_N);
    rows = [
      ...kept,
      {
        k: `Other (${collapsed.length} tags)`,
        v: collapsed.reduce((s, d) => s + d.v, 0),
        isOther: true,
        otherTags: collapsed,
      },
    ];
  }

  const total = data.reduce((s, d) => s + d.v, 0) || 1; // true total — % stays accurate once collapsed
  const max = Math.max(...rows.map((d) => d.v)) || 1;
  const fill =
    gradient === "cost"
      ? "linear-gradient(90deg, var(--flag), var(--brand-500))"
      : "var(--grad-brand-90)";

  const valueLabel = (v: number) =>
    valuesArePercent ? `${v}%` : `${v.toLocaleString()}`;

  return (
    <div ref={ref} className="flex flex-col gap-2.5">
      {rows.map((d, i) => {
        const width = revealed ? `${Math.max((d.v / max) * 100, 1.5)}%` : "0%";
        const pct = Math.round((d.v / total) * 100);
        const body = (
          <>
            <span
              className="min-w-0 truncate text-left text-xs text-text-muted sm:text-sm"
              title={d.k}
            >
              {d.k}
              {d.isOther && (
                <span
                  aria-hidden="true"
                  className={"ml-1 inline-flex transition-transform " + (openOther ? "rotate-90" : "")}
                >
                  <Icon name="chevron" size={11} />
                </span>
              )}
            </span>
            <span className="h-3 min-w-0 overflow-hidden rounded-sm bg-chart-track">
              <span
                className="bar-fill block h-full rounded-sm"
                style={{
                  width,
                  background: d.isOther ? "var(--brand-300)" : fill,
                  ["--bar-delay" as string]: `${i * STAGGER_MS}ms`,
                }}
              />
            </span>
            <span className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-text-muted">
              {valueLabel(d.v)}
              {!valuesArePercent && <span className="ml-1.5 text-text-subtle">{pct}%</span>}
            </span>
          </>
        );

        return (
          <div key={d.k} className="flex flex-col gap-2">
            {d.isOther ? (
              <button
                type="button"
                onClick={() => setOpenOther((s) => !s)}
                aria-expanded={openOther}
                className="grid grid-cols-[minmax(64px,26%)_1fr_auto] items-center gap-3 rounded-sm text-left hover:opacity-80"
              >
                {body}
              </button>
            ) : (
              <div className="grid grid-cols-[minmax(64px,26%)_1fr_auto] items-center gap-3">{body}</div>
            )}
            {d.isOther && openOther && (
              <ul className="ml-1 flex flex-col gap-1 border-l border-border pl-3 text-xs text-text-subtle">
                {[...(d.otherTags || [])]
                  .sort((a, b) => b.v - a.v)
                  .map((t) => (
                    <li key={t.k} className="flex items-baseline justify-between gap-3">
                      <span className="truncate">{t.k}</span>
                      <span className="shrink-0 font-mono tabular-nums">{t.v.toLocaleString()}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
