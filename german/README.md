# German (DE)

The German language module of the Lingotran Engine. **Shipped**: the
PDF-vision channel delivered a full A1 corpus — 636 pages, 2,830 questions,
3,751 vocabulary words, 100% QA-verified, zero data loss. Deliverables live
in [`extracted/_exports/`](extracted/_exports/); see
[`extracted/DELIVERY-NOTES.md`](extracted/DELIVERY-NOTES.md) for the full
per-book breakdown and Drive share links.

## Two source-acquisition channels

| Channel | Status | Produces |
| --- | --- | --- |
| PDF-vision extraction (via `_engine/` from repo root; German's own `extracted/_tools/` is the frozen original this pattern was proven on) | **Shipped.** 4 books — Goethe A1 exam set (302 pp, frozen), Netzwerk neu A1 Kursbuch (174 pp), Netzwerk neu A1 Test Booklet (56 pp), Goyal German for Young Learners (104 pp). | `extracted/<collection>/pages/*.md` + `_qa/*.json`, exported to `extracted/_exports/`. |
| `web/` — adapter-driven extractor for authorized websites | **Built and used once.** Produced `extracted/deutsch-pruefung/` (113 pages, a web-scraped German-exam-prep blog corpus), fully transcribed and QA-verified, but on a separate schema (`source_url`/`site`/`exam` frontmatter, no `manifest.tsv`) and not registered in `_tools/collections.json` — a deliberately separate, out-of-band channel from the PDF corpus above, not a subset of it. | `extracted/deutsch-pruefung/pages/*.md` + `_qa/*.json`. |

## Layout

```
german/
├── web/         ← the adapter-driven web-scrape extractor (see web/README.md)
├── extracted/   ← corpus output for BOTH channels above
│   ├── _tools/  ← the original, frozen, German-specific PDF pipeline
│   ├── _exports/← the shipped deliverable tree (PDF channel)
│   └── deutsch-pruefung/ ← the web-scrape channel's output
└── README.md
```

## 🔒 Frozen — do not modify

Everything under `german/` is already delivered and must stay byte-for-byte
untouched (see `_engine/PLAYBOOK.md`'s safety gate: `git status --porcelain
-- german/` must be empty after any `_engine/` operation). New PDF
extraction work for other languages happens in the shared `_engine/` at the
repo root — German's own `extracted/_tools/` is never re-invoked, only kept
as the reference the shared engine was generalized from.

## Conventions (inherited from French)

- Corpus artifacts: Markdown + YAML frontmatter, JSON QA sidecars,
  `manifest.tsv` as the authoritative per-page resume anchor (PDF channel;
  the web-scrape channel uses its own per-page `_qa/*.json` sidecars
  without a combined manifest).
- Kebab-case slugs; zero-data-loss + adversarial-QA philosophy.
- See [`../french/extracted/README.md`](../french/extracted/README.md) and
  [`../_engine/README.md`](../_engine/README.md) for the current shared
  pipeline, and [`web/README.md`](./web/README.md) for the web module.
