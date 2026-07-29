"use client";

import { useEffect, useRef, useState } from "react";

// Fades + lifts each section in as it enters the viewport, once, then leaves
// it alone -- re-triggering on every scroll up/down would be distracting on
// pages this long. Respects prefers-reduced-motion via the global CSS reset
// in globals.css (that reset collapses the transition-duration below to
// ~0, not the opacity/transform themselves, so content still becomes fully
// visible either way -- reduced motion means "no tween", not "no content").
function useReveal() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
  const stage = (delayMs: number) =>
    "transition-[opacity,transform] duration-(--dur-4) ease-out " +
    (visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2") +
    (delayMs ? ` delay-[${delayMs}ms]` : "");

  return (
    <section id={id} ref={ref} className="scroll-mt-32 py-14 first:pt-10">
      <div className="mb-8 max-w-2xl">
        <span className={"block text-xs font-semibold uppercase tracking-[0.08em] text-link " + stage(0)}>
          {eyebrow}
        </span>
        <h2 className={"mt-2 font-display text-2xl font-medium tracking-tight text-text sm:text-3xl " + stage(60)}>
          {title}
        </h2>
        {lead && <p className={"mt-3 text-base leading-relaxed text-text-muted " + stage(120)}>{lead}</p>}
      </div>
      <div className={stage(180)}>{children}</div>
    </section>
  );
}
