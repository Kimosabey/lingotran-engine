# Skills map — German Web Extraction

Which Claude Code skills drive each phase of this module.

## Foundation (this phase — architecture only)
- **kimo-antigravity-architect** — clean-architecture layering, failure-first
  design, the local-logic + cloud-reasoning split (Docker-local pipeline,
  optional cloud enrichment).
- **kimo-portfolio-docs** — the README / doc scaffold and doc standard.

## Implementation (phase 2 — concrete stages + first adapter)
- **webapp-testing** — drives Playwright to render live pages and read real
  selectors for the dynamic loader + the first adapter.
- **claude-api** *(built-in)* — the optional cloud-LLM enrichment/QA stage
  (model ids, structured outputs, caching, token budgeting).
- **kimo-frontier-ai** *(optional)* — if enrichment becomes a typed
  structured-output / agent step.

## Quality gates (before "production-ready")
- **test-master** — unit + integration suites, fixtures, coverage gates.
- **security-reviewer** — SSRF, URL-injection, secret handling, browser
  sandboxing, credential redaction.
- **code-reviewer-jeffallan** — broad correctness / perf / maintainability.
- **kimo-benchmark** — any throughput claim (pages/min, p95 render) measured,
  not asserted.

## Portfolio / hygiene (later)
- **kimo-blueprint-sync** — flip German `planned → active` in the dashboard
  data once real content lands.
- **kimo-repo-hygiene**, **kimo-visual-assets**, **kimo-interview-prep** —
  naming, architecture imagery, interview material.

*Out of scope here:* frontend/dashboard skills (`ui-ux-pro-max`,
`frontend-design`, `kimo-stealth-ui`) and `nestjs-expert` — this module is
extraction only, no UI and no API service.
