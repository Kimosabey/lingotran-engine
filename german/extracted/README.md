# German · extracted (corpus output)

**Shipped**: 636 pages across 4 PDF-sourced books, 100% QA-verified, zero
data loss. See [`DELIVERY-NOTES.md`](DELIVERY-NOTES.md) for the full
breakdown and [`_exports/`](_exports/) for the actual deliverables. This
whole directory is frozen — see the root [`../README.md`](../README.md)
and [`../../_engine/PLAYBOOK.md`](../../_engine/PLAYBOOK.md) for why.

```
extracted/
  _tools/                 the original PDF pipeline this corpus shipped on
                           (frozen; superseded by ../../_engine/ for new work)
  _exports/                the shipped deliverable tree
  manifest.tsv             AUTHORITATIVE per-page state for the PDF channel
  <collection>/
    pages/  page-NNN.md    faithful content + YAML frontmatter
    pages/_qa/*.json       completeness / QA verdict sidecar
  deutsch-pruefung/        a SEPARATE web-scraped corpus (113 pages), own
                           schema, not part of the PDF channel above
```

Frontmatter for the PDF-sourced collections follows German's own
`_tools/collections.json` schema (`level`, `section`, `content_type`,
`status`, `qa`, etc. — same shape [`_engine/`](../../_engine/README.md)
generalized for every language). `deutsch-pruefung/`'s web-scraped pages
instead follow [`../web/schemas/frontmatter.schema.ts`](../web/schemas/frontmatter.schema.ts)
(`source_url`, `site`, `slug`, `exam`, `level`, `section`, `content_type`,
`status`, `qa`) and aren't registered in `_tools/collections.json` — a
deliberately separate, out-of-band channel, not a gap.

See [`../../french/extracted/README.md`](../../french/extracted/README.md)
and [`../../_engine/README.md`](../../_engine/README.md) for the pipeline
every new language now uses.
