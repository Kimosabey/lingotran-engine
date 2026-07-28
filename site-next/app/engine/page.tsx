import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";
import { SectionNav } from "@/components/section-nav";
import { Chip } from "@/components/chip";
import { Icon, type IconName } from "@/components/icon";
import { KpiGrid, type KpiCardData } from "@/components/kpi-card";
import { CodeBlock } from "@/components/code-block";
import { CostDonut } from "@/components/charts/cost-donut";
import { BarChart } from "@/components/charts/bar-chart";
import { orchestration, workflow } from "@/lib/data";

const TITLE = "The Engine — Lingotran Engine";
const DESCRIPTION =
  "How the Lingotran engine is orchestrated — the layers, roles, agents and models behind zero-data-loss extraction, with the honest cost picture.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/engine",
    type: "website",
    images: [{ url: "/img/logo-color.png", width: 1819, height: 571, alt: "Lingotran" }],
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION, images: ["/img/logo-color.png"] },
};

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "flow", label: "The flow" },
  { id: "usecases", label: "Use cases" },
  { id: "roles", label: "Roles & agents" },
  { id: "models", label: "Models" },
  { id: "layers", label: "The layers" },
  { id: "cost", label: "Cost & efficiency" },
  { id: "effort", label: "The journey" },
  { id: "prompts", label: "Prompts" },
];

const KIND_LABEL: Record<string, string> = { vision: "vision", text: "text", free: "free" };
const KIND_ICON: Record<string, IconName> = { vision: "eye", text: "type", free: "cpu" };
const KIND_BG: Record<string, string> = {
  vision: "bg-brand-100 text-link",
  text: "bg-amber-soft text-amber-strong",
  free: "bg-surface-2 text-text-subtle",
};

function TierPill({ kind }: { kind: string }) {
  return (
    <span
      className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " + KIND_BG[kind]}
    >
      <Icon name={KIND_ICON[kind] || "cpu"} size={11} />
      {KIND_LABEL[kind] || kind}
    </span>
  );
}

function NumberedRow({ n, title, pill, children }: { n: number | string; title: React.ReactNode; pill?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-border-faint py-3.5 last:border-0">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-xs text-text-subtle">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-sm text-text">{title}</b>
          {pill && <TierPill kind={pill} />}
        </div>
        <div className="mt-0.5 text-sm text-text-muted">{children}</div>
      </div>
    </div>
  );
}

const LEDGER_ICONS: KpiCardData["icon"][] = ["type", "checkSeal", "grid", "book"];

