"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart, useChartTokens } from "@/components/echart";
import type { ChartPoint } from "@/lib/data";

// The engine page's usage-window donut -- ports the static site's one real
// ECharts instance, fixing its token-drift bug: the original hardcoded a
// 6-hex palette array instead of reading the same --brand-500/--verified/
// --flag/--amber variables every other chart on the site now shares.
export function CostDonut({ data }: { data: ChartPoint[] }) {
  const tokens = useChartTokens();

  const option = useMemo<EChartsOption | null>(() => {
    if (!tokens) return null;
    const palette = [tokens.brand500, tokens.brand700, tokens.flag, tokens.amber, tokens.brand300, tokens.verified];
    return {
      backgroundColor: "transparent",
      textStyle: { fontFamily: tokens.fontFamily },
      tooltip: { trigger: "item", formatter: "{b}: {c}%" },
      series: [
        {
          type: "pie",
          radius: ["48%", "74%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: tokens.surface, borderWidth: 3 },
          label: { color: tokens.text, formatter: "{b}\n{c}%", fontSize: 11, fontWeight: 600 },
          labelLine: { length: 10, length2: 8 },
          data: data.map((c, i) => ({
            name: c.k,
            value: c.v,
            itemStyle: { color: palette[i % palette.length] },
          })),
        },
      ],
    };
  }, [tokens, data]);

  return <EChart option={option} height={320} ariaLabel="Donut chart of usage-window share by activity" />;
}
