"use client";

import { useEffect, useRef, useState } from "react";
import { ShinyText } from "@/components/react-bits/shiny-text";
import { REPO_URL } from "@/lib/data";

// The author's GitHub profile, derived from the repo URL rather than typed a
// second time -- one of these two will change eventually and they should not be
// able to disagree.
const AUTHOR_URL = REPO_URL.split("/").slice(0, 4).join("/");

/**
 * The author credit. The one piece of first-person authorship on a site that
 * otherwise speaks as a system, so it gets the only continuously-animating
 * treatment on the page.
 *
 * React Bits' ShinyText carries the sweep. Two things are handled here rather
 * than in the vendored component, so it stays diffable against upstream:
 *
 * GATING — ShinyText runs a requestAnimationFrame callback for the life of the
 * page. This instance is in the footer, below the fold on every route, so
 * unconditionally it would cost a callback every frame forever to animate
 * something off-screen. An IntersectionObserver flips ShinyText's own
 * `disabled` prop, so the loop only runs while the byline is actually visible.
 *
 * REDUCED MOTION — `prefers-reduced-motion` also sets `disabled`. Note this
 * cannot be delegated to the global CSS reset: the sweep is a JS-driven
 * background-position, not a CSS animation, so a duration override would not
 * touch it. Disabled, ShinyText still paints the gradient at its resting
 * position, so the name renders in --text-muted exactly as before — the
 * information survives, only the movement goes.
 */
export function Byline({ name }: { name: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq) {
      setReduced(mq.matches);
      const onChange = () => setReduced(mq.matches);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    // Not one-shot, unlike the section reveals: this observer keeps the sweep
    // switched off again once the footer scrolls back out of view.
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.1,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <a
      ref={ref}
      href={AUTHOR_URL}
      target="_blank"
      rel="noopener"
      className="byline font-medium"
    >
      <ShinyText
        text={name}
        disabled={!visible || reduced}
        speed={2.6}
        // A slow, wide sweep with a long pause: the byline should catch the eye
        // once, not strobe. yoyo would send it back and forth, which reads as
        // fidgeting rather than a pass.
        delay={2.2}
        spread={110}
        // Both endpoints clear WCAG AA for small text. A conventional silver
        // shine cannot: on the light footer ground any colour bright enough to
        // read as a highlight falls under 4.5:1 (--brand-500 measures 4.44:1).
        // Sweeping to --link instead means the name inks violet in light mode
        // (11.45:1) and genuinely shines in dark mode, where the same token is
        // lighter than the base (8.55:1).
        color="var(--text-muted)"
        shineColor="var(--link)"
        pauseOnHover
      />
    </a>
  );
}
