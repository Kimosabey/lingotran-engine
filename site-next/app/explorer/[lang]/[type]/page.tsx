import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CsvExplorerTable } from "@/components/csv-explorer-table";
import { KpiGrid, type KpiCardData } from "@/components/kpi-card";
import { loadCsv } from "@/lib/csv-data";
import {
  EXPLORER_LANGS,
  EXPLORER_TYPES,
  publicCsvHref,
  type ExplorerLang,
  type ExplorerType,
} from "@/lib/csv-explorer-shared";

const LANG_LABEL: Record<ExplorerLang, string> = { french: "French", german: "German" };
const TYPE_LABEL: Record<ExplorerType, string> = {
  catalog: "Catalog",
  questions: "Questions",
  vocabulary: "Vocabulary",
};
const TYPE_LEAD: Record<ExplorerType, string> = {
  catalog: "Every page in the corpus, one row each — content type, activity, topic, level, and QA status.",
  questions: "Every exam/exercise item extracted, with its options and keyed answer where one exists.",
  vocabulary: "Every vocabulary entry extracted, with article, plural, and an example in context.",
};

// Quick-filter dropdowns per dataset -- every genuinely categorical column
// (including "collection", i.e. filter by book), skipping free-text fields
// (question/summary/example/title/word) and, deliberately, catalog's
// "content_type": verified against the real data it's a combined bracketed
// tag list per page (e.g. "[chapter-opener, lesson, exercise]"), 384 distinct
// values across 584 French rows -- a dropdown that size helps no one.
// "activity_type" is the clean single-category equivalent (15-16 values).
const QUICK_FILTER_COLUMNS: Record<ExplorerType, string[]> = {
  catalog: ["collection", "activity_type", "level", "status", "qa"],
  questions: ["collection", "item_type", "topic"],
  vocabulary: ["collection", "topic", "word_class"],
};

// Curated "at a glance" columns shown by default (the rest stay filterable/
// exportable and always appear in the row-detail dialog on click, just
// behind the "Show all columns" toggle) -- keeps a 13-column table from
// forcing horizontal scroll on every viewport by default.
const PRIMARY_COLUMNS: Record<ExplorerType, string[]> = {
  catalog: ["collection", "unit", "activity_type", "level", "qa", "word_count"],
  questions: ["collection", "section", "item_type", "question", "correct_answer"],
  vocabulary: ["collection", "word", "article", "topic"],
};

function computeStats(type: ExplorerType, rows: Record<string, string>[]): KpiCardData[] {
  const total = rows.length;
  const collections = new Set(rows.map((r) => r.collection)).size;
  if (type === "catalog") {
    const verified = rows.filter((r) => r.qa === "pass").length;
    return [
      { num: total, lab: "Rows", icon: "doc" },
      { num: collections, lab: "Collections", icon: "layers" },
      { num: `${Math.round((verified / total) * 100)}%`, lab: "QA pass rate", icon: "checkSeal", verified: true },
      { num: new Set(rows.map((r) => r.activity_type)).size, lab: "Activity types", icon: "grid" },
    ];
  }
  if (type === "questions") {
    const withAnswer = rows.filter((r) => r.correct_answer).length;
    return [
      { num: total, lab: "Rows", icon: "doc" },
      { num: collections, lab: "Collections", icon: "layers" },
      {
        num: `${Math.round((withAnswer / total) * 100)}%`,
        lab: "With answer key",
        icon: "checkSeal",
        verified: true,
      },
      { num: new Set(rows.map((r) => r.item_type)).size, lab: "Item types", icon: "grid" },
    ];
  }
  const withExample = rows.filter((r) => r.example).length;
  return [
    { num: total, lab: "Rows", icon: "doc" },
    { num: collections, lab: "Collections", icon: "layers" },
    { num: `${Math.round((withExample / total) * 100)}%`, lab: "With example", icon: "checkSeal", verified: true },
    { num: new Set(rows.map((r) => r.topic)).size, lab: "Topics", icon: "grid" },
  ];
}

export function generateStaticParams() {
  return EXPLORER_LANGS.flatMap((lang) => EXPLORER_TYPES.map((type) => ({ lang, type })));
}

function isLang(v: string): v is ExplorerLang {
  return (EXPLORER_LANGS as string[]).includes(v);
}
function isType(v: string): v is ExplorerType {
  return (EXPLORER_TYPES as string[]).includes(v);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; type: string }>;
}): Promise<Metadata> {
  const { lang, type } = await params;
  if (!isLang(lang) || !isType(type)) return {};
  const title = `${LANG_LABEL[lang]} ${TYPE_LABEL[type]} — Explorer — Lingotran Engine`;
  const description = TYPE_LEAD[type];
  return {
    title,
    description,
    openGraph: { title, description, url: `/explorer/${lang}/${type}`, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function ExplorerPage({
  params,
}: {
  params: Promise<{ lang: string; type: string }>;
}) {
  const { lang, type } = await params;
  if (!isLang(lang) || !isType(type)) notFound();

  const { columns, rows } = loadCsv(lang, type);

  return (
    <>
      <Header
        wide
        crumbs={[{ label: "Explorer", href: "/explorer/french/catalog" }, { label: LANG_LABEL[lang] }]}
      />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 scroll-mt-[calc(var(--topbar-h)+var(--appbar-h))] focus:outline-none"
      >
        <div className="mx-auto max-w-(--content-max-wide) px-4 sm:px-6">
          <div className="py-14 lg:py-16">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-link">Explorer</span>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-text sm:text-5xl">
              {LANG_LABEL[lang]} {TYPE_LABEL[type]}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">{TYPE_LEAD[type]}</p>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <nav aria-label="Language" className="flex items-center gap-1 rounded-full border border-border-strong p-1">
              {EXPLORER_LANGS.map((l) => (
                <Link
                  key={l}
                  href={`/explorer/${l}/${type}`}
                  className={
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
                    (l === lang ? "bg-brand-100 text-link" : "text-text-muted hover:bg-surface-2 hover:text-text")
                  }
                >
                  {LANG_LABEL[l]}
                </Link>
              ))}
            </nav>
            <nav aria-label="Dataset" className="flex items-center gap-1 rounded-full border border-border-strong p-1">
              {EXPLORER_TYPES.map((t) => (
                <Link
                  key={t}
                  href={`/explorer/${lang}/${t}`}
                  className={
                    "relative rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
                    (t === type ? "bg-brand-100 text-link" : "text-text-muted hover:bg-surface-2 hover:text-text")
                  }
                >
                  {TYPE_LABEL[t]}
                </Link>
              ))}
            </nav>
            <span className="text-xs text-text-subtle">{columns.length} columns</span>
          </div>

          <div className="mb-6">
            <KpiGrid cards={computeStats(type, rows)} />
          </div>

          <div className="pb-16">
            <CsvExplorerTable
              columns={columns}
              rows={rows}
              downloadHref={publicCsvHref(lang, type)}
              fileBaseName={`lingotran-${lang}-${type}`}
              quickFilterColumns={QUICK_FILTER_COLUMNS[type]}
              primaryColumns={PRIMARY_COLUMNS[type]}
            />
          </div>
        </div>
      </main>
      <Footer wide brand="Lingotran Engine · Extraction Knowledge Base" />
    </>
  );
}
