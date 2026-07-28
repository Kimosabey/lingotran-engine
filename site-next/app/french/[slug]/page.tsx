import type { Metadata } from "next";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";
import { SectionNav, type Section as SectionItem } from "@/components/section-nav";
import { Icon, type IconName } from "@/components/icon";
import { KpiGrid, type KpiCardData } from "@/components/kpi-card";
import { Meter } from "@/components/meter";
import { QaDonut } from "@/components/charts/qa-donut";
import { BarChart } from "@/components/charts/bar-chart";
import { DataTable } from "@/components/data-table";
import { french } from "@/lib/data";

const SLUGS = Object.keys(french.books);

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

function getBook(slug: string) {
  return french.books[slug as keyof typeof french.books];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const book = getBook(slug);
  if (!book) return {};
  const title = `${book.title.split(" — ")[0]} — French corpus — Lingotran Engine`;
  const description = `${book.title} (${book.publisher || "self-published"}, ${french.level}) — extraction coverage, QA results, content breakdown and chapter taxonomy.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/french/${slug}`,
      type: "article",
      images: [{ url: "/img/logo-color.png", width: 118, height: 25, alt: "Lingotran" }],
    },
    twitter: { card: "summary", title, description, images: ["/img/logo-color.png"] },
  };
}

function pctOf(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}% of pages` : "";
}

function statusLabel(book: ReturnType<typeof getBook>) {
  if (!book.transcribed) return "Not started";
  if (/complete/i.test(book.status)) return "Complete";
  return "In progress";
}

export default async function FrenchBookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = getBook(slug);
  if (!book) notFound();

  const notStarted = !book.transcribed;
  const hasCharts = !!book.charts;
  const hasSecondaryCharts = hasCharts && book.charts!.cefr.length > 1;
  const hasAnswerCoverage = hasCharts && !!book.charts!.answerCoverage;

  const sections: SectionItem[] = [
    { id: "overview", label: "Overview" },
    { id: notStarted ? "status" : "progress", label: notStarted ? "Status" : "QA results" },
    ...(hasAnswerCoverage ? [{ id: "answers", label: "Answer coverage" }] : []),
    ...(hasCharts ? [{ id: "breakdown", label: "Content mix" }] : []),
    ...(book.chapters ? [{ id: "chapters", label: "Chapters" }] : []),
    ...(book.units ? [{ id: "units-vocab", label: "Units · Vocabulaire" }, { id: "units-grammar", label: "Units · Grammaire" }] : []),
  ];

  const kpiCards: KpiCardData[] = [
    { num: book.spreads, lab: "Page spreads", icon: "doc" },
    { num: book.transcribed, lab: "Transcribed", sub: pctOf(book.transcribed, book.spreads), icon: "type" },
    { num: book.verified, lab: "QA-verified", sub: pctOf(book.verified, book.spreads), icon: "checkSeal", verified: true },
    { num: book.qaFail, lab: "Flagged for repair", icon: "wrench", verified: false },
  ];

  return (
    <>
      <Header crumbs={[{ label: "French", href: "/french" }, { label: book.title.split(" — ")[0] }]} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <div className="mx-auto max-w-(--content-max) px-4 sm:px-6">
          <div className="py-14 lg:py-16">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">
              French · Book · {statusLabel(book)}
              {book.qaFail > 0 && ` (${book.qaFail} disclosed gaps)`}
            </span>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-text sm:text-5xl">
              {book.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">
              {book.spreads} pages · {french.level.split(" (")[0]} — {book.subtitle}
            </p>
          </div>

          <SectionNav sections={sections} />

          <Section id="overview" eyebrow="Overview" title="About this book">
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-sm leading-relaxed text-text-muted">{book.about.intro}</p>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-text-subtle">source</dt>
                <dd>
                  <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">
                    {book.source}
                  </code>
                </dd>
                {book.author && (
                  <>
                    <dt className="text-text-subtle">author</dt>
                    <dd className="text-text">
                      {book.author}
                      {book.publisher ? " · " + book.publisher : ""}
                    </dd>
                  </>
                )}
                <dt className="text-text-subtle">format</dt>
                <dd className="text-text">{book.about.format}</dd>
                {book.about.statusLine && (
                  <>
                    <dt className="text-text-subtle">status</dt>
                    <dd className="text-text">{book.about.statusLine}</dd>
                  </>
                )}
              </dl>
            </div>
            <div className="mt-5">
              <KpiGrid cards={kpiCards} />
            </div>
          </Section>

          {notStarted ? (
            <Section
              id="status"
              eyebrow="Status"
              title="Extraction status"
              lead={book.progressLead}
            >
              <div className="rounded-2xl border border-border bg-surface p-6">
                <Meter {...book.meters[0]} unit="pages" />
              </div>
              {book.emptyState && (
                <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface py-16 text-center">
                  <Icon name="image" size={22} className="text-text-subtle" />
                  <h4 className="font-display text-lg text-text">{book.emptyState.title}</h4>
                  <p className="max-w-md text-sm text-text-muted">{book.emptyState.body}</p>
                </div>
              )}
              {book.nextUpNote && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-sm text-text">
                  <Icon name="tag" size={18} className="mt-0.5 shrink-0 text-text-subtle" />
                  <div>
                    <b>Next up.</b> {book.nextUpNote}
                  </div>
                </div>
              )}
            </Section>
          ) : (
            <Section
              id="progress"
              eyebrow="Quality assurance"
              title={book.qaFail > 0 || book.qaPass > 0 ? "Adversarial QA verdicts" : "Transcription & QA verdicts"}
              lead={book.progressLead}
            >
              <div className="rounded-2xl border border-border bg-surface p-6">
                <div className="flex flex-col gap-5">
                  {book.meters.map((m) => (
                    <Meter key={m.name} {...m} unit="pages" />
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
                <h3 className="font-display text-lg text-text">QA split</h3>
                {book.qaTotal > 0 && book.qaTotal !== book.spreads && (
                  <p className="mt-1 text-sm text-text-subtle">Of the {book.qaTotal} pages QA-checked so far.</p>
                )}
                <div className="mt-4 flex justify-center">
                  <QaDonut pass={book.qaPass} fail={book.qaFail} legend />
                </div>
              </div>
              {book.qaNote && (
                <div
                  className={
                    "mt-4 flex items-start gap-3 rounded-xl px-4 py-3.5 text-sm text-text " +
                    (book.qaNote.flag ? "border border-flag/20 bg-flag-soft" : "border border-border bg-surface-2")
                  }
                >
                  <Icon
                    name={book.qaNote.icon as IconName}
                    size={18}
                    className={"mt-0.5 shrink-0 " + (book.qaNote.flag ? "text-flag-strong" : "text-text-subtle")}
                  />
                  <div>
                    <b>{book.qaNote.title}</b> {book.qaNote.body}
                  </div>
                </div>
              )}
            </Section>
          )}

          {hasAnswerCoverage && book.answerNote && (
            <Section id="answers" eyebrow="Answer bank" title={book.answerNote.title} lead={book.answerNote.lead}>
              <div className="rounded-2xl border border-border bg-surface p-6">
                <BarChart data={book.charts!.answerCoverage!} />
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-flag/20 bg-flag-soft px-4 py-3.5 text-sm text-text">
                <Icon name="doc" size={18} className="mt-0.5 shrink-0 text-flag-strong" />
                <div>{book.answerNote.body}</div>
              </div>
            </Section>
          )}

          {hasCharts && (
            <Section
              id="breakdown"
              eyebrow="Content breakdown"
              title="What's on the pages"
              lead="Distribution across transcribed pages (a page can carry several content types)."
            >
              <div className="rounded-2xl border border-border bg-surface p-6">
                <h3 className="font-display text-base text-text">Content types</h3>
                <p className="mt-1 text-sm text-text-subtle">Tagged blocks per page</p>
                <div className="mt-4">
                  <BarChart data={book.charts!.contentType} />
                </div>
              </div>
              {hasSecondaryCharts ? (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-surface p-6">
                    <h3 className="font-display text-base text-text">Inferred CEFR level</h3>
                    <p className="mt-1 text-sm text-text-subtle">
                      Per-page level tag — this book doesn&rsquo;t print one, so it&rsquo;s inferred
                    </p>
                    <div className="mt-4">
                      <BarChart data={book.charts!.cefr} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-6">
                    <h3 className="font-display text-base text-text">Scan orientation auto-fix</h3>
                    <p className="mt-1 text-sm text-text-subtle">
                      Clockwise rotation applied during Transcribe — many scans arrived sideways
                    </p>
                    <div className="mt-4">
                      <BarChart data={book.charts!.orientation} />
                    </div>
                  </div>
                </div>
              ) : (
                book.fixedProps && (
                  <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
                    <h3 className="font-display text-base text-text">Fixed properties</h3>
                    <p className="mt-1 text-sm text-text-subtle">Uniform across the whole book — not worth a chart</p>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                      {book.fixedProps.map(([k, v]) => (
                        <Fragment key={k}>
                          <dt className="text-text-subtle">{k}</dt>
                          <dd className="text-text">{v}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </div>
                )
              )}
            </Section>
          )}

          {book.chapters && (
            <Section
              id="chapters"
              eyebrow="Taxonomy"
              title={`Table of contents — ${book.chapters.length} chapters`}
              lead="With the printed start page in the source book."
            >
              <DataTable
                columns={[{ label: "Ch.", align: "right" }, "Chapter", { label: "Printed p.", align: "right" }]}
                rows={book.chapters.map(([n, label, page]) => [
                  <span key="n" className="font-mono text-xs">
                    {n}
                  </span>,
                  label,
                  <span key="p" className="font-mono text-xs">
                    {page}
                  </span>,
                ])}
              />
            </Section>
          )}

          {book.units && (
            <>
              <Section id="units-vocab" eyebrow="Taxonomy · Part 1" title="Vocabulaire — units 1–12">
                <DataTable
                  columns={[{ label: "Unit", align: "right" }, "Topic", { label: "Printed p.", align: "right" }]}
                  rows={book.units.part1.map(([n, label, page]) => [
                    <span key="n" className="font-mono text-xs">
                      {n}
                    </span>,
                    label,
                    <span key="p" className="font-mono text-xs">
                      {page ?? "—"}
                    </span>,
                  ])}
                />
              </Section>
              <Section
                id="units-grammar"
                eyebrow="Taxonomy · Part 2"
                title="Grammaire / Conjugaison — units 13–28"
                lead="Printed start pages shown where legible in the source Sommaire."
              >
                <DataTable
                  columns={[{ label: "Unit", align: "right" }, "Topic", { label: "Printed p.", align: "right" }]}
                  rows={book.units.part2.map(([n, label, page]) => [
                    <span key="n" className="font-mono text-xs">
                      {n}
                    </span>,
                    label,
                    <span key="p" className="font-mono text-xs">
                      {page ?? "—"}
                    </span>,
                  ])}
                />
              </Section>
            </>
          )}
        </div>
      </main>
      <Footer brand={book.title.split(" — ")[0]} variant="book" backHref="/french" />
    </>
  );
}
