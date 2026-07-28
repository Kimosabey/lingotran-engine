"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { getChartTokens, type ChartTokens } from "@/lib/chart-tokens";

// Reactive chart-token palette -- recomputed on mount and whenever the
// theme toggle fires `lt:themechange` (see ThemeToggle), so every chart
// repaints on toggle instead of only the surrounding DOM.
export function useChartTokens(): ChartTokens | null {
  const [tokens, setTokens] = useState<ChartTokens | null>(null);

  useEffect(() => {
    // Reads CSS custom properties from the DOM -- the server can't know these,
    // so the first read must happen client-side, post-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokens(getChartTokens());
    function onThemeChange() {
      setTokens(getChartTokens());
    }
    document.addEventListener("lt:themechange", onThemeChange);
    return () => document.removeEventListener("lt:themechange", onThemeChange);
  }, []);

  return tokens;
}

// Shared ECharts instance wrapper -- one implementation for every chart on
// the site (cost donut, QA donut, content-type/CEFR/orientation bar rows),
// replacing the static site's two duplicate hand-rolled donut implementations
// (render.js's qaDonut() and corpus.js's drawMiniDonut()). Handles instance
// lifecycle (init/resize/dispose) so callers only ever supply `option`.
export function EChart({
  option,
  height = 280,
  className,
  ariaLabel,
}: {
  option: EChartsOption | null;
  height?: number | string;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const optionRef = useRef(option);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Defer init until the container actually has a size -- calling
    // echarts.init() into a still-0x0 box (e.g. a grid cell whose size
    // depends on sibling content not yet laid out) is harmless but logs a
    // console warning on every mount, so wait for the first real measurement.
    let disposed = false;
    const observer = new ResizeObserver(() => {
      if (disposed) return;
      if (!chartRef.current) {
        if (el.clientWidth === 0 || el.clientHeight === 0) return;
        chartRef.current = echarts.init(el);
        if (optionRef.current) chartRef.current.setOption(optionRef.current, true);
      } else {
        chartRef.current.resize();
      }
    });
    observer.observe(el);

    return () => {
      disposed = true;
      observer.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    optionRef.current = option;
    if (chartRef.current && option) {
      chartRef.current.setOption(option, true);
    }
  }, [option]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ width: "100%", height }}
    />
  );
}
