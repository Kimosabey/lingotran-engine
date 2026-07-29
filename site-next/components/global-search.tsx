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

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const index = useMemo(() => buildIndex(), []);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea") {
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-9 w-full max-w-[280px] items-center gap-2 rounded-full border border-border bg-surface-2 px-3 text-sm text-text-subtle transition-colors hover:border-border-strong"
      >
        <Icon name="search" size={15} />
        <span className="flex-1 text-left">Search the corpus…</span>
        <kbd className="rounded border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-subtle">/</kbd>
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
