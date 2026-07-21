# German · extracted (corpus output)

Destination for all extracted German content, regardless of source channel
(`web/`, future `pdf/`, `ocr/`, …). Mirrors the French corpus layout so the
dashboard and study tools treat every language identically.

```
extracted/
  manifest.tsv            AUTHORITATIVE per-page state (resume anchor)
  <collection>/
    pages/  <slug>.md       faithful content + YAML frontmatter
    pages/_qa/<slug>.json   completeness / QA verdict sidecar
```

Empty until phase-2 extraction runs. Frontmatter for web-sourced pages follows
[`../web/schemas/frontmatter.schema.ts`](../web/schemas/frontmatter.schema.ts)
(`source_url`, `site`, `slug`, `exam`, `level`, `section`, `content_type`,
`status`, `qa`) — the web variant of the French page frontmatter.

See [`../../french/extracted/README.md`](../../french/extracted/README.md) for
the reference conventions.
