"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Icon } from "@/components/icon";
import { humanizeColumn } from "@/lib/csv-explorer-shared";

const OPTION_KEYS = ["option_a", "option_b", "option_c"] as const;
// Fields rendered specially up top (per dataset "nature") -- excluded from
// the generic metadata grid below so nothing appears twice.
const FEATURED_KEYS = new Set([
  "question",
  ...OPTION_KEYS,
  "correct_answer",
  "word",
  "article",
  "plural",
  "example",
  "title",
  "summary",
  "item_type",
  "section",
]);

export function CsvRowDetailDialog({
  row,
  onOpenChange,
}: {
  row: Record<string, string> | null;
  onOpenChange: (open: boolean) => void;
}) {
  const data = row ?? {};
  const isQuestion = Boolean(data.question);
  const isVocab = !isQuestion && Boolean(data.word);
  const isCatalog = !isQuestion && !isVocab && Boolean(data.title || data.summary);

  const metadata = Object.entries(data).filter(([k, v]) => !FEATURED_KEYS.has(k) && v);

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{data.collection || "Row detail"}</DialogTitle>
          {data.source_page && <DialogDescription>Source page {data.source_page}</DialogDescription>}
        </DialogHeader>

        {(data.item_type || data.section) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {data.item_type && (
              <span
                className={
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium " +
                  (data.correct_answer
                    ? "bg-verified-soft text-verified-strong"
                    : "bg-amber-soft text-amber-strong")
                }
              >
                {data.correct_answer && <Icon name="checkSeal" size={12} />}
                {data.item_type}
              </span>
            )}
            {data.section && (
              <span className="inline-flex items-center rounded-full border border-border-strong px-2.5 py-1 text-xs font-medium text-text-muted">
                {data.section}
              </span>
            )}
          </div>
        )}

        {isQuestion && (
          <div className="flex flex-col gap-3">
            <p className="rounded-xl border border-border bg-surface-2 p-4 text-base leading-relaxed text-text">
              {data.question}
            </p>
            {OPTION_KEYS.some((k) => data[k]) && (
              <ul className="flex flex-col gap-1.5 text-sm">
                {OPTION_KEYS.map((k, i) => {
                  if (!data[k]) return null;
                  const letter = String.fromCharCode(97 + i);
                  const isCorrect = data.correct_answer?.trim().toLowerCase() === letter;
                  return (
                    <li
                      key={k}
                      className={
                        "flex items-center gap-2 rounded-lg border px-3 py-2 " +
                        (isCorrect
                          ? "border-verified-strong/30 bg-verified-soft text-verified-strong"
                          : "border-border text-text-muted")
                      }
                    >
                      <span className="font-mono text-xs uppercase">{letter}</span>
                      <span className="flex-1">{data[k]}</span>
                      {isCorrect && <Icon name="check" size={14} />}
                    </li>
                  );
                })}
              </ul>
            )}
            {!OPTION_KEYS.some((k) => data[k]) && data.correct_answer && (
              <p className="text-sm text-text-muted">
                Answer: <span className="font-medium text-text">{data.correct_answer}</span>
              </p>
            )}
          </div>
        )}

        {isVocab && (
          <div className="flex flex-col gap-2">
            <p className="font-display text-2xl text-text">
              {data.article ? `${data.article} ` : ""}
              {data.word}
              {data.plural && <span className="ml-2 text-sm font-sans text-text-subtle">pl. {data.plural}</span>}
            </p>
            {data.example && <p className="text-base italic leading-relaxed text-text-muted">“{data.example}”</p>}
          </div>
        )}

        {isCatalog && (
          <div className="flex flex-col gap-2">
            {data.title && <p className="font-display text-lg text-text">{data.title}</p>}
            {data.summary && <p className="text-sm leading-relaxed text-text-muted">{data.summary}</p>}
          </div>
        )}

        {metadata.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border-faint pt-3 text-sm">
            {metadata.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-text-subtle">{humanizeColumn(k)}</dt>
                <dd className="text-text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}
