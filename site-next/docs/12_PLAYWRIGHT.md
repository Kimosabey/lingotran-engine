# 12 — Playwright E2E Testing Strategy

> End-to-end testing strategy for `site-next/` using Playwright (via the `webapp-testing` skill for interactive/manual verification, and a `tests/e2e/` Playwright suite for repeatable automated coverage). No Playwright suite exists yet in this repo — this document specifies how to set one up and grow it as the site matures.

---

## 1. Scope & Priorities

Test **critical user journeys** first (per [05_UX_REVIEW.md](05_UX_REVIEW.md) §1), not exhaustive per-component coverage:

1. Home → understand the site (`/`) loads, renders key content, no console errors.
2. Engine explainer (`/engine`) loads and renders.
3. Corpus browsing: `/french` → `/french/[slug]` and `/german` navigation works, data renders correctly.
4. Reference page (`/reference`) loads.
5. Cross-cutting: theme toggle, global search, mobile nav — these appear on every page and are the highest-leverage things to break.

---

## 2. Test Organization

```
tests/
  e2e/
    navigation.spec.ts       # Route reachability, nav links, 404 handling
    theme.spec.ts            # Theme toggle: persists, no flash, both themes render
    search.spec.ts           # Global search: open, query, results, keyboard nav
    french-corpus.spec.ts    # /french index → /french/[slug] detail flow
    german-corpus.spec.ts    # /german flow
    accessibility.spec.ts    # axe-core scan on each primary route
    responsive.spec.ts       # Key breakpoints on primary routes
  fixtures/
    corpus-data.ts           # Shared test data/expectations if needed
playwright.config.ts
```

- One spec file per journey/concern, not per component — a component-level test belongs in the "smoke test during implementation" workflow (`webapp-testing` skill), not a permanent Playwright spec, unless that component sits on a critical path.
- Name tests by **user-observable behavior**, not implementation: `"clicking a corpus card navigates to its detail page"`, not `"CorpusCard onClick handler fires"`.

---

## 3. Naming Conventions

- Spec files: `kebab-case.spec.ts`.
- `test.describe("Journey or Feature Name", () => { ... })` groups related tests.
- Individual `test("does X when Y", async ({ page }) => { ... })` — full sentence, present tense, states the expected behavior.

---

## 4. Functional Tests

For every critical journey (§1):
- [ ] Page loads with a 200 (no error boundary triggered, no Next.js error page).
- [ ] Key content is present (`expect(page.getByRole(...)).toBeVisible()` for the headline, nav, primary data).
- [ ] Primary interactive elements respond correctly (clicking a corpus card navigates; the theme toggle actually toggles `data-theme`).
- [ ] Data-driven content renders correctly for at least one real corpus/book (not just an empty-state check).

---

## 5. Responsive Tests

Run key journeys at the required viewports from [08_RESPONSIVE.md](08_RESPONSIVE.md) §2 — at minimum 375px, 768px, 1440px in CI (full 320px–2560px sweep is a manual/on-demand check, not every-CI-run):

