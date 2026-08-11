"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

function currentTheme(): "light" | "dark" {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    // Read the actual DOM attribute (set by the pre-hydration inline script)
    // only after mount -- the server can't know it, so this must run client-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(currentTheme());

    // Keep the icon honest when the OS flips underneath an un-stamped page.
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = () => {
      if (!document.documentElement.getAttribute("data-theme")) setTheme(currentTheme());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    // Setting the attribute is the whole job. Every themed value on the site
    // is a light-dark() token resolving against `color-scheme`, which this
    // attribute switches -- so surfaces, text, borders and charts all repaint
    // in one style recalc. There is deliberately no `lt:themechange` event
    // any more: it existed only so the ECharts instances could re-read the
    // palette off the DOM and rebuild themselves, which made this the slowest
    // interaction on the site (537ms). The charts are SVG now and follow the
    // custom properties for free.
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("lt-theme", next);
    } catch {}
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === null
          ? "Toggle light or dark theme"
          : `Switch to ${isDark ? "light" : "dark"} theme`
      }
      aria-pressed={theme === null ? undefined : isDark}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center">
        <Icon
          name="sun"
          size={18}
          className={
            "absolute transition-[opacity,rotate] duration-(--dur-3) ease-out " +
            (isDark ? "rotate-90 opacity-0" : "rotate-0 opacity-100")
          }
        />
        <Icon
          name="moon"
          size={18}
          className={
            "absolute transition-[opacity,rotate] duration-(--dur-3) ease-out " +
            (isDark ? "rotate-0 opacity-100" : "-rotate-90 opacity-0")
          }
        />
      </span>
    </button>
  );
}
