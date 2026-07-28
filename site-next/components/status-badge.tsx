export type BookState = "complete" | "in-progress" | "not-started";

// Reads a book's precomputed state directly (lib/data.ts's stateOf(), fed by
// data authored in each book's `status` field) rather than re-deriving it per
// consumer -- the exact duplication that once let "complete (21 disclosed
// gaps)" and "21 flagged" disagree with each other across the console and the
// book cards.
export function StatusBadge({ state, qaFail = 0 }: { state: BookState; qaFail?: number }) {
  const extra = qaFail > 0 ? ` · ${qaFail} disclosed` : "";
  if (state === "complete") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-verified-soft px-2.5 py-1 text-xs font-medium text-verified-strong">
        <span className="h-1.5 w-1.5 rounded-full bg-verified-strong" />
        complete{extra}
      </span>
    );
  }
  if (state === "not-started") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-subtle">
        <span className="h-1.5 w-1.5 rounded-full bg-text-subtle" />
        not started
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-xs font-medium text-amber-strong">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-strong" />
      in progress{extra}
    </span>
  );
}
