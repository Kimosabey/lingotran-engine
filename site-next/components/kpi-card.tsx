import { Icon, type IconName } from "@/components/icon";
import { CountUp } from "@/components/count-up";

export interface KpiCardData {
  num: string | number;
  lab: string;
  sub?: string;
  icon?: IconName;
  verified?: boolean;
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
          className={
            "flex flex-col gap-2 rounded-2xl border p-5 " +
            (c.verified ? "border-verified-strong/20 bg-verified-soft" : "border-border bg-surface")
          }
        >
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
