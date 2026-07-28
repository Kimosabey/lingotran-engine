# 15 — Final Pre-Release Checklist

> Run this checklist before **every** production release of `site-next/`. It aggregates the gates from `00`–`14` into one usable pass/fail list. Do not ship with an unchecked item unless it's explicitly waived by the user with a stated reason.

---

## 1. Functionality

- [ ] Every route loads without error: `/`, `/engine`, `/french`, `/french/[slug]` (for each real slug), `/german`, `/reference`.
- [ ] All data-driven content (KPIs, charts, tables) renders correct, real values — not placeholder/lorem content.
- [ ] Navigation (header, footer, mobile nav, section nav) — every link resolves correctly.
- [ ] Global search returns relevant results and handles the empty-results case.
- [ ] Theme toggle switches correctly and persists across reload (`localStorage['lt-theme']`).
- [ ] 404/error states for invalid routes (e.g. unknown `[slug]`) are handled gracefully, not a raw stack trace.

## 2. UI

- [ ] Full [04_UI_REVIEW.md](04_UI_REVIEW.md) element-by-element pass completed on any changed/new screen — zero P0/P1 findings outstanding.
- [ ] Visual consistency confirmed across all pages (§4 of `04`) — no drifted component look.
- [ ] Both light and dark theme checked on every changed screen.

## 3. UX

- [ ] Core journeys (§1 of [05_UX_REVIEW.md](05_UX_REVIEW.md)) walked end-to-end as a first-time user would.
- [ ] No heuristic violations from Nielsen's 10 (§3 of `05`) found on changed screens.
- [ ] Feedback systems present for every non-instant action (Doherty Threshold, §2 of `05`).

## 4. Accessibility

- [ ] `accesslint-scan` (or equivalent automated audit) run on every changed/new route — zero unresolved critical/serious findings.
- [ ] Manual keyboard-only pass completed on every changed/new interactive surface.
- [ ] Color contrast verified in both themes using `-strong` text tokens (§7 of [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md)).
- [ ] Reduced-motion (`prefers-reduced-motion: reduce`) verified by actually toggling the OS setting.
- [ ] Screen-reader spot-check done for any new complex component (search, charts, dialogs).

## 5. Responsiveness

- [ ] Checked at 320px, 375px, 768px, 1024px, 1440px, 1920px, 2560px per [08_RESPONSIVE.md](08_RESPONSIVE.md) §2.
- [ ] No horizontal overflow at any width.
- [ ] Touch targets meet minimum size on mobile/tablet.
- [ ] Tables scroll rather than break layout on narrow viewports.

## 6. Performance

- [ ] Lighthouse run against a **production build** (`pnpm build && pnpm start`), not dev server.
- [ ] Core Web Vitals within targets: LCP < 2.5s, INP < 200ms, CLS < 0.1 (§1 of [11_PERFORMANCE.md](11_PERFORMANCE.md)).
- [ ] No unnecessary `"use client"` introduced; heavy libraries (ECharts, cmdk) confirmed code-split where appropriate.
- [ ] Bundle size regression checked for any new dependency.

## 7. Browser Compatibility

- [ ] Verified in Chromium-based browser (Chrome/Edge).
- [ ] Verified in Firefox.
- [ ] Verified in WebKit (Safari) — highest-value divergence check; do not skip.
- [ ] Verified on at least one real mobile browser (iOS Safari or Android Chrome) if the change touches touch interaction or mobile layout meaningfully.

## 8. Testing

- [ ] Relevant Playwright specs (per [12_PLAYWRIGHT.md](12_PLAYWRIGHT.md)) pass, including any new/updated ones for the changed journey.
- [ ] `tsc --noEmit` clean.
- [ ] `pnpm lint` clean.
- [ ] Zero console errors or hydration warnings on any changed/new route.

## 9. Visual QA

- [ ] Full [10_VISUAL_QA.md](10_VISUAL_QA.md) checklist run on changed/new screens: no broken layout, spacing drift, clipping, z-index issues, theme inconsistency, hydration flicker, animation glitches, blurry images, icon inconsistency, or layout shift.

## 10. SEO

- [ ] Every page has an accurate, unique `<title>` and `meta description` (via Next.js `Metadata` export, per `app/layout.tsx`'s pattern).
- [ ] Semantic heading structure (one `h1`, logical nesting) — doubles as an accessibility and SEO requirement.
- [ ] Images have meaningful `alt` text (crawlable content signal, also an accessibility requirement — see [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md) §14).
- [ ] `next/image` used so Core Web Vitals (a ranking factor) stay healthy.
- [ ] Canonical URLs / Open Graph tags present for shareable pages (corpus/book detail pages especially, given this is a credibility/reference site people may link to directly).

## 11. Security

- [ ] No secrets/API keys committed or exposed client-side (this is a static/content site — verify nothing pipeline-internal from `french/extracted/`, etc. leaks into client-shipped data).
- [ ] Dependencies free of known critical vulnerabilities (`pnpm audit` or equivalent) before release.
- [ ] No `dangerouslySetInnerHTML` usage beyond the existing, reviewed theme-init script in `app/layout.tsx` without explicit review — any new usage is a security-review-worthy change.
- [ ] External links (if any) use `rel="noopener noreferrer"` where `target="_blank"` is used.

## 12. Documentation

- [ ] This `docs/00`–`15` set updated if the change altered a documented fact (stack version, token, architecture decision) — per [00_MASTER_FRONTEND.md](00_MASTER_FRONTEND.md) §12's "keep this document set internally consistent" rule.
- [ ] Any new non-obvious component documented only to the extent [09_COMPONENT_STANDARDS.md](09_COMPONENT_STANDARDS.md) §11 requires (no excess docblocks).

## 13. Deployment Readiness

- [ ] Production build (`pnpm build`) completes with zero errors/warnings.
- [ ] Environment/config changes (if any) communicated explicitly — no silent config drift between local/preview/production.
- [ ] Vercel preview deployment reviewed and matches production build behavior before merge.
- [ ] **Any change to Vercel project settings, domains, or CI configuration explicitly confirmed with the user first** — never bundled silently into a feature release (see [00_MASTER_FRONTEND.md](00_MASTER_FRONTEND.md) §12).
- [ ] Rollback plan clear (know the last-known-good deployment/commit) before merging to the production branch.

---

## 14. Sign-Off

A release is ready only when every checked box above is genuinely true — not "probably fine." Where a layer couldn't be verified (no browser available, no Lighthouse access, etc.), that must be stated explicitly as an open gap, not silently skipped. Cross-reference [14_SCORECARD.md](14_SCORECARD.md) for a full quality score if a broader release (not a small fix) is going out — target 7+/10 on every category before shipping.

---

**This is the last document in the set.** Return to [00_MASTER_FRONTEND.md](00_MASTER_FRONTEND.md) for the operating principles this entire checklist exists to enforce.
