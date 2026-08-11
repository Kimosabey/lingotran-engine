import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";
import { SectionNav } from "@/components/section-nav";
import { Chip } from "@/components/chip";
import { StatusBadge } from "@/components/status-badge";
import { Icon } from "@/components/icon";
import { KpiGrid, type KpiCardData } from "@/components/kpi-card";
import { Meter } from "@/components/meter";
import { QaDonut } from "@/components/charts/qa-donut";
import { french } from "@/lib/data";

const TITLE = "French corpus — Lingotran Engine";
const DESCRIPTION =
  "Three French A1/A2 workbooks — Cosmopolite 1, Pratique Conjugaison, and Pratique Révision 2 — transcribed verbatim and QA-verified.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/french",
    type: "website",
    images: [{ url: "/img/logo-color.png", width: 1819, height: 571, alt: "Lingotran" }],
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION, images: ["/img/logo-color.png"] },
};

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "progress", label: "Progress by book" },
  { id: "books", label: "Books" },
];

function pctOf(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}% of pages` : "";
}

export default function FrenchIndexPage() {
  const a = french.aggregate;
  const kpiCards: KpiCardData[] = [
    { num: a.books, lab: "Workbooks", icon: "book" },
    { num: a.spreads, lab: "Page spreads", icon: "doc" },
    { num: a.transcribed, lab: "Transcribed", sub: pctOf(a.transcribed, a.spreads), icon: "type" },
    { num: a.verified, lab: "QA-verified", sub: pctOf(a.verified, a.spreads), icon: "checkSeal", verified: true },
  ];
  const books = Object.values(french.books);

  return (
    <>
      <Header crumbs={[{ label: "French" }]} />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 scroll-mt-(--sticky-stack) focus:outline-none"
      >
        <div className="mx-auto max-w-(--content-max) px-4 sm:px-6">
          <div className="py-14 lg:py-16">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-link">
              Corpus · French
            </span>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-text sm:text-5xl">
              French — A1 &amp; A2
            </h1>
            <p className="mt-4 max-w-(--prose-max) text-base leading-relaxed text-text-muted">
              Coursebooks from Hachette FLE, CLE International, and Oxford University Press,
              vision-transcribed page by page and adversarially re-checked for anything a scan could hide.
            </p>
          </div>

          <SectionNav sections={SECTIONS} />

          <Section
            id="overview"
            eyebrow="Overview"
            title="Multiple workbooks, one pipeline"
            lead="Coursebooks and verb/vocabulary revision workbooks, each run through the same transcribe → QA → repair cycle."
          >
            <KpiGrid cards={kpiCards} />
            <div className="mt-4 flex max-w-3xl items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-sm text-text">
              <Icon name="tag" size={18} className="mt-0.5 shrink-0 text-text-subtle" />
              <div>
                <b>Level convention differs by book.</b> Cosmopolite 1 is fixed — the whole book is A1,
                uniformly. The legacy workbooks don&rsquo;t print a level per exercise; &ldquo;A1/A2&rdquo;
                is the book&rsquo;s overall scope, with a per-exercise level inferred during transcription
                and always tagged &ldquo;(inferred)&rdquo;.
              </div>
            </div>
          </Section>

          <Section
            id="progress"
            eyebrow="Status"
            title="Progress by book"
            lead="Each book moves through the same pipeline at its own pace — some complete with disclosed gaps, some mid-flight, some queued."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {books.map((b) => (
                <div key={b.slug} className="rounded-2xl border border-border bg-surface p-5">
                  <h3 className="font-display text-base text-text">{b.title.split(" — ")[0]}</h3>
                  <div className="mt-3 flex flex-col gap-4">
                    {b.meters.map((m) => (
                      <Meter key={m.name} {...m} unit="pages" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-display text-lg text-text">QA split, across all books</h3>
              <p className="mt-1 text-sm text-text-subtle">
                {a.verified} of {a.spreads} spreads QA-verified so far; {a.qaPass} clean, {a.qaFail} flagged
                and either repaired or disclosed.
              </p>
              <div className="mt-4 flex justify-center">
                <QaDonut pass={a.qaPass} fail={a.qaFail} legend />
              </div>
            </div>
          </Section>

          <Section
            id="books"
            eyebrow="Browse"
            title="The books"
            lead="Open a book for its full chapter/unit index, content-type mix, and disclosed gaps."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {books.map((b) => (
                <Link
                  key={b.slug}
                  href={"/french/" + b.slug}
                  className="rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-glow-brand"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg text-text">{b.title}</h3>
                      <div className="mt-0.5 font-mono text-xs text-text-subtle">{b.source}</div>
                    </div>
                    <StatusBadge
                      state={!b.transcribed ? "not-started" : /complete/i.test(b.status) ? "complete" : "in-progress"}
                      qaFail={b.qaFail}
                    />
                  </div>
                  <p className="mt-3 text-sm text-text-muted">{b.subtitle}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Chip>{b.spreads} spreads</Chip>
                    <Chip>{b.transcribed} transcribed</Chip>
                    <Chip ok>{b.verified} verified</Chip>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-text-subtle">
                      {b.author ? b.author + (b.publisher ? " · " + b.publisher : "") : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-link">
                      Open
                      <Icon name="arrow" size={14} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-display text-lg text-text">Download the full corpus</h3>
              <p className="mt-1 text-sm text-text-subtle">
                Every book&rsquo;s deliverables so far, plus the combined sheets — ready to use, no setup.
              </p>
              <a
                href={french.driveUrl}
                target="_blank"
                rel="noopener"
                className="mt-3.5 inline-flex h-10 items-center rounded-full bg-brand-700 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-900"
              >
                Open in Google Drive
              </a>
            </div>
          </Section>
        </div>
      </main>
      <Footer brand="Lingotran Engine · French corpus" />
    </>
  );
}
