"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { Chip } from "@/components/chip";
import { StatusBadge } from "@/components/status-badge";
import { QaDonut } from "@/components/charts/qa-donut";
import { corpus, type CorpusItem } from "@/lib/data";

type LangFilter = "all" | "FR" | "DE";
type StatusFilter = "all" | "complete" | "in-progress" | "not-started" | "flags";
type SortKey = "title-asc" | "pages-desc" | "pct-desc" | "pct-asc";

function DetailPanel({ item }: { item: CorpusItem }) {
  const blurb = "blurb" in item.book ? item.book.blurb : undefined;
  const caveats = "caveats" in item.book ? item.book.caveats : undefined;
  return (
    <div className="grid grid-cols-1 gap-6 border-t border-border bg-surface-inset p-5 sm:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-3">
        {blurb && <p className="text-sm leading-relaxed text-text-muted">{blurb}</p>}
        <div className="flex flex-wrap gap-2">
          <Chip>{item.pages} pages</Chip>
          <Chip>{item.transcribed} transcribed</Chip>
          <Chip ok>{item.verified} verified</Chip>
          {item.questions ? <Chip>{item.questions.toLocaleString()} questions</Chip> : null}
          {item.words ? <Chip>{item.words.toLocaleString()} words</Chip> : null}
        </div>
        {caveats?.length ? (
          <div className="mt-1 flex items-start gap-2 rounded-lg border border-flag/20 bg-flag-soft px-3 py-2.5 text-sm text-text">
            <Icon name="wrench" size={16} className="mt-0.5 shrink-0 text-flag-strong" />
            <div>
              <b>Disclosed gap. </b>
              {caveats.join(" ")}
            </div>
          </div>
        ) : null}
        <div className="mt-1 flex items-center justify-between">
          <span className="font-mono text-xs text-text-subtle">{item.source || item.slug}</span>
          <Link href={item.href} className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
            Open
            <Icon name="arrow" size={14} />
          </Link>
        </div>
      </div>
      {item.qaPass || item.qaFail ? (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-subtle">QA split</span>
          <QaDonut pass={item.qaPass} fail={item.qaFail} size="detail" />
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1 text-text-muted">
              <span className="h-2 w-2 rounded-full bg-verified" />
              {item.qaPass} clean
            </span>
            <span className="flex items-center gap-1 text-text-muted">
              <span className="h-2 w-2 rounded-full bg-flag" />
              {item.qaFail} flagged
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CorpusConsole() {
  const all = useMemo(() => corpus(), []);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<LangFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("title-asc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = all.filter((it) => {
      if (lang !== "all" && it.langCode !== lang) return false;
      if (status === "flags") {
        if (!(it.qaFail > 0)) return false;
      } else if (status !== "all" && it.state !== status) {
        return false;
      }
      if (query && (it.title + " " + it.source + " " + (it.author || "")).toLowerCase().indexOf(query) === -1) {
        return false;
      }
      return true;
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "pages-desc":
          return b.pages - a.pages;
        case "pct-desc":
          return b.pct - a.pct;
        case "pct-asc":
          return a.pct - b.pct;
        default:
          return a.title.localeCompare(b.title);
      }
    });
    return sorted;
  }, [all, q, lang, status, sort]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3">
          <Icon name="search" size={15} className="text-text-subtle" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search books, exams, sources…"
            aria-label="Search the corpus"
            className="h-full flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
          />
        </div>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as LangFilter)}
          aria-label="Filter by language"
          className="h-9 rounded-full border border-border bg-surface px-3 text-sm text-text"
        >
          <option value="all">All languages</option>
          <option value="FR">French</option>
          <option value="DE">German</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="h-9 rounded-full border border-border bg-surface px-3 text-sm text-text"
        >
          <option value="all">All statuses</option>
          <option value="complete">Complete</option>
          <option value="in-progress">In progress</option>
          <option value="not-started">Not started</option>
          <option value="flags">Has disclosed gaps</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort by"
          className="h-9 rounded-full border border-border bg-surface px-3 text-sm text-text"
        >
          <option value="title-asc">Sort: Title A–Z</option>
          <option value="pages-desc">Sort: Most pages</option>
          <option value="pct-desc">Sort: Highest QA %</option>
          <option value="pct-asc">Sort: Lowest QA %</option>
        </select>
        <span className="ml-auto text-xs text-text-subtle" aria-live="polite">
          <b className="text-text">{list.length}</b> of {all.length} shown
        </span>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface py-16 text-center">
          <Icon name="search" size={22} className="text-text-subtle" />
          <h4 className="font-display text-lg text-text">No matches</h4>
          <p className="text-sm text-text-muted">Try a different language, status, or search term.</p>
        </div>
      ) : (
        <>
          {/* Desktop/tablet: sticky-header table. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface sm:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-text-subtle">
                  <th className="px-4 py-3">Book / collection</th>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3 text-right">Pages</th>
                  <th className="px-4 py-3">QA progress</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-9 px-2 py-3">
                    <span className="sr-only">Expand row details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => {
                  const open = expanded === item.id;
                  return (
                    <Fragment key={item.id}>
                      <tr
                        tabIndex={0}
                        role="button"
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpanded(open ? null : item.id);
                          }
                        }}
                        className="cursor-pointer border-b border-border-faint transition-colors last:border-0 hover:bg-surface-2"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-text">{item.title}</span>
                            <span className="text-xs text-text-subtle">{item.subtitle || item.source}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
                            <span className="rounded border border-border-strong px-1 py-0.5 font-mono text-[10px]">
                              {item.langCode}
                            </span>
                            {item.langName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-text-muted">{item.pages}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-chart-track">
                              <span
                                className="block h-full rounded-full bg-verified"
                                style={{ width: `${item.pct}%` }}
                              />
                            </span>
                            <span className="text-xs text-text-muted">{item.pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge state={item.state} qaFail={item.qaFail} />
                        </td>
                        <td className="px-2 py-3 text-text-subtle">
                          <span className={"inline-flex transition-transform " + (open ? "rotate-90" : "")}>
                            <Icon name="chevron" size={16} />
                          </span>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <DetailPanel item={item} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: the table's columns don't fit a narrow screen, so each
              row becomes its own card instead of a horizontally-scrolling
              table -- same data, same expand/collapse interaction. */}
          <div className="flex flex-col gap-3 sm:hidden">
            {list.map((item) => {
              const open = expanded === item.id;
              return (
                <div key={item.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : item.id)}
                    className="flex w-full flex-col gap-2.5 p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-text">{item.title}</span>
                        <span className="text-xs text-text-subtle">{item.subtitle || item.source}</span>
                      </div>
                      <span className={"mt-0.5 shrink-0 text-text-subtle transition-transform " + (open ? "rotate-90" : "")}>
                        <Icon name="chevron" size={16} />
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <span className="rounded border border-border-strong px-1 py-0.5 font-mono text-[10px]">
                          {item.langCode}
                        </span>
                        {item.langName}
                      </span>
                      <span>·</span>
                      <span>{item.pages} pages</span>
                      <span>·</span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-chart-track">
                          <span className="block h-full rounded-full bg-verified" style={{ width: `${item.pct}%` }} />
                        </span>
                        {item.pct}%
                      </span>
                    </div>
                    <StatusBadge state={item.state} qaFail={item.qaFail} />
                  </button>
                  {open && <DetailPanel item={item} />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
