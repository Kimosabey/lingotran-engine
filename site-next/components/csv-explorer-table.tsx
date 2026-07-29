"use client";

import { useMemo, useState } from "react";
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
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Icon } from "@/components/icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CsvRowDetailDialog } from "@/components/csv-row-detail-dialog";
import { humanizeColumn } from "@/lib/csv-explorer-shared";

const ALL_VALUE = "__all__";

const PDF_ROW_CAP = 500;
const PAGE_SIZE = 50;

// Left-edge accent color by row status -- reuses the exact accent-bar
// pattern already shipped on the appbar/mobile-nav active state, driven by
// whichever status-shaped column this dataset actually has (catalog's `qa`,
// questions' `correct_answer`, either dataset's `status`). No accent when a
// row carries no real status signal (e.g. vocabulary rows).
function rowAccentColor(row: Record<string, string>): string | undefined {
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

export function CsvExplorerTable({
  columns: rawColumns,
  rows,
  downloadHref,
  fileBaseName,
  quickFilterColumns = [],
  primaryColumns,
}: {
  columns: string[];
  rows: Record<string, string>[];
  downloadHref: string;
  fileBaseName: string;
  /** Columns to surface as quick-filter dropdowns (e.g. ["level", "content_type"]). */
  quickFilterColumns?: string[];
  /** Columns shown by default in the (often 13+-column-wide) table -- the
   * rest stay fully sortable/filterable/exportable, just tucked behind the
   * "Show all columns" toggle and always visible in the row-detail dialog. */
  primaryColumns?: string[];
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showAllColumns, setShowAllColumns] = useState(!primaryColumns);
  const [selectedRow, setSelectedRow] = useState<Record<string, string> | null>(null);

  const columns = useMemo<ColumnDef<Record<string, string>>[]>(
    () =>
      rawColumns.map((key) => ({
        accessorKey: key,
        header: humanizeColumn(key),
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
    data: rows,
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

  // Quick-filter dropdown options are the real distinct values in each
  // column (computed from the full dataset, not the currently-filtered
  // view, so switching one filter never hides options for the others).
  const filterOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of quickFilterColumns) {
      const values = new Set<string>();
      for (const r of rows) {
        const v = r[col];
        if (v) values.add(v);
      }
      map[col] = Array.from(values).sort();
    }
    return map;
  }, [quickFilterColumns, rows]);

  function exportCsv() {
    const csv = Papa.unparse(filteredRows.map((r) => r.original));
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${fileBaseName}.csv`);
  }

  function exportXlsx() {
    const sheet = XLSX.utils.json_to_sheet(filteredRows.map((r) => r.original));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
    XLSX.writeFile(wb, `${fileBaseName}.xlsx`);
  }

  function exportPdf() {
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
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3">
          <Icon name="search" size={15} className="text-text-subtle" />
          <input
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search this dataset…"
            aria-label="Search this dataset"
            className="h-full flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
          />
        </div>
        {quickFilterColumns.map((col) => (
          <Select
            key={col}
            value={(table.getColumn(col)?.getFilterValue() as string) ?? ALL_VALUE}
            onValueChange={(v) => table.getColumn(col)?.setFilterValue(v === ALL_VALUE ? undefined : v)}
          >
            <SelectTrigger
              aria-label={`Filter by ${humanizeColumn(col)}`}
              className="h-9 rounded-full border-border bg-surface px-3 text-sm text-text"
            >
              <SelectValue>
                {(v: string) => (!v || v === ALL_VALUE ? `All ${humanizeColumn(col).toLowerCase()}` : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All {humanizeColumn(col).toLowerCase()}</SelectItem>
              {filterOptions[col]?.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {primaryColumns && (
          <button
            type="button"
            onClick={() => setShowAllColumns((s) => !s)}
            aria-pressed={showAllColumns}
            className={
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors " +
              (showAllColumns
                ? "border-brand-300 bg-brand-100 text-link"
                : "border-border-strong text-text-muted hover:bg-surface-2 hover:text-text")
            }
          >
            <Icon name="grid" size={14} />
            {showAllColumns ? `All ${rawColumns.length} columns` : `${primaryColumns.length} of ${rawColumns.length} columns`}
          </button>
        )}
        <a
          href={downloadHref}
          download
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Icon name="file" size={14} />
          Download full CSV
        </a>
        <div className="flex items-center gap-1 rounded-full border border-border-strong p-1">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportXlsx}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            Export XLSX
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            Export PDF
          </button>
        </div>
        <span className="ml-auto text-xs text-text-subtle" aria-live="polite">
          <b className="text-text">{filteredRows.length}</b> of {rows.length} rows
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
          <p className="text-xs text-text-subtle">Click any row for its full detail.</p>
          {/* Deliberately NOT .no-scrollbar, unlike the rest of the site --
              this table can run to a dozen-plus columns and is the one place
              on the site where a visible native scrollbar is the correct,
              expected affordance (same reasoning any spreadsheet/Notion/
              Airtable table follows), not a decorative-chrome scroller like
              the nav pills or breadcrumbs. */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-text-subtle">
                    {hg.headers.map((header) => {
                      const sort = header.column.getIsSorted();
                      return (
                        <th key={header.id} className="px-4 py-3">
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
              className="inline-flex h-8 items-center rounded-full border border-border-strong px-3 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-text-subtle">
              Page <b className="text-text">{table.getState().pagination.pageIndex + 1}</b> of{" "}
              {table.getPageCount() || 1}
            </span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="inline-flex h-8 items-center rounded-full border border-border-strong px-3 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-40"
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
