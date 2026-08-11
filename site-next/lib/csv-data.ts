import { readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type { ExplorerLang, ExplorerType } from "@/lib/csv-explorer-shared";

export interface CsvMeta {
  columns: string[];
  rowCount: number;
}

const cache = new Map<string, CsvMeta>();

// Reads only the *shape* of a corpus export CSV -- its column names and how
// many rows it has -- at build time, for the page shell's copy and metadata.
//
// It deliberately does NOT return the rows. Handing the parsed rows to the
// client table component serialised the entire dataset into the RSC flight
// payload (2.6 MB of HTML for /explorer/french/questions, to render fifty
// rows), so the table now fetches the static CSV from public/data itself.
// See components/csv-explorer-table.tsx.
//
// These are snapshots copied into public/data at build time -- same freshness
// model as lib/data.ts's hand-maintained stats, not a live read of the source
// repo. Server-only (node:fs); see lib/csv-explorer-shared.ts for the
// isomorphic bits.
export function loadCsvMeta(lang: ExplorerLang, type: ExplorerType): CsvMeta {
  const key = `${lang}/${type}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const filePath = path.join(process.cwd(), "public", "data", lang, `${type}.csv`);
  const text = readFileSync(filePath, "utf-8");

  // Parse the header row only -- `preview: 1` stops Papa after the first data
  // row, so a 1 MB file costs a few hundred bytes of work instead of a full
  // parse we would immediately throw away.
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    preview: 1,
  });

  // Row count without materialising the rows. Counts newlines outside quoted
  // fields, so multi-line quoted cells (common in `question` and `example`)
  // don't inflate the total.
  let rowCount = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') i++; // escaped quote
      else inQuotes = !inQuotes;
    } else if (ch === "\n" && !inQuotes) {
      rowCount++;
    }
  }
  if (text.length && !text.endsWith("\n")) rowCount++; // unterminated last line
  rowCount = Math.max(0, rowCount - 1); // drop the header

  const meta: CsvMeta = { columns: parsed.meta.fields ?? [], rowCount };
  cache.set(key, meta);
  return meta;
}
