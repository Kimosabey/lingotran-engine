import { readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type { ExplorerLang, ExplorerType } from "@/lib/csv-explorer-shared";

export interface CsvTable {
  columns: string[];
  rows: Record<string, string>[];
}

const cache = new Map<string, CsvTable>();

// Reads the real corpus export CSVs copied into public/data/ at build time
// (these are snapshots, same freshness model as lib/data.ts's hand-maintained
// stats, not a live read of the source repo). Parsed once per (lang, type)
// and cached for the rest of the build. Server-only (node:fs) -- never
// import this from a client component; see lib/csv-explorer-shared.ts for
// the isomorphic bits (types, humanizeColumn, publicCsvHref).
export function loadCsv(lang: ExplorerLang, type: ExplorerType): CsvTable {
  const key = `${lang}/${type}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const filePath = path.join(process.cwd(), "public", "data", lang, `${type}.csv`);
  const text = readFileSync(filePath, "utf-8");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const columns = parsed.meta.fields ?? [];
  const table: CsvTable = { columns, rows: parsed.data };
  cache.set(key, table);
  return table;
}
