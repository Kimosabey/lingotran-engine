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

// Exactly ONE instance of this belongs on a page. It renders two triggers --
// the full pill for >= sm and an icon button below that -- rather than the
// component being mounted twice, because CommandDialog portals an sr-only
// DialogHeader to <body>: a second instance put that header outside every
// landmark and tripped axe's `region` rule on all nine routes.
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const index = useMemo(() => buildIndex(), []);

  useEffect(() => {
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
  }, []);

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
      {/* >= sm: the full pill, with its keyboard hint. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group hidden h-10 w-full max-w-[280px] items-center gap-2 rounded-full border border-border-control bg-surface-2 px-3.5 text-sm text-text-subtle transition-colors hover:border-brand-500 hover:text-text sm:flex"
      >
        <Icon name="search" size={15} />
        <span className="flex-1 text-left">Search the corpus…</span>
        <kbd className="rounded border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-subtle">
          /
        </kbd>
      </button>
      {/* Below sm the pill doesn't fit, so it collapses to an icon button
          rather than disappearing. It used to simply vanish, and the only
          other way in was the "/" key -- which needs a hardware keyboard. So
          search did not exist at all on a phone for /engine, /reference,
          /french, /german or any Explorer route. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search the corpus"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text sm:hidden"
      >
        <Icon name="search" size={18} />
      </button>
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
