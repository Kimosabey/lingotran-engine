import type { Metadata } from "next";
import { Fragment } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";
import { SectionNav } from "@/components/section-nav";
import { CodeBlock } from "@/components/code-block";
import { DataTable } from "@/components/data-table";
import { tools, conventions } from "@/lib/data";

const TITLE = "Reference — Lingotran Engine";
const DESCRIPTION =
  "Developer tools, folder layout, naming, frontmatter fields, and the status model behind the Lingotran extraction pipeline.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/reference",
    type: "website",
    images: [{ url: "/img/logo-color.png", width: 1819, height: 571, alt: "Lingotran" }],
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION, images: ["/img/logo-color.png"] },
};

const SECTIONS = [
  { id: "tools", label: "Developer tools" },
  { id: "layout", label: "Folder layout" },
  { id: "naming", label: "Naming" },
  { id: "frontmatter", label: "Page frontmatter" },
  { id: "status", label: "Status model" },
];

const STATUS_BADGE: Record<string, string> = {
  ok: "bg-verified-soft text-verified-strong",
  warn: "bg-flag-soft text-flag-strong",
  idle: "bg-surface-2 text-text-subtle",
};
const STATUS_LABEL: Record<string, string> = { ok: "verified", warn: "attention", idle: "idle" };

export default function ReferencePage() {
  return (
    <>
      <Header crumbs={[{ label: "Reference" }]} />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 scroll-mt-(--sticky-stack) focus:outline-none"
      >
        <div className="mx-auto max-w-(--content-max) px-4 sm:px-6">
          <div className="py-14 lg:py-16">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-link">Reference</span>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-text sm:text-5xl">
              Conventions &amp; tools
            </h1>
            <p className="mt-4 max-w-(--prose-max) text-base leading-relaxed text-text-muted">
              How the corpus is laid out on disk, how pages are named, the state each page moves through,
              and the scripts that orchestrate it all.
            </p>
          </div>

          <SectionNav sections={SECTIONS} />

          <Section
            id="tools"
            eyebrow="Scripts"
            title="Developer tools"
            lead={
              <>
                The scripts that orchestrate the pipeline and track state, all under{" "}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">
                  french/extracted/_tools/
                </code>
                .
              </>
            }
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {tools.map((t) => (
                <div key={t.file} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
                  <div>
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm text-text">{t.file}</code>
                    <div className="mt-1 text-xs text-text-subtle">{t.lang}</div>
                  </div>
                  <p className="text-sm text-text-muted">{t.purpose}</p>
                  {t.commands && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                      {t.commands.map(([cmd, desc]) => (
                        <Fragment key={cmd}>
                          <dt className="font-mono text-xs text-link">{cmd}</dt>
                          <dd className="text-text-muted">{desc}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  )}
                  <CodeBlock label="usage" code={t.usage} />
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="layout"
            eyebrow="Conventions"
            title="Folder layout"
            lead="Every book keeps the same shape — images, transcriptions, QA verdicts, and a level-sorted view, all anchored by one authoritative manifest."
          >
            <CodeBlock label="french/extracted/" code={conventions.tree} />
          </Section>

          <Section id="naming" eyebrow="Conventions" title="Naming">
            <div className="max-w-(--prose-max) rounded-2xl border border-border bg-surface p-6 text-sm leading-relaxed text-text-muted">
              {conventions.naming}
            </div>
          </Section>

          <Section
            id="frontmatter"
            eyebrow="Conventions"
            title="Page frontmatter"
            lead="Every transcribed page opens with this YAML block before the verbatim body."
          >
            <DataTable
              columns={["Field", "Meaning"]}
              rows={conventions.frontmatter.map(([field, meaning]) => [
                <code key={field} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">
                  {field}
                </code>,
                meaning,
              ])}
            />
          </Section>

          <Section
            id="status"
            eyebrow="Conventions"
            title="Status model"
            lead="The four states a page moves through, left to right, never backward except via Repair."
          >
            <DataTable
              columns={["Status", "State", "Meaning"]}
              rows={conventions.status.map(([status, state, meaning]) => [
                <code key={status} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text">
                  {status}
                </code>,
                <span
                  key={status + "-s"}
                  className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " + STATUS_BADGE[state]}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {STATUS_LABEL[state] || state}
                </span>,
                meaning,
              ])}
            />
          </Section>
        </div>
      </main>
      <Footer brand="Lingotran Engine · Reference" />
    </>
  );
}
