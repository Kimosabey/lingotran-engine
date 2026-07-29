// Isomorphic helpers for the CSV explorer -- safe to import from client
// components. Anything touching node:fs/node:path lives in csv-data.ts
// instead (server-only, imported only by the explorer page).

export type ExplorerLang = "french" | "german";
export type ExplorerType = "catalog" | "questions" | "vocabulary";

export const EXPLORER_LANGS: ExplorerLang[] = ["french", "german"];
export const EXPLORER_TYPES: ExplorerType[] = ["catalog", "questions", "vocabulary"];

export function publicCsvHref(lang: ExplorerLang, type: ExplorerType): string {
  return `/data/${lang}/${type}.csv`;
}

export function humanizeColumn(name: string): string {
  if (name.toLowerCase() === "qa") return "QA";
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
