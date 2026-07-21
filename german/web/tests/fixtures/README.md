# Test fixtures

Local HTML snapshots used by integration tests — **never** live network calls
in CI.

Conventions (phase 2):

- `*.static.html` — server-rendered snapshots (static-loader path).
- `*.dynamic.html` — post-render DOM snapshots (dynamic-loader path).
- `*.expected.json` — the golden `PageDocument` for the matching fixture.

Capture fixtures from robots-allowed public pages only. Do not commit
authenticated or paywalled content.
