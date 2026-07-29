import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";
import { SectionNav } from "@/components/section-nav";
import { Chip } from "@/components/chip";
import { Icon } from "@/components/icon";
import { KpiGrid, type KpiCardData } from "@/components/kpi-card";
import { BarChart } from "@/components/charts/bar-chart";
import { DataTable } from "@/components/data-table";
import { german } from "@/lib/data";

const TITLE = "German corpus — Lingotran Engine";
const DESCRIPTION =
  "The German A1 extraction corpus — Goethe-Zertifikat A1 practice PDFs, scanned textbooks, and authorized web pages, fully QA-verified, with question and vocabulary exports.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/german",
    type: "website",
    images: [{ url: "/img/logo-color.png", width: 1819, height: 571, alt: "Lingotran" }],
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION, images: ["/img/logo-color.png"] },
};

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "channels", label: "Channels" },
  { id: "collections", label: "Collections" },
  { id: "itemtypes", label: "Item types" },
  { id: "exports", label: "Exports" },
  { id: "pipeline", label: "How it was built" },
];

export default function GermanPage() {
  const a = german.aggregate;
  const kpiCards: KpiCardData[] = [
    { num: a.collections, lab: "Book / exam sets", icon: "book" },
    { num: a.pages, lab: "Pages", icon: "doc" },
    { num: a.verified, lab: "QA-verified", sub: "100% zero-loss", icon: "checkSeal", verified: true },
    { num: a.questions.toLocaleString(), lab: "Questions", icon: "type" },
    { num: a.words.toLocaleString(), lab: "Vocabulary words", icon: "tag" },
  ];

  return (
    <>
      <Header crumbs={[{ label: "German" }]} />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 scroll-mt-[calc(var(--topbar-h)+var(--appbar-h))] focus:outline-none"
      >
        <div className="mx-auto max-w-(--content-max) px-4 sm:px-6">
          <div className="py-14 lg:py-16">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-link">
              Corpus · German
            </span>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-text sm:text-5xl">
              German — A1
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">
              Official Goethe-Zertifikat A1 practice material, three scanned A1 textbooks, and authorized
              public web pages — extracted to faithful Markdown, then exported as question and vocabulary
              datasets.
            </p>
          </div>

          <SectionNav sections={SECTIONS} />

          <Section
            id="overview"
            eyebrow="Overview"
            title="The German corpus"
            lead="Two acquisition channels feed one corpus: vision transcription of the Goethe-Institut A1 practice PDFs and scanned textbooks, and adapter-driven extraction of public pages from deutsch-pruefung.de."
          >
            <KpiGrid cards={kpiCards} />
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-verified-strong/20 bg-verified-soft px-4 py-3.5 text-sm text-text">
              <Icon name="checkSeal" size={18} className="mt-0.5 shrink-0 text-verified-strong" />
              <div>
                <b>Every page is level A1</b> — fixed, not inferred, since all sources are single-level by
                definition. Unlike the French books, no per-exercise CEFR inference is needed.
              </div>
            </div>
          </Section>

          <Section
            id="channels"
            eyebrow="Channels"
            title="Where the content comes from"
            lead="Each source type gets the acquisition path that fits it."
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {german.channels.map((c) => (
                <div key={c.name} className="rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-base text-text">{c.name}</h3>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-verified-soft px-2.5 py-1 text-xs font-medium text-verified-strong">
                      <span className="h-1.5 w-1.5 rounded-full bg-verified-strong" />
                      verified
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm text-text-muted">{c.blurb}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Chip>{c.pages} pages</Chip>
                    <Chip ok>{c.verified} verified</Chip>
                  </div>
                  <div className="mt-3 text-xs text-text-subtle">{c.note}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="collections"
            eyebrow="Document sets"
            title="Collections"
            lead="One folder per source PDF, each with its own unified document and export sheets."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Object.entries(german.collections).map(([slug, c]) => (
                <div key={slug} id={"col-" + slug} className="scroll-mt-40 rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base text-text">{c.title}</h3>
                      <div className="mt-0.5 font-mono text-xs text-text-subtle">{c.variant.replace(/-/g, " ")}</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-verified-soft px-2.5 py-1 text-xs font-medium text-verified-strong">
                      <span className="h-1.5 w-1.5 rounded-full bg-verified-strong" />
                      complete
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Chip>{c.pages} pages</Chip>
                    <Chip ok>{c.verified} verified</Chip>
                    {c.questions ? <Chip>{c.questions.toLocaleString()} questions</Chip> : null}
                    {c.words ? <Chip>{c.words.toLocaleString()} words</Chip> : null}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="itemtypes"
            eyebrow="Question bank"
            title="2,830 questions, by item type"
            lead="889 fill-in · 478 matching · 464 short-answer · 297 multiple choice · 282 speaking · 162 true/false · 97 writing · 89 open · 58 ordering · 14 open-ended. 1,864 carry a keyed correct answer; the rest are open-ended Schreiben/Sprechen prompts or items with no printed key."
          >
            <div className="rounded-2xl border border-border bg-surface p-6">
              <BarChart data={german.itemTypes} />
            </div>
          </Section>

          <Section
            id="exports"
            eyebrow="Exports"
            title="What you can open"
            lead="Four deliverables per document set. All CSVs are UTF-8 with BOM, so German umlauts render correctly on double-click in Excel."
          >
            <DataTable
              columns={["Deliverable", "File", "What it holds"]}
              rows={german.exports.map(([name, file, holds]) => [
                <b key={name} className="text-text">
                  {name}
                </b>,
                <code key={file} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">
                  {file}
                </code>,
                holds,
              ])}
            />
            <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-display text-lg text-text">Download the full corpus</h3>
              <p className="mt-1 text-sm text-text-subtle">
                All 4 deliverables per book, plus the combined sheets — ready to use, no setup.
              </p>
              <a
                href="https://drive.google.com/drive/folders/18E9ViYjTW8y7238kmRui6HcPBHLnWt2k?usp=sharing"
                target="_blank"
                rel="noopener"
                className="mt-3.5 inline-flex h-10 items-center rounded-full bg-brand-700 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-900"
              >
                Open in Google Drive
              </a>
            </div>
          </Section>

          <Section
            id="pipeline"
            eyebrow="Process"
            title="How it was built"
            lead="Twelve layers, from raw PDF to export sheet — the expensive vision layers run once, everything downstream regenerates for free."
          >
            <div className="rounded-2xl border border-border bg-surface p-6 text-sm leading-relaxed text-text-muted">
              <p>
                Pages are rendered at 300 DPI, transcribed by a vision agent, then checked by an{" "}
                <strong className="text-text">independent adversarial QA agent</strong> that may not edit —
                only judge. Failures go to a repair agent and are re-verified. Result:{" "}
                <span className="font-medium text-verified-strong">636/636 verified</span> across the
                Goethe PDFs and the three scanned textbooks — zero data loss.
              </p>
              <p className="mt-3">
                Cheap enrichment passes then add activity/topic labels, the question dataset
                (cross-referenced against the Lösungen where one exists), and the word-level vocabulary —
                none of which re-incurs transcription cost. Deliverables are packaged per-publisher under{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">
                  german/extracted/_exports/
                </code>
                .
              </p>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-sm text-text">
              <Icon name="layers" size={18} className="mt-0.5 shrink-0 text-text-subtle" />
              <div>
                Want the layer-by-layer detail? The{" "}
                <a href="/engine" className="text-link underline underline-offset-2">
                  Engine page
                </a>{" "}
                covers every layer, the model tiers, and the cost breakdown for the full pipeline (both
                languages).
              </div>
            </div>
          </Section>
        </div>
      </main>
      <Footer brand="Lingotran Engine · German corpus" />
    </>
  );
}
