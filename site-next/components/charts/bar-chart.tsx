"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart, useChartTokens, useEcharts } from "@/components/echart";
import type { ChartPoint } from "@/lib/data";

// Horizontal bar rows -- replaces the static site's hand-rolled .bar-row DOM
// (content-type / CEFR / orientation / answer-coverage breakdowns). Every
// bar chart on the static site fills with the same brand gradient
// (--grad-brand-90) except the cost chart's flag-to-brand gradient -- no
// page ever passes a custom fill class, so this component doesn't expose one.

// Long-tail collapse: a chart with many rows (e.g. an 18-tag content-type
// breakdown) is hard to scan -- keep the top TOP_N individually and fold the
// remainder into one deemphasized "Other" row. This is purely row-count
// driven (no per-caller opt-in), so the other bar charts on the same page
// (answerCoverage, cefr, orientation -- all single digits) and elsewhere on
// the site (German item types at 10 rows, the Engine cost chart at 6) never
// cross the threshold and render exactly as before.
const TOP_N = 8;
const COLLAPSE_THRESHOLD = TOP_N + 2;

interface DisplayPoint extends ChartPoint {
  isOther?: boolean;
  otherTags?: ChartPoint[];
}

export function BarChart({
  data,
  gradient,
  height,
  valuesArePercent = false,
}: {
  data: ChartPoint[];
  /** Ports the cost chart's flag-to-brand-500 gradient fill. */
  gradient?: "cost";
  height?: number;
  /** Set when `v` is already a percentage (e.g. the cost breakdown, which
   * sums to 100) -- labels then show "v%" as printed, instead of deriving
   * a percent-of-total (which would just restate the same number). */
  valuesArePercent?: boolean;
}) {
  const tokens = useChartTokens();
  const echarts = useEcharts();

  const rowCount = data.length > COLLAPSE_THRESHOLD ? TOP_N + 1 : data.length;

  const option = useMemo<EChartsOption | null>(() => {
    if (!tokens || !echarts || !data.length) return null;
    // Ascending sort -- ECharts renders a category yAxis bottom-to-top, so
    // the last (largest) entry lands at the top of the chart. Verified
    // visually against the rendered page; do not flip this to descending.
    const ascending = [...data].sort((a, b) => a.v - b.v);

    let display: DisplayPoint[] = ascending;
    if (ascending.length > COLLAPSE_THRESHOLD) {
      const kept = ascending.slice(ascending.length - TOP_N); // largest N, still ascending
      const collapsed = ascending.slice(0, ascending.length - TOP_N); // long tail
      const otherPoint: DisplayPoint = {
        k: `Other (${collapsed.length} tags)`,
        v: collapsed.reduce((s, d) => s + d.v, 0),
        isOther: true,
        otherTags: collapsed,
      };
      // Pinned as the very first (= bottom-most) row -- an aggregate, not a
      // ranked entry, so it reads as a footnote rather than competing on value.
      display = [otherPoint, ...kept];
    }

    const total = data.reduce((s, d) => s + d.v, 0) || 1; // true total -- % stays accurate once collapsed
    const maxVal = Math.max(...display.map((d) => d.v));
    const fill =
      gradient === "cost"
        ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: tokens.flag },
            { offset: 1, color: tokens.brand500 },
          ])
        : new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: tokens.brand700 },
            { offset: 1, color: tokens.brand500 },
          ]);
    // Flat, muted fill for the "Other" bucket -- visually distinct from the
    // vivid ranked-bar gradient, signalling "aggregate" rather than "ranked".
    const otherFill = tokens.brand300;

    return {
      backgroundColor: "transparent",
      textStyle: { fontFamily: tokens.fontFamily, color: tokens.text },
      grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "item",
        confine: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (p: any) => {
          const tags: ChartPoint[] | undefined = p.data && p.data.otherTags;
          if (!tags) return `${p.name}: ${p.value}`;
          const lines = [...tags]
            .sort((a, b) => b.v - a.v)
            .map((t) => `${t.k}: ${t.v}`)
            .join("<br/>");
          return `<b>${p.name}</b><br/>${lines}`;
        },
      },
      xAxis: { type: "value", show: false, max: maxVal * 1.3 },
      yAxis: {
        type: "category",
        data: display.map((d) => d.k),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: tokens.textMuted, fontSize: 12 },
      },
      series: [
        {
          type: "bar",
          data: display.map((d) =>
            d.isOther
              ? { value: d.v, otherTags: d.otherTags, itemStyle: { color: otherFill, borderRadius: [0, 4, 4, 0] } }
              : { value: d.v }
          ),
          barMaxWidth: 18,
          itemStyle: { color: fill, borderRadius: [0, 4, 4, 0] },
          // Explicit on-brand hover glow -- without this, ECharts' default
          // emphasis style (a generic lighten/highlight overlay) fights the
          // brand gradient fill instead of reinforcing it.
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: gradient === "cost" ? tokens.flag : tokens.brand500,
            },
          },
          label: {
            show: true,
            position: "right",
            color: tokens.textMuted,
            fontSize: 12,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter: (p: any) => {
              const v = typeof p.value === "number" ? p.value : 0;
              return valuesArePercent ? `${v}%` : `${v}  ${Math.round((v / total) * 100)}%`;
            },
          },
        },
      ],
    };
  }, [tokens, echarts, data, gradient, valuesArePercent]);

  const resolvedHeight = height ?? Math.max(120, rowCount * 28);

  if (tokens && echarts && !data.length) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border-strong text-sm text-text-subtle"
        style={{ height: resolvedHeight }}
      >
        No data yet
      </div>
    );
  }

  return <EChart option={option} height={resolvedHeight} ariaLabel="Breakdown chart" />;
}
