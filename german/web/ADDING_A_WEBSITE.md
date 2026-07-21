# Adding a new German website

Onboarding a site means writing **one adapter**. The shared pipeline,
parsers, extractors, transformers and validators never change.

## 0. Confirm authorization

Before anything: confirm we are authorized to crawl the site, read its
`robots.txt`, and note any `Crawl-delay`. Public, robots-allowed pages only —
unless there is explicit written authorization for more.

## 1. Recon (read-only)

- Fetch `robots.txt` → the allow/deny map and sitemap URL.
- Fetch `sitemap.xml` → the URL frontier.
- Open a representative page and note:
  - Is it server-rendered HTML (`static`) or client-rendered/Next.js (`dynamic`)?
  - The primary content container selector.
  - Any accordions / tabs / "show more" that hide content.
  - Any cookie/consent dialog to dismiss.

## 2. Create the adapter

```bash
cp adapters/_template.adapter.ts adapters/<site-id>.adapter.ts
```

Fill in:

| Member | From recon |
| --- | --- |
| `id` / `hostnames` | site id + domains |
| `capabilities.renderMode` | `static` or `dynamic` (or `auto`) |
| `sitemapUrl()` / `seedUrls()` | discovery |
| `shouldCrawl(url)` | skip noise paths (still within robots) |
| `renderHints(url)` | consent-dismiss + content-ready selectors |
| `expansionTargets(url)` | accordion/tab/"show more" selectors |
| `selectorsFor(url)` | content root + extra ignore selectors |
| `classify(url, hints)` | exam / level / section / content_type |
| `authSpec()` | *only* if authorized authenticated crawl |

Keep it **declarative** — return selectors/hints, never a scraping loop.

## 3. Register + enable

```ts
// composition root
registry.register(new YourSiteAdapter());
```

```ts
// config/websites.config.ts
sites: [{ adapterId: '<site-id>', enabled: true }]
```

## 4. Test

- Save a small HTML snapshot into `tests/fixtures/` (robots-allowed page only).
- Add a golden `*.expected.json` and an integration test.
- `npm test`.

## 5. Run

Run the pipeline against the site's frontier; artifacts land in
`german/extracted/`. Re-runs are incremental (only changed/unfinished pages).

## Best practices

- **One adapter = one site.** Never branch on hostname inside the core.
- **No hardcoded selectors in core.** Selectors live in adapters only.
- **Respect robots + rate limits.** Narrow with `shouldCrawl`; never widen.
- **Prefer `static`.** Use `dynamic` only when the content truly needs JS.
- **Secrets via `CredentialProvider`.** Never commit credentials.
- **Fail loud on incompleteness.** Let the completeness validator flag partial
  extractions rather than emitting silently-wrong content (zero-data-loss).
