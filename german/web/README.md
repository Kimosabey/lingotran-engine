# German · Web Extraction Module

Adapter-driven, framework-agnostic **web source acquisition** for the German
corpus. It renders (static *or* dynamic) pages from authorized German websites
and emits structured content into `german/extracted/` in the same shape the
French PDF pipeline produces — so every language stays uniform downstream.

> **Scope of this phase: architecture + foundation only.** Interfaces,
> abstractions, schemas, config and placeholders are in place; **no
> site-specific extraction logic, no selectors, no scraping rules** are
> implemented yet. Phase 2 fills in the concrete stages and the first adapter.

---

## Folder purpose

| Folder | Responsibility |
| --- | --- |
| [`models/`](./models) | Pure domain types + enums (no external deps). The compile-time source of truth. |
| [`schemas/`](./schemas) | Zod runtime schemas mirroring the models. The **output schema** (`pageDocumentSchema`) + config + frontmatter validation. |
| [`config/`](./config) | Engine-wide defaults (rate limit, retry, user agent, extraction rules, output) + website enablement. **No selectors.** |
| [`adapters/`](./adapters) | The **only** extension point. One adapter per website — declarative selectors, render mode, classification. |
| [`parsers/`](./parsers) | Page loading (`static` fetch / `dynamic` Playwright render) + an HTML→DOM facade that decouples extractors from any DOM library. |
| [`extractors/`](./extractors) | Content detection, per-node extraction (one small extractor per block type), metadata extraction. |
| [`transformers/`](./transformers) | Cleaning (Unicode NFC, whitespace, de-dupe), document assembly, and Markdown/JSON serialization. |
| [`validators/`](./validators) | Schema validation (implemented) + completeness/QA report (placeholder). |
| [`pipelines/`](./pipelines) | The reusable orchestrator + DI service bundle + stage contract. Site-agnostic. |
| [`utils/`](./utils) | Cross-cutting ports: logger, retry, rate limiter, robots policy, asset manager, state store, credential provider. |
| [`tests/`](./tests) | Hermetic unit tests + fixture-based integration tests. |

## Module responsibilities (layering)

Clean architecture, dependencies point **inward**:

```
adapters ─┐
parsers  ─┤
extractors┤─► depend on ► models  ◄─ schemas (runtime mirror)
transformers            (pure, zero deps)
validators┘
   ▲
pipelines ── orchestrate the above via injected PORTS (utils/*)
```

- `models/` depend on nothing.
- Every layer talks to the next through an **interface** (port), never a
  concrete class → Dependency Inversion, easy testing, swappable pieces.
- The pipeline knows only ports; the composition root wires concretions.

## Data flow

```
CrawlRequest(url)
   │
   ▼  adapters.resolve(url)                 ← picks the site adapter (or generic fallback)
[discover] sitemap/seed URLs, robots + shouldCrawl filter
[load]     static fetch OR dynamic render   ← adapter.capabilities.renderMode (static|dynamic|auto)
           dynamic: dismiss consent, expand accordions/tabs, wait for content
[parse]    HTML → ParsedDocument (DOM facade)
[detect]   locate primary content root      ← Readability + adapter.selectorsFor()
[extract]  walk DOM → ordered ContentNode[] ← per-node extractors; strip ignored chrome
[transform] NFC-normalise, preserve whitespace, de-dupe
[metadata] title/description/lang + adapter.classify() → PageMetadata
[assets]   collect images/media/links/downloads
[validate] completeness report + schema check
[enrich]   (optional, future) cloud-LLM cleanup / QA
[emit]     PageDocument → JSON + Markdown(+frontmatter)
[persist]  update manifest.tsv / _qa sidecar (incremental resume)
   │
   ▼
german/extracted/**  (French-compatible corpus artifacts)
```

## Static vs dynamic sites

Loading is a **pluggable strategy**, chosen per adapter:

- `static` — plain HTTP fetch of server-rendered HTML. Fast, no browser.
- `dynamic` — full Playwright render for client-rendered apps (Next.js / SPA,
  e.g. deutsch-pruefung.de). Handles consent dialogs, accordion/tab expansion.
- `auto` — try static, escalate to dynamic if the static HTML has no content.

## Corpus output (French-compatible)

The Markdown serializer writes `german/extracted/<...>/pages/<slug>.md` with
YAML frontmatter aligned to the French convention — swapping page-scan fields
(`page`, `orientation`) for web fields (`source_url`, `site`, `slug`, `exam`),
keeping `content_type`, `level`, `section`, `status`, `qa`. The completeness
report is the web analogue of the French `_qa/*.json` verdict, and
`manifest.tsv` remains the authoritative resume anchor.

## Authorization & politeness (mandatory)

- Only crawl sites we are **authorized** to crawl.
- `robots.txt` is honoured by default (`RobotsPolicy`); disabling it needs
  explicit written authorization and is never a silent default.
- Per-host rate limiting + concurrency caps keep us within any agreed budget.
- **Authenticated / login-gated / robots-disallowed areas require explicit
  written authorization.** Credentials (if authorized) come from env/secret
  manager via `CredentialProvider` — never hardcoded, committed, or written to
  the corpus.

## Quickstart (phase 2)

```bash
cd german/web
npm install            # first dependency tree in the repo (Playwright, zod, …)
cp .env.example .env   # adjust politeness / output / logging
npm test               # foundation unit tests are green today
# npx playwright install chromium   # when the dynamic loader lands
```

## Related docs

- [ADDING_A_WEBSITE.md](./ADDING_A_WEBSITE.md) — onboard a new German site.
- [SKILLS.md](./SKILLS.md) — Claude Code skills used per phase.
- [adapters/README.md](./adapters/README.md) — the adapter contract.
- [tests/README.md](./tests/README.md) — test strategy.
