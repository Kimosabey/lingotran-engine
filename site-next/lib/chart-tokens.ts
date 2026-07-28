// Reads the real Manifest design tokens (tokens.css / globals.css custom
// properties) so every chart shares one palette with the rest of the UI --
// fixes the static site's cost-donut token-drift bug (hardcoded hex fallback
// array instead of reading --brand-500/--verified/--flag/--amber).
export interface ChartTokens {
  brand500: string;
  brand300: string;
  brand700: string;
  verified: string;
  flag: string;
  amber: string;
  surface: string;
  surface2: string;
  chartTrack: string;
  text: string;
  textMuted: string;
  border: string;
  fontFamily: string;
}

const VAR_MAP: Record<keyof ChartTokens, string> = {
  brand500: "--brand-500",
  brand300: "--brand-300",
  brand700: "--brand-700",
  verified: "--verified",
  flag: "--flag",
  amber: "--amber",
  surface: "--surface",
  surface2: "--surface-2",
  chartTrack: "--chart-track",
  text: "--text",
  textMuted: "--text-muted",
  border: "--border",
  fontFamily: "--font-sans-family",
};

export function getChartTokens(): ChartTokens {
  const style = getComputedStyle(document.documentElement);
  const out = {} as ChartTokens;
  (Object.keys(VAR_MAP) as (keyof ChartTokens)[]).forEach((key) => {
    out[key] = style.getPropertyValue(VAR_MAP[key]).trim();
  });
  return out;
}
