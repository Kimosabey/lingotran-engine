import { Icon } from "@/components/icon";

const ROWS: [string, string, boolean][] = [
  ["source", "netzwerk-a1-kursbuch", false],
  ["page", "066", true],
  ["content", "dialogue · communication", false],
  ["qa", "ok: true", true],
];

// The hero's signature element -- scan-to-structured-data transform, built
// from the paper/scan motif tokens.css already defines as "the emotional
// core" (see the design-elevation notes in the migration plan). A first,
// faithful pass; gets its motion/polish treatment in the design pass.
export function FidelityCard() {
  return (
    <div className="relative flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-lg sm:flex-row sm:items-center">
      <span className="absolute -top-3 left-5 inline-flex items-center gap-1.5 rounded-full bg-verified-badge px-3 py-1 text-xs font-semibold text-white shadow-sm">
        <Icon name="checkSeal" size={13} />
        Verified
      </span>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-paper-line bg-paper p-4">
        <div className="font-mono text-[10px] text-paper-ink">netzwerk-a1-kursbuch · page-066.png · 300 DPI</div>
        <div className="mt-3 space-y-2">
          <div className="h-2.5 w-3/4 rounded bg-paper-line" />
          <div className="h-2 w-full rounded bg-paper-line/70" />
          <div className="h-2 w-2/3 rounded bg-paper-line/70" />
          <div className="h-2 w-5/6 rounded bg-paper-line/70" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-paper-line/50" />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center text-brand-500 sm:px-1">
        <Icon name="arrow" size={20} />
      </div>

      <div className="flex-1 rounded-xl border border-border-faint bg-surface-inset p-4">
        {ROWS.map(([key, value, ok]) => (
          <div key={key} className="flex items-center justify-between border-b border-border-faint py-2 last:border-0">
            <span className="font-mono text-xs text-text-subtle">{key}:</span>
            <span className="flex items-center gap-1.5 text-sm text-text">
              {value}
              {ok && <Icon name="check" size={13} className="text-verified-strong" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
