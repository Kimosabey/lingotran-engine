"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Icon } from "@/components/icon";
import { sitePages, REPO_URL } from "@/lib/data";

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
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text md:hidden"
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
                aria-current={on ? "page" : undefined}
                className={
                  "relative rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                  (on ? "bg-brand-100 text-link" : "text-text-muted hover:bg-surface-2 hover:text-text")
                }
              >
                {p.label}
                {on && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1.5 -left-px w-0.5 rounded-full"
                    style={{ background: "var(--grad-brand)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
        {/* Jakob's law: a hamburger is expected to contain everything the
            header holds. It previously held links only, so the repo link had
            no mobile equivalent either. */}
        <div className="mt-2 border-t border-border px-2 pt-3">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <Icon name="github" size={16} />
            GitHub repository
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
