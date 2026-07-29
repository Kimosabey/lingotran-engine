"use client";

import { Icon, type IconName } from "@/components/icon";
import { CountUp } from "@/components/count-up";

export interface KpiCardData {
  num: string | number;
  lab: string;
  sub?: string;
  icon?: IconName;
  verified?: boolean;
}

// Cursor-following glow (CSS-driven, no re-render): only 2 custom properties
// are touched per mousemove, the actual paint is a plain radial-gradient in
// globals.css's .spotlight rule -- same "CSS custom property as the wire"
// technique already used for the paper-grain/ambient-wash effects.
function handleSpotlight(e: React.MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
  el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
}

export function KpiGrid({ cards }: { cards: KpiCardData[] }) {
  return (
    <div
      className={
        "grid grid-cols-2 gap-4 " + (cards.length >= 5 ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-4")
      }
    >
      {cards.map((c, i) => (
        <div
          key={i}
          onMouseMove={handleSpotlight}
          className={
            "spotlight relative flex flex-col gap-2 overflow-hidden rounded-2xl border p-5 shadow-sm transition-[transform,box-shadow] duration-(--dur-3) hover:-translate-y-0.5 hover:shadow-md " +
            (c.verified ? "border-verified-strong/20 bg-verified-soft" : "border-border bg-surface")
          }
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-0.5"
            style={{ background: c.verified ? "var(--grad-verified)" : "var(--grad-brand-90)" }}
          />
          <Icon name={c.icon || "grid"} size={18} className={c.verified ? "text-verified-strong" : "text-text-subtle"} />
          <div className={"font-display text-2xl font-medium " + (c.verified ? "text-verified-strong" : "text-text")}>
            <CountUp value={c.num} />
          </div>
          <div className="text-sm font-medium text-text">{c.lab}</div>
          {c.sub && (
            <div className={"text-xs " + (c.verified ? "text-text-muted" : "text-text-subtle")}>{c.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}
