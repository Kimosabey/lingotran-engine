"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Icon } from "@/components/icon";
import { sitePages, corpus } from "@/lib/data";

interface SearchEntry {
  title: string;
  sub: string;
  href: string;
  kind: string;
  badge?: string;
}

function buildIndex(): SearchEntry[] {
  const items: SearchEntry[] = [];
  sitePages.forEach((p) => {
    if (p.disabled) return;
    items.push({ title: p.label, sub: "Page", href: "/" + p.path, kind: "Pages" });
  });
  corpus().forEach((c) => {
    items.push({
      title: c.title,
      sub: c.langName + " · " + c.pages + " pages",
      href: c.href,
      kind: "Books & sets",
      badge: c.langCode,
    });
  });
  return items;
}

export function GlobalSearch({
  triggerless = false,
  open: controlledOpen,
  onOpenChange,
}: {
  /** Render only the dialog, no button -- used by the header's mobile icon
   * trigger, so search is reachable on a phone without a hardware keyboard. */
  triggerless?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const router = useRouter();
  const index = useMemo(() => buildIndex(), []);

  useEffect(() => {
    // Only the button-bearing instance owns the keyboard shortcut, otherwise
    // both instances would open on the same keypress.
    if (triggerless) return;
    function onKeydown(e: KeyboardEvent) {
      const el = document.activeElement;
      const tag = (el?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement)?.isContentEditable;
      if (typing) return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [triggerless, setOpen]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const groups = index.reduce<Record<string, SearchEntry[]>>((acc, item) => {
    (acc[item.kind] ||= []).push(item);
    return acc;
  }, {});

  return (
    <>
      {!triggerless && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex h-10 w-full max-w-[280px] items-center gap-2 rounded-full border border-border-control bg-surface-2 px-3.5 text-sm text-text-subtle transition-colors hover:border-brand-500 hover:text-text"
        >
          <Icon name="search" size={15} />
          <span className="flex-1 text-left">Search the corpus…</span>
          <kbd className="rounded border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-subtle">
            /
          </kbd>
        </button>
      )}
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search pages and books">
        <Command>
          <CommandInput placeholder="Search the corpus…" />
          <CommandList>
            <CommandEmpty>No matches. Try a book title or language.</CommandEmpty>
            {Object.entries(groups).map(([kind, entries]) => (
              <CommandGroup key={kind} heading={kind}>
                {entries.map((entry) => (
                  <CommandItem
                    key={entry.href + entry.title}
                    value={entry.title + " " + entry.sub}
                    onSelect={() => go(entry.href)}
                  >
                    {entry.badge && (
                      <span className="rounded border border-brand-300 bg-brand-100 px-1 text-[10px] font-semibold uppercase tracking-wide text-link">
                        {entry.badge}
                      </span>
                    )}
                    <span className="text-text">{entry.title}</span>
                    <span className="ml-auto text-xs text-text-subtle">{entry.sub}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
