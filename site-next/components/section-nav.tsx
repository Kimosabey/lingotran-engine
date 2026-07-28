"use client";

import { useEffect, useRef, useState } from "react";

export interface Section {
  id: string;
  label: string;
}

// In-page section nav + scroll-spy -- port of assets/js/ui.js's
// buildSectionNav()/initScrollSpy(), adapted to track the sticky
// header (60px) + appbar (48px) heights via this component's own rect.
export function SectionNav({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sections.length) return;
    let ticking = false;

    function update() {
      ticking = false;
      const navEl = navRef.current;
      const threshold = 60 + 48 + (navEl ? navEl.offsetHeight + 12 : 12) + 16;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
      if (!els.length) return;
      let cur = els[0].id;
      if (atBottom) cur = els[els.length - 1].id;
      else {
        for (const el of els) {
          if (el.getBoundingClientRect().top <= threshold) cur = el.id;
        }
      }
      setActive((prev) => (prev === cur ? prev : cur));
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  useEffect(() => {
    const link = navRef.current?.querySelector<HTMLAnchorElement>(`a[data-target="${active}"]`);
    const nav = navRef.current;
    if (link && nav) {
      const r = link.getBoundingClientRect();
      const nr = nav.getBoundingClientRect();
      if (r.left < nr.left + 8) nav.scrollLeft -= nr.left + 8 - r.left;
      else if (r.right > nr.right - 8) nav.scrollLeft += r.right - (nr.right - 8);
    }
  }, [active]);

  if (!sections.length) return null;

  return (
    <div className="sticky top-[calc(var(--topbar-h)+var(--appbar-h))] z-30 -mx-4 sm:mx-0">
      <nav
        ref={navRef}
        className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border bg-bg/95 px-4 py-2 backdrop-blur sm:px-0"
        aria-label="On this page"
      >
        {sections.map((s) => (
          <a
            key={s.id}
            href={"#" + s.id}
            data-target={s.id}
            className={
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
              (active === s.id ? "bg-brand-100 text-link" : "text-text-muted hover:bg-surface-2 hover:text-text")
            }
          >
            {s.label}
          </a>
        ))}
      </nav>
      {/* Hints that the tab row scrolls further right -- otherwise the last
          visible tab (often clipped mid-label on mobile) reads as the end. */}
      <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-bg to-transparent sm:hidden" />
    </div>
  );
}
