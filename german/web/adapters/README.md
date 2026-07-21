# Adapters

An **adapter** is the *only* thing you write to onboard a new German website.
Everything downstream — loading, parsing, extraction, transformation,
validation, emit — is shared and site-agnostic.

## Contract

Every adapter implements [`SiteAdapter`](./adapter.interface.ts). Extend
[`BaseAdapter`](./base.adapter.ts) so you only override what differs.

| Member | Purpose |
| --- | --- |
| `id` | Stable kebab-case id (also the corpus + credential key). |
| `hostnames` | Domains this adapter owns; drives `matches()`. |
| `capabilities` | `renderMode` (static/dynamic/auto), auth, sitemap, incremental. |
| `sitemapUrl()` / `seedUrls()` | URL discovery. |
| `shouldCrawl(url)` | Site-level allow/deny on top of robots.txt. |
| `renderHints(url)` | Consent dismissal, content-ready selector, waits. |
| `expansionTargets(url)` | Accordions / tabs / "show more" to expand. |
| `selectorsFor(url)` | Primary content root + extra ignore selectors. |
| `classify(url, hints)` | Infer exam / level / section / content_type. |
| `slugFor(url)` | Corpus slug (base provides a sane default). |
| `authSpec()` | *Optional* declarative login recipe (opt-in). |

## Design rules

- **Declarative only.** Return selectors and hints — never scraping loops.
- **No secrets.** Credentials resolve at runtime via `CredentialProvider`
  (env / secret manager), never live in an adapter.
- **Open/Closed.** Adding an adapter must not require editing the pipeline,
  parsers, extractors, transformers or validators.
- **Honour robots.txt.** `shouldCrawl` narrows further; it never widens past
  what robots.txt allows. Authenticated / robots-disallowed areas require
  explicit written authorization.

## Add one

1. Copy [`_template.adapter.ts`](./_template.adapter.ts) → `<site-id>.adapter.ts`.
2. Fill in id / hostnames / capabilities and the selectors from the live DOM.
3. `export` it from [`index.ts`](./index.ts).
4. `registry.register(new YourAdapter())` in the composition root.
5. Enable it in [`../config/websites.config.ts`](../config/websites.config.ts).

See [`../ADDING_A_WEBSITE.md`](../ADDING_A_WEBSITE.md) for the full walkthrough.

> The foundation ships `BaseAdapter`, `GenericAdapter` (fallback) and
> `TemplateAdapter` only — no real site adapter and no real selectors yet.
