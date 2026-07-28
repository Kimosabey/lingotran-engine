"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

function currentTheme(): "light" | "dark" {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    // Read the actual DOM attribute (set by the pre-hydration inline script)
    // only after mount -- the server can't know it, so this must run client-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(currentTheme());
  }, []);

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("lt-theme", next);
    } catch {}
    document.dispatchEvent(new CustomEvent("lt:themechange", { detail: next }));
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      <span className={theme === "dark" ? "hidden" : "inline-flex"}>
        <Icon name="sun" size={18} />
      </span>
      <span className={theme === "dark" ? "inline-flex" : "hidden"}>
        <Icon name="moon" size={18} />
      </span>
    </button>
  );
}
