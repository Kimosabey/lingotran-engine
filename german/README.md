# German (DE)

The German language module of the Lingotran Engine. German is the next
language after the French reference implementation, organised so that each
**source-acquisition channel** is independent and the corpus output stays
uniform with French.

## Layout

```
german/
├── web/         ← web source acquisition (this phase; foundation ready)
├── extracted/   ← corpus output (French-compatible: pages/*.md + _qa + manifest.tsv)
├── shared/      ← code shared across German source channels
└── README.md
```

Future source channels (PDF, OCR, audio/video, API, CMS) are added as sibling
folders next to `web/`, each producing the same `extracted/` artifacts. They
are intentionally **not** created yet — this phase is web only.

## Status

| Channel | Status |
| --- | --- |
| `web/` | Architecture + foundation complete; extraction implemented in phase 2. |
| others | Planned. |

## Conventions (inherited from French)

- Corpus artifacts: Markdown + YAML frontmatter, JSON QA sidecars,
  `manifest.tsv` as the authoritative per-page resume anchor.
- Kebab-case slugs; zero-data-loss + adversarial-QA philosophy.
- See [`../french/extracted/README.md`](../french/extracted/README.md) for the
  reference pipeline and [`web/README.md`](./web/README.md) for the web module.
