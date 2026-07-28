# 14 — Enterprise Frontend Scorecard

> A weighted scoring rubric for evaluating the overall quality of `site-next/` (or any single page/feature within it) against the standards in `00`–`12`. Use this for periodic quality audits, before a major release, or when the user asks "how good is this, really?"

---

## 1. Scoring Methodology

- Score each category 0–10 (see the rubric per category below for what 0/5/10 look like).
- Multiply by weight, sum, divide by 100 → overall score out of 10.
- **A single P0 finding (per [04_UI_REVIEW.md](04_UI_REVIEW.md) severity scale) anywhere in scope caps the overall score at 5/10**, regardless of category math — a broken experience isn't "7/10 enterprise-grade," it's not shippable, full stop.
- Score at two grains: **whole-site** (for a periodic health check) and **single-page/feature** (for reviewing one piece of work) — state which grain a given scorecard run is evaluating.

---

## 2. Weighted Criteria

| Category | Weight | Reference doc |
|---|---|---|
| Architecture & code quality | 15% | [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) |
| UI polish & design-system fidelity | 15% | [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md), [04_UI_REVIEW.md](04_UI_REVIEW.md) |
| UX quality | 12% | [05_UX_REVIEW.md](05_UX_REVIEW.md) |
| Accessibility | 13% | [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md) |
| Responsiveness | 10% | [08_RESPONSIVE.md](08_RESPONSIVE.md) |
| Motion quality | 8% | [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md) |
| Performance | 12% | [11_PERFORMANCE.md](11_PERFORMANCE.md) |
| Design-system maturity | 5% | [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) |
| Maintainability | 5% | [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md), [09_COMPONENT_STANDARDS.md](09_COMPONENT_STANDARDS.md) |
| Production readiness (testing, QA) | 5% | [10_VISUAL_QA.md](10_VISUAL_QA.md), [12_PLAYWRIGHT.md](12_PLAYWRIGHT.md) |

Weights sum to 100%. Accessibility, UI polish, and architecture are weighted highest because they're both the hardest to retrofit and the most visible signals of overall quality — a performance regression is bad, but an inaccessible or visually sloppy product actively contradicts this project's positioning (see [01_PROJECT_CONTEXT.md](01_PROJECT_CONTEXT.md) §10).

---

## 3. Rubric Per Category

### Architecture & Code Quality (15%)
- **0–3**: Ad hoc `"use client"` everywhere, duplicated components, arbitrary Tailwind values, no CVA for variant components, deep relative imports.
- **4–6**: Mostly follows [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) but with inconsistent RSC/Client boundaries or occasional reinvented components.
- **7–8**: Consistent RSC-first architecture, CVA variants throughout, `@/*` imports, no unjustified duplication.
- **9–10**: All of the above, plus demonstrable restraint (no premature abstraction) and clean error-boundary placement.

