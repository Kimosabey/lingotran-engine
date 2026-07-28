"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart, useChartTokens } from "@/components/echart";

// Replaces the static site's two duplicate hand-rolled CSS-conic donuts
// (render.js's qaDonut() and corpus.js's drawMiniDonut()) with one real
// ECharts pie, token-correct in both sizes.
export function QaDonut({
  pass,
  fail,
  size = "md",
  label = "QA pass rate",
  legend = false,
}: {
  pass: number;
  fail: number;
  size?: "md" | "sm" | "detail";
  label?: string;
  legend?: boolean;
}) {
  const tokens = useChartTokens();
  const total = pass + fail;
  const pct = total ? Math.round((pass / total) * 100) : 0;
  const dim = size === "sm" ? 56 : size === "detail" ? 100 : 168;

  const option = useMemo<EChartsOption | null>(() => {
    if (!tokens) return null;
    return {
      backgroundColor: "transparent",
      textStyle: { fontFamily: tokens.fontFamily },
      tooltip: size !== "sm" ? { trigger: "item", confine: true } : undefined,
      series: [
        {
          type: "pie",
          radius: size === "sm" ? ["68%", "100%"] : ["62%", "92%"],
          center: ["50%", "50%"],
          silent: size === "sm",
          label: { show: false },
          labelLine: { show: false },
          emphasis: size === "sm" ? { disabled: true } : undefined,
          data: [
            { value: pass, name: "QA-verified", itemStyle: { color: tokens.verified } },
            { value: fail, name: "QA-failed", itemStyle: { color: total ? tokens.flag : tokens.chartTrack } },
          ],
        },
      ],
    };
  }, [tokens, pass, fail, total, size]);

  const donut = (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: dim, height: dim }}>
      <EChart option={option} height={dim} ariaLabel={`${label}: ${pct}%, ${pass} of ${total}`} />
      {size === "md" && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-medium text-text">{pct}%</span>
          <span className="text-[11px] text-text-subtle">{label}</span>
        </div>
      )}
      {size === "detail" && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-text">{pct}%</span>
          <span className="text-[10px] text-text-subtle">clean</span>
        </div>
      )}
    </div>
  );

  if (!legend) return donut;

  // Every chart also carries its numbers as text -- no chart is the sole
  // source of a value (ported principle from the static site's render.js).
  return (
    <div className="flex items-center gap-6">
      {donut}
      <div className="flex flex-col gap-2 text-sm">
        <span className="flex items-center gap-2 text-text-muted">
          <span className="h-2.5 w-2.5 rounded-full bg-verified" />
          <b className="text-text">{pass.toLocaleString()}</b> clean (ok: true)
        </span>
        <span className="flex items-center gap-2 text-text-muted">
          <span className="h-2.5 w-2.5 rounded-full bg-flag" />
          <b className="text-text">{fail.toLocaleString()}</b> flagged for repair
        </span>
        <span className="flex items-center gap-2 text-text-muted">
          <span className="h-2.5 w-2.5 rounded-full bg-text-subtle" />
          <b className="text-text">{total.toLocaleString()}</b> QA verdicts on disk
        </span>
      </div>
    </div>
  );
}
