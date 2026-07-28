import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SectionNav } from "@/components/section-nav";
import { Section } from "@/components/section";
import { Chip } from "@/components/chip";
import { Icon } from "@/components/icon";
import { FidelityCard } from "@/components/fidelity-card";
import { HeroGlyphs } from "@/components/hero-glyphs";
import { KpiGrid, type KpiCardData } from "@/components/kpi-card";
import { Meter } from "@/components/meter";
import { QaDonut } from "@/components/charts/qa-donut";
import { BarChart } from "@/components/charts/bar-chart";
import { CorpusConsole } from "@/components/corpus-console";
import { metrics, qaGlobal, french, german, engine, orchestration } from "@/lib/data";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "metrics", label: "At a glance" },
  { id: "corpus", label: "Corpus" },
  { id: "languages", label: "Languages" },
  { id: "journey", label: "The journey" },
];

const KPI_ICONS: KpiCardData["icon"][] = ["layers", "doc", "type", "checkSeal", "gauge"];

export default function Home() {
  const kpiCards: KpiCardData[] = metrics.map((m, i) => ({
    num: m.num,
    lab: m.lab,
    sub: m.sub,
    icon: KPI_ICONS[i] || "grid",
    verified: m.cls === "green",
  }));

  const journeyCards: KpiCardData[] = orchestration.effort.ledger.map((c, i) => ({
    num: c.num,
    lab: c.lab,
    sub: c.sub,
    icon: (["type", "checkSeal", "grid", "book"] as const)[i],
    verified: i === 1,
  }));

  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <div className="mx-auto max-w-(--content-max) px-4 sm:px-6">
          {/* Hero */}
          <div className="relative grid grid-cols-1 gap-10 overflow-x-hidden py-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-20">
            <HeroGlyphs />
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-link">
                Extraction knowledge base
              </span>
              <h1 className="mt-4 font-display text-4xl font-medium leading-[1.08] tracking-tight text-text sm:text-5xl">
                Nothing paraphrased.
                <br />
                Nothing dropped.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-text-muted">
                Scanned textbooks and exam PDFs, transcribed verbatim and adversarially re-checked until
                every exercise, table, and answer key is accounted for.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Chip>2 languages · {metrics[1]?.num} pages</Chip>
                <Chip ok>{qaGlobal.pct}% QA pass rate</Chip>
                <Chip ok>Zero data loss</Chip>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="#corpus"
                  className="inline-flex h-10 items-center rounded-full bg-brand-700 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-900"
                >
                  Explore the corpus
                </Link>
                <Link
                  href="/engine"
                  className="inline-flex h-10 items-center rounded-full border border-border-strong px-5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
                >
                  See how it works
                </Link>
              </div>
            </div>
            <FidelityCard />
          </div>

          <SectionNav sections={SECTIONS} />

          <Section
            id="overview"
            eyebrow="Overview"
            title="What this engine does"
            lead="A scalable workflow for extracting structured linguistic data from language-learning PDFs and authorized websites — converting textbook and exam content into clean, faithful material for study tools."
          >
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-sm leading-relaxed text-text-muted">
                Sources differ, so each gets the right acquisition path. Scanned workbooks have{" "}
                <strong className="text-text">no text layer</strong>, so content is recovered by
                Claude-vision transcription of 300-DPI page renders; JavaScript-rendered websites are
                handled by an adapter-driven extractor. The guiding principle is the same either way —{" "}
                <span className="font-medium text-link">zero data loss</span>: every heading,
                instruction, table, exercise, blank, example, answer key, caption and page number is
                captured verbatim, then independently verified and repaired until faithful.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-text-muted">
                French and German are both built out. The same pipeline is designed to extend to Japanese,
                Portuguese, Romanian, Russian and Spanish.
              </p>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-verified-strong/20 bg-verified-soft px-4 py-3.5 text-sm text-text">
              <Icon name="checkSeal" size={18} className="mt-0.5 shrink-0 text-verified-strong" />
              <div>
                <b>Faithful, not interpreted.</b> Transcriptions are verbatim. The only added labels are
                navigation aids kept outside the transcription — an inferred CEFR level tag per exercise
                (always marked &ldquo;(inferred)&rdquo;), and the activity/topic tags in the German catalogs.
              </div>
            </div>
          </Section>

          <Section
            id="metrics"
            eyebrow="At a glance"
            title="Extraction so far"
            lead={
              <>
                Live figures from the authoritative per-page state files —{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">
                  french/extracted/manifest.tsv
                </code>{" "}
                and{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">
                  german/extracted/manifest-media.tsv
                </code>
                .
              </>
            }
          >
            <KpiGrid cards={kpiCards} />
            <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface p-6">
                <h3 className="font-display text-lg text-text">Progress by language</h3>
                <p className="mt-1 text-sm text-text-subtle">Share of pages QA-verified so far.</p>
                <div className="mt-4 flex flex-col gap-5">
                  <Meter
                    name="French — QA-verified"
                    value={french.aggregate.verified}
                    of={french.aggregate.spreads}
                    cls="green"
                    unit="spreads"
                  />
                  <Meter
                    name="German — QA-verified"
                    value={german.aggregate.verified}
                    of={german.aggregate.pages}
                    cls="green"
                    unit="pages"
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-6">
                <h3 className="font-display text-lg text-text">QA split, French</h3>
                <p className="mt-1 text-sm text-text-subtle">
                  German is 100% verified with zero QA failures — see the German page for its full
                  breakdown.
                </p>
                <div className="mt-4 flex justify-center">
                  <QaDonut pass={french.aggregate.qaPass} fail={french.aggregate.qaFail} legend />
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-display text-lg text-text">German exercise item types</h3>
              <p className="mt-1 text-sm text-text-subtle">
                {german.aggregate.questions.toLocaleString()} questions extracted across the German corpus,
                by item type.
              </p>
              <div className="mt-4">
                <BarChart data={german.itemTypes.slice(0, 8)} />
              </div>
            </div>
          </Section>

          <Section
            id="corpus"
            eyebrow="Browse"
            title="The corpus"
            lead="Every workbook, exam set, and vocabulary list processed so far — searchable, filterable, and sortable. Select a row to see its detail."
          >
            <CorpusConsole />
          </Section>

          <Section
            id="languages"
            eyebrow="Corpus"
            title="Languages"
            lead="French and German are active; the rest are planned targets for the same pipeline."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {engine.languages.map((l) => {
                const active = l.status === "active";
                const content = (
                  <>
                    <span
                      className={
                        "inline-flex h-9 w-9 items-center justify-center rounded-lg font-mono text-xs font-semibold " +
                        (active ? "bg-brand-100 text-link" : "bg-surface-2 text-text-muted")
                      }
                    >
                      {l.code}
                    </span>
                    <h3 className="mt-3 font-display text-lg text-text">{l.name}</h3>
                    <p className="mt-1 text-sm text-text-muted">
                      {active ? l.meta || `${l.books} books · ${l.spreads} spreads` : "Planned target"}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      {active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-verified-soft px-2.5 py-1 text-xs font-medium text-verified-strong">
                          <span className="h-1.5 w-1.5 rounded-full bg-verified-strong" />
                          active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-muted">
                          <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
                          planned
                        </span>
                      )}
                      {active && (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-link">
                          Explore
                          <Icon name="arrow" size={14} />
                        </span>
                      )}
                    </div>
                  </>
                );
                return active ? (
                  <Link
                    key={l.slug}
                    href={"/" + l.href}
                    className="rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-glow-brand"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={l.slug} className="rounded-2xl border border-border-faint bg-surface-inset p-5">
                    {content}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section
            id="journey"
            eyebrow="Behind the numbers"
            title="What it actually took"
            lead={orchestration.effort.summary}
          >
            <KpiGrid cards={journeyCards} />
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-sm text-text">
              <Icon name="layers" size={18} className="mt-0.5 shrink-0 text-text-subtle" />
              <div>
                <b>Want the full pipeline?</b> The{" "}
                <Link href="/engine" className="text-link underline underline-offset-2">
                  Engine page
                </Link>{" "}
                covers every layer, the model tiers, the cost breakdown, and the exact prompts used at each
                stage.
              </div>
            </div>
          </Section>
        </div>
      </main>
      <Footer brand="Lingotran Engine · Extraction Knowledge Base" />
    </>
  );
}
