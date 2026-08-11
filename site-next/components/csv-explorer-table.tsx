"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Icon } from "@/components/icon";
import { SelectField, SearchField } from "@/components/select-field";
import { CsvRowDetailDialog } from "@/components/csv-row-detail-dialog";
import { KpiGrid, type KpiCardData } from "@/components/kpi-card";
import { humanizeColumn, type ExplorerType } from "@/lib/csv-explorer-shared";

const ALL_VALUE = "__all__";
const PDF_ROW_CAP = 500;
const PAGE_SIZE = 50;

type Row = Record<string, string>;

// Computed from whatever rows are CURRENTLY visible (post search + quick
// filters), not the full dataset -- otherwise these numbers silently stop
// meaning anything the moment you filter (a "584 rows" card sitting above a
// table you've filtered down to 12 rows reads as broken, not "corpus-wide").
function computeStats(type: ExplorerType, rows: Row[]): KpiCardData[] {
  const total = rows.length;
  const collections = new Set(rows.map((r) => r.collection)).size;
  const pct = (n: number) => (total === 0 ? "—" : `${Math.round((n / total) * 100)}%`);
  if (type === "catalog") {
    const verified = rows.filter((r) => r.qa === "pass").length;
    return [
      { num: total, lab: "Rows", icon: "doc" },
      { num: collections, lab: "Collections", icon: "layers" },
      { num: pct(verified), lab: "QA pass rate", icon: "checkSeal", verified: true },
      { num: new Set(rows.map((r) => r.activity_type)).size, lab: "Activity types", icon: "grid" },
    ];
  }
  if (type === "questions") {
    const withAnswer = rows.filter((r) => r.correct_answer).length;
    return [
      { num: total, lab: "Rows", icon: "doc" },
      { num: collections, lab: "Collections", icon: "layers" },
      { num: pct(withAnswer), lab: "With answer key", icon: "checkSeal", verified: true },
      { num: new Set(rows.map((r) => r.item_type)).size, lab: "Item types", icon: "grid" },
    ];
  }
  const withExample = rows.filter((r) => r.example).length;
  return [
    { num: total, lab: "Rows", icon: "doc" },
    { num: collections, lab: "Collections", icon: "layers" },
    { num: pct(withExample), lab: "With example", icon: "checkSeal", verified: true },
    { num: new Set(rows.map((r) => r.topic)).size, lab: "Topics", icon: "grid" },
  ];
}

