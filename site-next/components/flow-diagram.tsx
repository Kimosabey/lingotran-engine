"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";

const KIND_BG: Record<string, string> = {
  vision: "bg-brand-100 text-link",
  text: "bg-amber-soft text-amber-strong",
  free: "bg-surface-2 text-text-subtle",
};

export interface FlowStep {
  icon: string;
  title: string;
  sub: string;
  kind: string;
}

// Tracing beam: the connector between each step is a plain gray rail with a
// brand-gradient overlay that scales in from the left, staggered step by
// step, once the diagram scrolls into view -- the horizontal equivalent of
// Aceternity's vertical tracing-beam (this diagram is a single-screen
// left-to-right row, not a long vertical scroll, so a literal vertical SVG
// path doesn't apply; this adapts the same "beam follows the reader" idea
// to the shape this content actually has). Same one-shot IntersectionObserver
// pattern as Section's useReveal, not a new dependency.
export function FlowDiagram({ steps }: { steps: FlowStep[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLit(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex min-w-max items-center gap-1">
      {steps.map((step, i) => (
        <div key={step.title} className="flex items-center gap-1">
          {i > 0 && (
            <span
              className={"tracing-line relative h-px w-6 shrink-0 bg-border-strong " + (lit ? "is-lit" : "")}
              style={lit ? ({ "--beam-delay": `${(i - 1) * 100}ms` } as React.CSSProperties) : undefined}
            />
          )}
          <div
            className={
              "flex w-32 shrink-0 flex-col items-center gap-1.5 rounded-xl px-3 py-4 text-center " +
              KIND_BG[step.kind]
            }
          >
            <Icon name={step.icon as IconName} size={20} />
            <span className="text-xs font-semibold">{step.title}</span>
            <span className="text-[10px]">{step.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