### UI Polish & Design-System Fidelity (15%)
- **0–3**: Off-token colors/spacing, inconsistent components across pages, missing states (hover/focus/disabled).
- **4–6**: Mostly token-consistent with a handful of drift instances; states mostly present.
- **7–8**: Fully token-traceable, all required states present, consistent cross-page.
- **9–10**: Indistinguishable from the Stripe/Linear/Vercel/Apple/Figma benchmark bar in [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §1.

### UX Quality (12%)
- **0–3**: Confusing IA, no feedback on actions, violates multiple heuristics from [05_UX_REVIEW.md](05_UX_REVIEW.md).
- **4–6**: Core journeys completable but with friction (unclear hierarchy, missing empty/error states).
- **7–8**: Journeys are smooth, heuristics respected, feedback systems present.
- **9–10**: Journeys feel inevitable/obvious in hindsight; delight moments present without undermining the "system of record" tone.

### Accessibility (13%)
- **0–3**: Keyboard traps, missing labels, contrast failures, no screen-reader testing.
- **4–6**: Passes automated scans (axe/`accesslint`) but manual keyboard/screen-reader passes surface real issues.
- **7–8**: WCAG 2.2 AA fully met, verified manually per [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md) §17.
- **9–10**: AAA achieved where feasible, verified with real screen reader software, zero automated findings.

### Responsiveness (10%)
- **0–3**: Breaks at common viewports, horizontal overflow, unusable tables/nav on mobile.
- **4–6**: Works at primary breakpoints but rough at edge widths (320px, 2560px).
- **7–8**: Clean 320px–2560px per [08_RESPONSIVE.md](08_RESPONSIVE.md) §2.
- **9–10**: All of the above plus container-query-level polish and verified high-DPI image sharpness.

### Motion Quality (8%)
- **0–3**: No reduced-motion support, jank, arbitrary durations/easings.
- **4–6**: Reduced-motion present but motion tokens (§2 of [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md)) inconsistently applied.
- **7–8**: All motion token-driven, respects reduced-motion, no jank/layout-shift.
- **9–10**: Motion actively clarifies cause/effect and reduces perceived latency everywhere it appears; nothing purely decorative.

### Performance (12%)
- **0–3**: LCP/CLS/INP targets missed by a wide margin, unnecessary client JS everywhere.
- **4–6**: Meets targets on primary pages but with avoidable waste (unoptimized images, unneeded `"use client"`).
- **7–8**: Meets all Core Web Vitals targets in [11_PERFORMANCE.md](11_PERFORMANCE.md) §1 on representative pages.
- **9–10**: Comfortably beats targets with margin, verified via Lighthouse + real field data.

### Design-System Maturity (5%)
- **0–3**: Tokens exist but are inconsistently used or incomplete (missing dark-mode pairs, no chart mapping).
- **4–6**: Tokens comprehensive but a new component regularly needs a genuinely new token (system not yet stable).
- **7–8**: Token set in [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) covers nearly every real need; additions are rare and deliberate.
- **9–10**: System is stable and complete enough that no component in the last several changes needed a new token.

### Maintainability (5%)
- **0–3**: Duplicated logic, unclear ownership between `components/` and `components/ui/`, no reuse discipline.
- **4–6**: Mostly clean but with a few components that should be consolidated.
- **7–8**: Clear reuse discipline, SOLID/DRY/KISS/YAGNI followed per [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §9.
- **9–10**: A new engineer could extend the system correctly on their first PR without needing extra guidance beyond this doc set.

### Production Readiness (5%)
- **0–3**: No E2E coverage, visual QA is ad hoc, no verification trail.
- **4–6**: Critical journeys have some Playwright coverage; visual QA inconsistent.
- **7–8**: Full [12_PLAYWRIGHT.md](12_PLAYWRIGHT.md) §15 checklist met for critical journeys; [10_VISUAL_QA.md](10_VISUAL_QA.md) checklist run before ship.
- **9–10**: Comprehensive E2E + visual regression + a11y scans all green and running in CI.

---

## 4. Benchmark Comparison

When scoring, sanity-check the result against where this site would plausibly land next to real products:

| Score | Roughly comparable to |
|---|---|
| 9–10 | Stripe/Linear/Vercel marketing & docs sites at their best |
| 7–8 | A well-funded SaaS product's public site — solid, few complaints |
| 5–6 | A typical mid-size company site — functional, visibly inconsistent in places |
| 3–4 | An early-stage MVP — works, looks unfinished |
| 0–2 | Broken or actively embarrassing |

The enterprise bar in [00_MASTER_FRONTEND.md](00_MASTER_FRONTEND.md) §9 targets **7-8 minimum on every category, 9+ on UI polish and accessibility** given this product's positioning.

---

## 5. Scorecard Reporting Format

```
## Scorecard: [whole-site | page/feature name] — [date]

| Category | Score /10 | Weight | Weighted |
|---|---|---|---|
| Architecture & code quality | X | 15% | X.XX |
| UI polish & design fidelity | X | 15% | X.XX |
| UX quality | X | 12% | X.XX |
| Accessibility | X | 13% | X.XX |
| Responsiveness | X | 10% | X.XX |
| Motion quality | X | 8% | X.XX |
| Performance | X | 12% | X.XX |
| Design-system maturity | X | 5% | X.XX |
| Maintainability | X | 5% | X.XX |
| Production readiness | X | 5% | X.XX |
| **Overall** | | | **X.XX / 10** |

**P0 findings present:** [yes — capped at 5/10 | no]
**Top 3 things to fix for the biggest score improvement:**
1. ...
2. ...
3. ...
```

---

**Next:** [15_FINAL_CHECKLIST.md](15_FINAL_CHECKLIST.md) — the pre-release gate that should already be green if this scorecard is 7+ across the board.
