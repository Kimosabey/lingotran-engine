"use client";

import { Donut } from "@/components/charts/donut";
import { CountUp } from "@/components/count-up";

// The QA pass/fail split. Every chart on the site also carries its numbers as
// text -- no chart is ever the sole source of a value.
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
  const total = pass + fail;
  const pct = total ? Math.round((pass / total) * 100) : 0;
  const dim = size === "sm" ? 56 : size === "detail" ? 100 : 168;

  const donut = (
    <Donut
      size={dim}
      thickness={size === "sm" ? 0.16 : 0.19}
      ariaLabel={`${label}: ${pct}%, ${pass.toLocaleString()} of ${total.toLocaleString()} pages clean`}
      segments={[
        { label: "QA-verified", value: pass, color: "var(--verified)" },
        { label: "QA-failed", value: fail, color: "var(--flag)" },
      ]}
    >
      {size === "md" && (
        <>
          <span className="font-display text-2xl font-medium text-text">
            <CountUp value={`${pct}%`} />
          </span>
          <span className="text-[11px] text-text-subtle">{label}</span>
        </>
      )}
      {size === "detail" && (
        <>
          <span className="text-lg font-semibold text-text">
            <CountUp value={`${pct}%`} />
          </span>
          <span className="text-[10px] text-text-subtle">clean</span>
        </>
      )}
    </Donut>
  );

  if (!legend) return donut;

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
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