```ts
for (const viewport of [{width: 375, height: 812}, {width: 768, height: 1024}, {width: 1440, height: 900}]) {
  test(`renders correctly at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/french/some-known-slug");
    // assert no horizontal overflow, nav handoff correct, etc.
  });
}
```

Assert specifically: no horizontal scroll (`document.documentElement.scrollWidth <= window.innerWidth`), correct nav variant shown (full vs. mobile), no visible overlap via screenshot diff (§8).

---

## 6. Cross-Browser Tests

Configure Playwright's built-in projects for Chromium, Firefox, and WebKit at minimum (`playwright.config.ts` `projects` array) — this catches engine-specific CSS/JS quirks (Safari/WebKit is the highest-value addition here since it diverges most from Chromium, and a meaningful share of real users are on Safari/iOS). Run the full critical-journey suite (§1) across all three; visual-regression screenshots (§8) may reasonably stay Chromium-only to avoid triple-maintaining baseline images.

---

## 7. Accessibility Checks (Automated, In-CI)

- Integrate `@axe-core/playwright` (or equivalent) into each critical-journey spec, asserting zero critical/serious violations on each primary route.
- This is a **complement to**, not a replacement for, the `accesslint-scan`/`accesslint-diff` skills and manual keyboard/screen-reader passes in [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md) §17 — automated scans catch roughly half of real accessibility issues; both layers are required.
- Fail the build on any new critical/serious violation; track existing known issues explicitly rather than suppressing the whole check.

---

## 8. Visual Regression

- Playwright's built-in `expect(page).toHaveScreenshot()` for the primary routes at the primary viewport (1440px desktop, 375px mobile), in both light and dark theme — 4 baseline screenshots per critical route minimum.
- Keep visual regression scoped to genuinely stable, high-traffic screens — an over-broad visual regression suite becomes noisy (fails on every legitimate content update) and gets ignored/disabled, which is worse than not having it.
- Update baselines deliberately as part of the same PR that intentionally changes the visuals — never as a reflexive "just re-snapshot it" without checking the diff actually reflects an intended change.

---

## 9. Console Error Detection

Every spec's page fixture should assert **zero unexpected console errors** during the test run:

```ts
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));
  // after test actions, assert errors.length === 0 (allow-list only genuinely expected/benign ones)
});
```

Specifically watch for React hydration warnings — these should be treated as failures, not noise, per [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §3 hydration rules and [10_VISUAL_QA.md](10_VISUAL_QA.md) §2.7.

---

## 10. Network Failure Handling

- For any journey with client-side data fetching (search, filters), simulate a slow/failed network (`page.route()` to abort or delay a request) and assert the UI shows a designed loading/error state rather than hanging indefinitely or crashing — ties to [09_COMPONENT_STANDARDS.md](09_COMPONENT_STANDARDS.md) §9.
- Assert offline/failed-request states don't leave the user with a silently broken page (blank area with no explanation).

---

## 11. Authentication Flows

**Not applicable today** — this site has no authentication (see [01_PROJECT_CONTEXT.md](01_PROJECT_CONTEXT.md) §5). If auth is ever added, this section must be filled in with login/logout/session-expiry/protected-route specs before shipping that feature — don't ship an auth feature without E2E coverage of its failure modes (expired session, wrong credentials, protected-route redirect).

---

## 12. Navigation & Forms

- Every nav link resolves to a real route (no dead links) — a single spec can crawl `header.tsx`/`footer.tsx`/`mobile-nav.tsx`'s link set and assert each responds with 200.
- Any form (search input, future contact/filter forms) gets: empty-submit behavior, valid-input behavior, and error-state behavior each as a distinct test case.

---

## 13. CI Integration

- Run the full Playwright suite on every PR against `main` and the active version branch (per project memory: keep the latest version branch fast-forwarded — see [00_MASTER_FRONTEND.md](00_MASTER_FRONTEND.md) §12 on not touching CI config without confirmation; this section describes the target state to propose, not to silently wire up).
- Fail the build on any failing test — no "known flaky, ignore" tests left in a permanently-red state; quarantine and fix or delete, don't accumulate ignored failures.
- Cross-browser (§6) and full-viewport-sweep runs can be scheduled (nightly) rather than on every PR if CI time becomes a constraint — critical-path Chromium tests stay on every PR regardless.

---

## 14. Maintenance Guidelines

- A flaky test is a bug in the test (or a real intermittent bug in the app) — never silence it with a retry loop as a permanent fix; retries are acceptable as a temporary mitigation while root-causing.
- When a component's structure changes, update the corresponding spec's selectors in the same PR — don't let specs silently rot to "passes but doesn't test what it used to."
- Prefer `getByRole`/`getByLabelText`/`getByText` selectors (accessibility-tree-based) over CSS selectors/test-ids where possible — this doubles as a passive accessibility check (if `getByRole` can't find your button, a screen reader user probably can't either) and per [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md) §1's semantic-HTML-first principle.
- Delete tests for removed features immediately — a passing test for dead code is worse than no test.

---

## 15. Playwright Checklist (Before Considering E2E Coverage Adequate)

- [ ] Every critical journey in §1 has at least one functional spec.
- [ ] Responsive checks at 375/768/1440px for primary routes.
- [ ] Cross-browser run configured for Chromium + WebKit at minimum.
- [ ] Automated a11y scan (`axe-core`) integrated per route, zero critical/serious violations.
- [ ] Visual regression baselines for primary routes × both themes.
- [ ] Console/hydration errors assert to zero across all specs.
- [ ] Network-failure states covered for any client-fetching journey.
- [ ] CI runs the suite on every PR; no permanently-ignored flaky tests.

---

**Next:** [14_SCORECARD.md](14_SCORECARD.md) to roll all of `04`–`12`'s findings into one weighted quality score.
