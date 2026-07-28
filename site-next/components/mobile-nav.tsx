"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Icon } from "@/components/icon";
import { sitePages } from "@/lib/data";

export function MobileNav({ active }: { active: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Explicit fallback on top of Base UI's own close-focus handling --
    // confirmed via WebKit testing that focus doesn't reliably return to
    // the trigger there otherwise, leaving keyboard users stranded at the
    // top of the document instead of back where they started.
    if (!next) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text md:hidden"
      >
        <Icon name="menu" size={18} />
      </button>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>Navigate</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-2" aria-label="Menu">
          {sitePages.map((p) => {
            const on = p.slug === active;
            return (
              <Link
                key={p.slug}
                href={"/" + p.path}
                onClick={() => setOpen(false)}
                aria-disabled={p.disabled}
                className={
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                  (on ? "bg-brand-100 text-link" : "text-text-muted hover:bg-surface-2 hover:text-text")
                }
              >
                {p.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