export default function EnginePage() {
  const o = orchestration;
  const ledgerCards: KpiCardData[] = o.effort.ledger.map((c, i) => ({
    num: c.num,
    lab: c.lab,
    sub: c.sub,
    icon: LEDGER_ICONS[i],
    verified: i === 1,
  }));

  return (
    <>
      <Header crumbs={[{ label: "Engine" }]} />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <div className="mx-auto max-w-(--content-max) px-4 sm:px-6">
          <div className="py-14 lg:py-16">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-link">How it works</span>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-text sm:text-5xl">
              The Engine
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">
              The orchestration behind the corpus — the layers, the roles, the agents and the models that
              turn a raw PDF into faithful, verified, structured data without losing anything.
            </p>
          </div>

          <SectionNav sections={SECTIONS} />

          <Section id="overview" eyebrow="How it works" title="Only pay a model where it must think" lead={o.intro}>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-sm text-text">
              <Icon name="eye" size={18} className="mt-0.5 shrink-0 text-text-subtle" />
              <div>
                <b>The one rule.</b> A model is used only for <i>eyes</i> (reading a scan) or{" "}
                <i>judgement</i> (finding an omission, classifying). Moving data around is plain Python —
                free.
              </div>
            </div>
          </Section>

          <Section
            id="flow"
            eyebrow="Orchestration"
            title="One page, end to end"
            lead="Work moves left to right. Each step writes a file the next step reads, so any step re-runs on its own and the whole job resumes after an interruption."
          >
            <div
              tabIndex={0}
              role="region"
              aria-label="Pipeline flow diagram, scrollable horizontally"
              className="no-scrollbar overflow-x-auto rounded-2xl border border-border bg-surface p-6"
            >
              <div className="flex min-w-max items-center gap-1">
                {o.flow.map((step, i) => (
                  <div key={step.title} className="flex items-center gap-1">
                    {i > 0 && <span className="h-px w-6 shrink-0 bg-border-strong" />}
                    <div
                      className={
                        "flex w-32 shrink-0 flex-col items-center gap-1.5 rounded-xl px-3 py-4 text-center " +
                        KIND_BG[step.kind]
                      }
                    >
                      <Icon name={step.icon as IconName} size={20} />
                      <span className="text-xs font-semibold">{step.title}</span>
                      <span className="text-[10px]">{step.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-4 text-xs text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-500" /> Vision model (Opus)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-strong" /> Text model (Sonnet/Haiku)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-text-subtle" /> Python (free)
                </span>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-sm text-text">
              <Icon name="zap" size={18} className="mt-0.5 shrink-0 text-text-subtle" />
              <div>
                <b>Example — Kursbuch page 66 (a chat screen).</b> Python renders the image → Opus reads
                the picture and types the 12 chat bubbles in order → Opus reads it again as a sceptic and
                confirms nothing dropped → a cheap text model tags it{" "}
                <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[13px]">
                  dialogue · communication
                </code>{" "}
                and pulls out the items → Python writes the sheets.
              </div>
            </div>
          </Section>

          <Section
            id="usecases"
            eyebrow="Examples"
            title="The same pipeline, page by page"
            lead="Same flow every time — what changes is which steps a page actually needs. The first three are real pages from this corpus; the fourth is the recommended path for a source not yet encountered here."
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {o.usecases.map((u) => (
                <div key={u.title} className="rounded-2xl border border-border bg-surface p-5">
                  <h3 className="font-display text-lg text-text">{u.title}</h3>
                  <p className="mt-1.5 text-sm text-text-subtle">{u.input}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    {u.steps.map((s, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-text-subtle">→</span>}
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs text-text-muted">
                          <Icon name={s.icon as IconName} size={12} />
                          {s.label}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg bg-surface-inset px-3 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-subtle">
                      Result
                    </span>
                    <div className="mt-1 font-mono text-xs leading-relaxed text-text-muted">{u.output}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="roles"
            eyebrow="Who does what"
            title="The roles"
            lead='Think of it as a small team — a few expensive "thinkers" and a lot of cheap, reliable "machines."'
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {o.roles.map((r) => (
                <div key={r.name} className="rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-base text-text">{r.name}</h3>
                    <TierPill kind={r.kind} />
                  </div>
                  <p className="mt-2 text-sm text-text-muted">{r.does}</p>
                  <div className="mt-3 font-mono text-xs text-text-subtle">{r.model}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="models"
            eyebrow="Who does what"
            title="Which model, and why"
            lead="Three tiers. The engine runs end-to-end on one model (Opus 4.8); the cheaper text model is purely a cost saver on the easy work."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {o.tiers.map((t) => (
                <div key={t.key} className="rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center gap-2">
                    <span className={"flex h-8 w-8 items-center justify-center rounded-lg " + KIND_BG[t.key]}>
                      <Icon name={t.icon as IconName} size={16} />
                    </span>
                    <h3 className="font-display text-base text-text">{t.title}</h3>
                  </div>
                  <div className="mt-3 font-mono text-sm text-text">{t.model}</div>
                  <p className="mt-2 text-sm text-text-muted">{t.why}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.jobs.map((j) => (
                      <Chip key={j}>{j}</Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="layers"
            eyebrow="Detail"
            title="Thirteen layers, one job each"
            lead="Every layer takes a defined input, does exactly one job, and writes an artifact the next layer reads. Any layer can be re-run alone."
          >
            <div className="rounded-2xl border border-border bg-surface px-5">
              {o.layers.map((l) => (
                <NumberedRow key={l.n} n={l.n} title={l.name} pill={l.kind}>
                  <span className="font-mono text-xs text-text-subtle">{l.tool}</span>
                  <span className="ml-2">→ {l.out}</span>
                </NumberedRow>
              ))}
            </div>
          </Section>

          <Section
            id="cost"
            eyebrow="Cost"
            title="Where the usage goes"
            lead="On subscription accounts you don't pay per token — you spend a usage window. So &ldquo;expensive&rdquo; means how fast a run eats the window. Reading scans dominates; a chunk is avoidable."
          >
            <div className="rounded-2xl border border-border bg-surface p-6">
              <CostDonut data={o.cost} />
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
              <BarChart data={o.cost} gradient="cost" valuesArePercent />
              <div className="mt-3 flex flex-col gap-1 text-xs text-text-subtle">
                {o.cost.map((c) => (
                  <div key={c.k}>
                    <b className="text-text-muted">{c.k}:</b> {c.note}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 text-sm font-semibold uppercase tracking-wide text-text-subtle">
              Making it leaner + more robust
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {o.savers.map(([title, detail], i) => (
                <div key={title} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 font-mono text-xs font-semibold text-link">
                    {i + 1}
                  </span>
                  <div>
                    <b className="text-sm text-text">{title}</b>
                    <p className="mt-1 text-sm text-text-muted">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-flag/20 bg-flag-soft px-4 py-3.5 text-sm text-text">
              <Icon name="zap" size={18} className="mt-0.5 shrink-0 text-flag-strong" />
              <div>
                <b>Biggest single win:</b> detect a text layer first. Digital-born PDFs already contain
                their text — pull it out with Python for free and skip vision entirely. Vision is only
                needed for genuine scans.
              </div>
            </div>
          </Section>

          <Section id="effort" eyebrow="Behind the numbers" title="What it actually took" lead={o.effort.summary}>
            <KpiGrid cards={ledgerCards} />
            <div className="mt-6 text-sm font-semibold uppercase tracking-wide text-text-subtle">Timeline</div>
            <div className="mt-3 rounded-2xl border border-border bg-surface px-5">
              {o.effort.timeline.map((t, i) => (
                <NumberedRow key={t.phase} n={i + 1} title={t.phase} pill="vision">
                  {t.detail}
                </NumberedRow>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {o.effort.resilience.map((r) => (
                <Chip key={r} ok>
                  {r}
                </Chip>
              ))}
            </div>
          </Section>

          <Section
            id="prompts"
            eyebrow="Pipeline"
            title="The exact prompts"
            lead={
              <>
                The instructions driving the Transcribe, QA, and Repair stages. Placeholders such as{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">{"${img(pg)}"}</code>{" "}
                are substituted per page at run time.
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <CodeBlock label="Transcribe prompt" code={workflow.prompts.transcribe} />
              <CodeBlock label="Adversarial QA prompt" code={workflow.prompts.qa} />
              <CodeBlock label="Repair prompt" code={workflow.prompts.repair} />
            </div>
          </Section>
        </div>
      </main>
      <Footer brand="Lingotran Engine · Orchestration" />
    </>
  );
}