// Left-edge accent color by row status -- reuses the accent-bar pattern
// already shipped on the appbar/mobile-nav active state, driven by whichever
// status-shaped column this dataset actually has. No accent when a row
// carries no real status signal (e.g. vocabulary rows).
function rowAccentColor(row: Row): string | undefined {
  if (row.qa === "pass") return "var(--verified-strong)";
  if (row.qa === "fail") return "var(--flag-strong)";
  if (row.correct_answer) return "var(--verified-strong)";
  const status = row.status?.toLowerCase();
  if (status) {
    if (status.includes("fail")) return "var(--flag-strong)";
    if (status.includes("pass") || status.includes("verified") || status.includes("done")) {
      return "var(--verified-strong)";
    }
  }
  return undefined;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SkeletonTable() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[132px] animate-pulse rounded-2xl border border-border bg-surface-2" />
        ))}
      </div>
      <div className="h-10 animate-pulse rounded-full bg-surface-2" />
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b border-border-faint p-4 last:border-0">
            <div className="h-4 animate-pulse rounded bg-surface-2" style={{ width: `${88 - i * 6}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CsvExplorerTable({
  type,
  csvHref,
  fileBaseName,
  quickFilterColumns = [],
  primaryColumns,
  rowCountHint,
}: {
  type: ExplorerType;
  /** Static CSV in public/data. Fetched by the browser rather than serialised
   * into the RSC payload -- see the note in the loader effect below. */
  csvHref: string;
  fileBaseName: string;
  /** Columns to surface as quick-filter dropdowns (e.g. ["level", "topic"]). */
  quickFilterColumns?: string[];
  /** Columns shown by default in the (often 13+-column-wide) table -- the
   * rest stay fully sortable/filterable/exportable, just tucked behind the
   * "Show all columns" toggle and always visible in the row-detail dialog. */
  primaryColumns?: string[];
  /** Known row count, for the loading copy. */
  rowCountHint?: number;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [rawColumns, setRawColumns] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showAllColumns, setShowAllColumns] = useState(!primaryColumns);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // The dataset is fetched, not passed down as a prop.
  //
  // It used to be read on the server and handed to this client component
  // directly, which serialised all 6,914 rows x 13 columns into the RSC
  // flight payload -- twice, once inline in the HTML and once in the .rsc.
  // /explorer/french/questions was a 2.6 MB HTML document whose table shows
  // fifty rows at a time. The CSVs are already public, static, individually
  // cacheable assets (they're what the "Download full CSV" button links to),
  // so the browser fetching one directly is both smaller and cached
  // separately from the page shell.
  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setLoadError(null);
    fetch(csvHref)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
        setRawColumns(parsed.meta.fields ?? []);
        setRows(parsed.data);
      })
      .catch(() => {
        if (!cancelled) setLoadError("We couldn't load this dataset.");
      });
    return () => {
      cancelled = true;
    };
  }, [csvHref]);

  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      rawColumns.map((key) => ({
        accessorKey: key,
        header: humanizeColumn(key),
        // Quick filters pick one exact value from a closed dropdown list, so
        // column filtering must be exact-match -- the default (includesString,
        // substring) made picking "A2" also match "A2 (inferred)" and "A2+B1",
        // silently over-including rows instead of narrowing to just the chosen
        // value. Global search (the free-text box) is unaffected: it uses its
        // own separate globalFilterFn, not this per-column one.
        filterFn: "equalsString",
        cell: (info) => {
          const v = info.getValue<string>();
          return v || <span className="text-text-subtle">—</span>;
        },
      })),
    [rawColumns]
  );

  const columnVisibility = useMemo<VisibilityState>(() => {
    if (showAllColumns || !primaryColumns) return {};
    const vis: VisibilityState = {};
    for (const c of rawColumns) vis[c] = primaryColumns.includes(c);
    return vis;
  }, [showAllColumns, primaryColumns, rawColumns]);

  const table = useReactTable({
    data: rows ?? [],
    columns,
    state: { globalFilter, columnFilters, sorting, columnVisibility },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  const filteredRows = table.getFilteredRowModel().rows;

  const statCards = useMemo(
    () => computeStats(type, filteredRows.map((r) => r.original)),
    [type, filteredRows]
  );

  // Quick-filter dropdown options are the real distinct values in each column
  // (computed from the full dataset, not the currently-filtered view, so
  // switching one filter never hides options for the others).
  const filterOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of quickFilterColumns) {
      const values = new Set<string>();
      for (const r of rows ?? []) {
        const v = r[col];
        if (v) values.add(v);
      }
      map[col] = Array.from(values).sort();
    }
    return map;
  }, [quickFilterColumns, rows]);

  const visibleData = () => filteredRows.map((r) => r.original);

  function exportCsv() {
    const csv = Papa.unparse(visibleData());
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${fileBaseName}.csv`);
  }

  // xlsx and jspdf are ~285 KB together and were statically imported at module
  // scope, so every Explorer visitor downloaded both export engines whether or
  // not they ever clicked Export. Loading them on the click instead fits
  // comfortably inside the interaction budget the click already has.
  async function exportXlsx() {
    setExporting("xlsx");
    try {
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.json_to_sheet(visibleData());
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
      XLSX.writeFile(wb, `${fileBaseName}.xlsx`);
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    setExporting("pdf");
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const capped = filteredRows.slice(0, PDF_ROW_CAP);
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(9);
      const title =
        filteredRows.length > PDF_ROW_CAP
          ? `${fileBaseName} — showing first ${PDF_ROW_CAP} of ${filteredRows.length} filtered rows`
          : `${fileBaseName} — ${filteredRows.length} rows`;
      doc.text(title, 14, 10);
      autoTable(doc, {
        startY: 14,
        styles: { fontSize: 7, cellWidth: "wrap" },
        head: [rawColumns.map(humanizeColumn)],
        body: capped.map((r) => rawColumns.map((c) => r.original[c] ?? "")),
      });
      doc.save(`${fileBaseName}.pdf`);
    } finally {
      setExporting(null);
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-flag/25 bg-flag-soft py-16 text-center">
        <Icon name="wrench" size={22} className="text-flag-strong" />
        <h3 className="font-display text-lg text-text">{loadError}</h3>
        <p className="max-w-md text-sm text-text-muted">
          The table couldn&rsquo;t fetch its data. You can still download the full file directly.
        </p>
        <a
          href={csvHref}
          download
          className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-medium text-white"
        >
          <Icon name="file" size={14} />
          Download the CSV
        </a>
      </div>
    );
  }

  if (rows === null) {
    return (
      <>
        <p className="sr-only" role="status">
          Loading {rowCountHint ? rowCountHint.toLocaleString() + " " : ""}rows…
        </p>
        <noscript>
          <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted">
            This table needs JavaScript to filter and sort {rowCountHint?.toLocaleString()} rows.{" "}
            <a href={csvHref} download className="text-link underline underline-offset-2">
              Download the full CSV
            </a>{" "}
            instead — it holds exactly the same data.
          </div>
        </noscript>
        <SkeletonTable />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid cards={statCards} />

      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={globalFilter}
          onChange={setGlobalFilter}
          placeholder="Search this dataset…"
          label="Search this dataset"
        />
        {quickFilterColumns.map((col) => (
          <SelectField
            key={col}
            label={`Filter by ${humanizeColumn(col)}`}
            value={(table.getColumn(col)?.getFilterValue() as string) ?? ALL_VALUE}
            onChange={(v) => table.getColumn(col)?.setFilterValue(v === ALL_VALUE ? undefined : v)}
            options={[
              { value: ALL_VALUE, label: `All ${humanizeColumn(col).toLowerCase()}` },
              ...(filterOptions[col] ?? []).map((v) => ({ value: v, label: v })),
            ]}
          />
        ))}
        {primaryColumns && (
          <button
            type="button"
            onClick={() => setShowAllColumns((s) => !s)}
            aria-pressed={showAllColumns}
            className={
              "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors " +
              (showAllColumns
                ? "border-brand-500 bg-brand-100 text-link"
                : "border-border-control text-text-muted hover:bg-surface-2 hover:text-text")
            }
          >
            <Icon name="grid" size={14} />
            {showAllColumns
              ? `All ${rawColumns.length} columns`
              : `${primaryColumns.length} of ${rawColumns.length} columns`}
          </button>
        )}
        <a
          href={csvHref}
          download
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border-control px-3.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Icon name="file" size={14} />
          Download full CSV
        </a>
        <div className="flex items-center gap-1 rounded-full border border-border-control p-1">
          {(
            [
              ["CSV", exportCsv, "csv"],
              ["XLSX", exportXlsx, "xlsx"],
              ["PDF", exportPdf, "pdf"],
            ] as const
          ).map(([label, fn, key]) => (
            <button
              key={key}
              type="button"
              onClick={fn}
              disabled={exporting !== null}
              className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
            >
              {exporting === key ? "Exporting…" : `Export ${label}`}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-text-subtle" aria-live="polite">
          <b className="text-text">{filteredRows.length.toLocaleString()}</b> of {rows.length.toLocaleString()} rows
        </span>
      </div>

      {filteredRows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface py-16 text-center">
          <Icon name="search" size={22} className="text-text-subtle" />
          <h4 className="font-display text-lg text-text">No matches</h4>
          <p className="text-sm text-text-muted">Try a different search term or filter.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-text-subtle">Select any row for its full detail.</p>
          {/* Deliberately NOT .no-scrollbar, unlike the rest of the site --
              this table can run to a dozen-plus columns and is the one place
              on the site where a visible native scrollbar is the correct,
              expected affordance (the same reasoning any spreadsheet follows),
              not a decorative-chrome scroller like the nav pills. */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr
                    key={hg.id}
                    className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-text-subtle"
                  >
                    {hg.headers.map((header) => {
                      const sort = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none"}
                          className="px-4 py-3"
                        >
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 whitespace-nowrap hover:text-text"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sort === "asc" && <Icon name="chevronDown" size={12} className="rotate-180" />}
                            {sort === "desc" && <Icon name="chevronDown" size={12} />}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => {
                  const accent = rowAccentColor(row.original);
                  return (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedRow(row.original)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedRow(row.original);
                        }
                      }}
                      style={accent ? { borderLeftColor: accent } : undefined}
                      className={
                        "cursor-pointer border-b border-border-faint transition-colors last:border-0 hover:bg-surface-2 " +
                        (accent ? "border-l-[3px]" : "")
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="max-w-[320px] truncate px-4 py-2.5 text-text-muted">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="inline-flex h-10 items-center rounded-full border border-border-control px-4 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-text-subtle" aria-live="polite">
              Page <b className="text-text">{table.getState().pagination.pageIndex + 1}</b> of{" "}
              {table.getPageCount() || 1}
            </span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="inline-flex h-10 items-center rounded-full border border-border-control px-4 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      <CsvRowDetailDialog row={selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)} />
    </div>
  );
}
