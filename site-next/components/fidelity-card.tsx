import { Icon } from "@/components/icon";

// The four fields the QA pass confirms. `stagger` is a fraction of the shared
// cycle (see "THE VERIFICATION PASS" in globals.css) applied as an
// animation-delay -- deliberately NOT a shorter duration, which would break
// sync with the other tracks. Kept as data so the stagger is one number per
// row rather than four keyframe blocks.
const ROWS: { key: string; value: string; ok: boolean; stagger: number }[] = [
  { key: "source", value: "netzwerk-a1-kursbuch", ok: false, stagger: 0 },
  { key: "page", value: "066", ok: true, stagger: 0.012 },
  { key: "content", value: "dialogue · communication", ok: false, stagger: 0.024 },
  { key: "qa", value: "ok: true", ok: true, stagger: 0.036 },
];

// The page as it exists in the source scan, before anything has read it.
const PAGE_LINES = [
  { text: "Guten Tag! Ich heiße Anna.", strong: true },
  { text: "Und du, wie heißt du?", strong: false },
];

// The hero's signature element: a scan-to-structured-data transform that
// actually runs, on a loop, rather than staging in once and stopping.
//
// Every other product hero shows a screenshot of its UI. This product's claim
// is a physical process -- a 300-DPI page is read and every field is confirmed
// present -- so the hero performs that process instead of illustrating it. A
// sensor bar sweeps the specimen, the German text resolves from blur to sharp
// exactly where the bar has passed, the four output fields check in with their
// ticks landing a beat late, and the Verified badge stamps. Then it holds long
// enough to be read, and the next page takes its place.
//
// Hover (or focus anything inside) to freeze the pass and inspect the
// specimen. All CSS -- no timers, no animation library, and no risk of the five
// tracks drifting out of sync, because they share one duration and one
// iteration count.
//
// Purely illustrative: the H1 and the copy beside it already state the same
// claim in prose, so the whole thing is hidden from assistive tech.
export function FidelityCard() {
  return (
    <div
      aria-hidden="true"
      className="scan-stage glow-border-hover group relative flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-lg sm:flex-row sm:items-center"
    >
      <span className="scan-badge absolute -top-3 left-5 inline-flex items-center gap-1.5 rounded-full bg-verified-badge px-3 py-1 text-xs font-semibold text-white shadow-sm">
        <Icon name="checkSeal" size={13} />
        Verified
        <span className="scan-ring" />
      </span>

      {/* The specimen. --scan-travel is how far the sensor bar has to sweep to
          clear the panel; it is set here rather than in the stylesheet because
          it is a property of this panel's height, not of the animation. */}
      <div
        className="scan-paper paper-grain paper-fold relative flex-1 overflow-hidden rounded-xl border border-paper-line bg-paper p-4 shadow-sm"
        style={{ ["--scan-travel" as string]: "168px" }}
      >
        <span className="scan-head" />

        <div className="font-mono text-[10px] text-paper-ink/85">
          netzwerk-a1-kursbuch · page-066.png · 300 DPI
        </div>

        {/* Two stacked copies of the page text. The blurred one is what the
            scan starts with; the sharp one is revealed by a clip-path chasing
            the sensor bar, so the words materialise as they are read. */}
        <div className="relative mt-2.5">
          <div className="scan-blur space-y-1 text-[11px] leading-snug text-paper-ink">
            {PAGE_LINES.map((l) => (
              <p key={l.text} className={l.strong ? "font-medium" : "text-paper-ink/90"}>
                {l.text}
              </p>
            ))}
          </div>
          <div className="scan-sharp absolute inset-0 space-y-1 text-[11px] leading-snug text-paper-ink">
            {PAGE_LINES.map((l) => (
              <p key={l.text} className={l.strong ? "font-medium" : "text-paper-ink/90"}>
                {l.text}
              </p>
            ))}
          </div>
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

      {/* The two stages, named -- the same terms the Overview section uses. */}
      <div className="flex items-center justify-center gap-2.5 py-1 sm:w-24 sm:flex-col sm:gap-2 sm:px-1">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <Icon name="eye" size={14} />
          </span>
          <span className="text-[11px] font-medium leading-tight text-text-subtle">
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
          <span className="text-[11px] font-medium leading-tight text-text-subtle">
            Adversarial
            <br />
            QA
          </span>
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-border-faint bg-surface-inset p-4">
        {ROWS.map((r) => (
          <div
            key={r.key}
            className="scan-row flex items-center justify-between border-b border-border-faint py-2 last:border-0"
            style={{ ["--row-stagger" as string]: r.stagger }}
          >
            <span className="font-mono text-xs text-text-subtle">{r.key}:</span>
            <span className="flex items-center gap-1.5 text-sm text-text">
              {r.value}
              {r.ok && (
                <span className="scan-tick inline-flex" style={{ ["--row-stagger" as string]: r.stagger }}>
                  <Icon name="check" size={13} className="text-verified-strong" />
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
