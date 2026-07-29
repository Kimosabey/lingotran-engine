import { Icon } from "@/components/icon";

export function Chip({ children, ok }: { children: React.ReactNode; ok?: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium " +
        (ok ? "border-verified-strong/25 bg-verified-soft text-verified-strong" : "border-border-strong text-text-muted")
      }
    >
      {ok && <Icon name="check" size={12} className="text-verified-strong" />}
      {children}
    </span>
  );
}
