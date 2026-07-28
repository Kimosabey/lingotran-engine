import { Icon } from "@/components/icon";

const ROWS: [string, string, boolean][] = [
  ["source", "netzwerk-a1-kursbuch", false],
  ["page", "066", true],
  ["content", "dialogue · communication", false],
  ["qa", "ok: true", true],
];

const ROW_DELAY_MS = 120;
const ROW_STAGGER_MS = 70;
const BADGE_DELAY_MS = ROW_DELAY_MS + (ROWS.length - 1) * ROW_STAGGER_MS + 280;

// The hero's signature element -- a scan-to-structured-data transform. The
// left panel is styled as a physically real artifact (tilted, grained, a
// dog-eared corner) rather than a flat UI mockup; the two-icon strip names
// the actual two-stage process (vision transcription, then adversarial QA --
// same terms used in the Overview section below) instead of a bare arrow;
// and the output rows check in one at a time, ending on the Verified badge,
// so "verified" reads as something that just happened, not a static label.
// Purely decorative/illustrative (the H1 + copy already state the same
// claim in prose), so it's hidden from assistive tech.
export function FidelityCard() {
  return (
    <div
      aria-hidden="true"
      className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-lg sm:flex-row sm:items-center"
    >
      <span className="fidelity-badge absolute -top-3 left-5 inline-flex items-center gap-1.5 rounded-full bg-verified-badge px-3 py-1 text-xs font-semibold text-white shadow-sm" style={{ animationDelay: `${BADGE_DELAY_MS}ms` }}>
        <Icon name="checkSeal" size={13} />
        Verified
      </span>

      <div className="paper-grain paper-fold relative flex-1 rotate-[-2deg] overflow-hidden rounded-xl border border-paper-line bg-paper p-4 shadow-sm transition-transform duration-(--dur-3) ease-out group-hover:rotate-[0deg]">
        <div className="font-mono text-[10px] text-paper-ink/70">netzwerk-a1-kursbuch · page-066.png · 300 DPI</div>
        <div className="mt-2.5 space-y-1 text-[11px] leading-snug text-paper-ink">
          <p className="font-medium">Guten Tag! Ich heiße Anna.</p>
          <p className="text-paper-ink/80">Und du, wie heißt du?</p>
        </div>
        <div className="mt-2.5 space-y-2">
          <div className="h-2 w-full rounded bg-paper-line/70" />
          <div className="h-2 w-2/3 rounded bg-paper-line/70" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-paper-line/50" />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2.5 py-1 sm:flex-col sm:gap-2 sm:px-1">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <Icon name="eye" size={14} />
          </span>
          <span className="text-[9px] font-medium leading-tight text-text-subtle">
            Vision
            <br />
            transcribe
          </span>
        </div>
        <Icon name="arrow" size={13} className="shrink-0 text-brand-300 sm:rotate-90" />
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-verified-soft text-verified-strong">
            <Icon name="checkSeal" size={14} />
          </span>
          <span className="text-[9px] font-medium leading-tight text-text-subtle">
            Adversarial
            <br />
            QA
          </span>
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-border-faint bg-surface-inset p-4">
        {ROWS.map(([key, value, ok], i) => (
          <div
            key={key}
            className="fidelity-row flex items-center justify-between border-b border-border-faint py-2 last:border-0"
            style={{ animationDelay: `${ROW_DELAY_MS + i * ROW_STAGGER_MS}ms` }}
          >
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
