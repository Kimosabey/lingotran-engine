"use client";

import { useEffect, useRef, useState } from "react";

// Fades + lifts each section in as it enters the viewport, once, then leaves
// it alone -- re-triggering on every scroll up/down would be distracting on
// pages this long. Respects prefers-reduced-motion via the global CSS reset
// in globals.css (that reset collapses the transition-duration to ~0, not the
// opacity/transform themselves, so content still becomes fully visible either
// way -- reduced motion means "no tween", not "no content").
function useReveal() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { ref, visible } = useReveal();

  // The stagger delay is an inline style, not a `delay-[${n}ms]` class.
  // Tailwind v4 scans source files for *literal* class candidates, so a class
  // built by template interpolation is never generated: `delay-[60ms]`,
  // `delay-[120ms]` and `delay-[180ms]` were absent from the compiled CSS
  // entirely (0 matches), the class landed in the DOM resolving to nothing,
  // and every element in every section faded in simultaneously. This is the
  // same mechanism FidelityCard's animationDelay and FlowDiagram's
  // --beam-delay already use.
  //
  // `.reveal` is what the (scripting: none) guard in globals.css targets, so
  // the whole effect degrades to plain visible content when JS can't run.
  const stage = (delayMs: number) => ({
    className:
      "reveal transition-[opacity,transform] duration-(--dur-4) ease-out " +
      (visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"),
    style: { transitionDelay: `${delayMs}ms` },
  });

  const eyebrowStage = stage(0);
  const titleStage = stage(60);
  const leadStage = stage(120);
  const bodyStage = stage(180);

  return (
    <section id={id} ref={ref} className="scroll-mt-(--sticky-stack) py-14 first:pt-10">
      {/* The measure is applied to the lead paragraph itself, not to this
          wrapper: --prose-max is font-size-relative, so on a 16px container it
          would resolve to a different width than the 15px text it's meant to
          constrain. Headings are short and may run wider. */}
      <div className="mb-8 max-w-3xl">
        <span
          className={"block text-xs font-semibold uppercase tracking-[0.08em] text-link " + eyebrowStage.className}
          style={eyebrowStage.style}
        >
          {eyebrow}
        </span>
        <h2
          className={"mt-2 font-display text-2xl font-medium tracking-tight text-text sm:text-3xl " + titleStage.className}
          style={titleStage.style}
        >
          {title}
        </h2>
        {lead && (
          <p
            className={"mt-3 max-w-(--prose-max) text-base leading-relaxed text-text-muted " + leadStage.className}
            style={leadStage.style}
          >
            {lead}
          </p>
        )}
      </div>
      <div className={bodyStage.className} style={bodyStage.style}>
        {children}
      </div>
    </section>
  );
}
