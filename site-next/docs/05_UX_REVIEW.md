# 05 — UX Review Standards

> Journey-level review, sitting above [04_UI_REVIEW.md](04_UI_REVIEW.md)'s element-level audit. Use this when reviewing flows, navigation, or overall experience quality in `site-next/`.

---

## 1. The Core Journeys in This Site

Before any UX review, restate the journey being evaluated. The primary ones today:

1. **Discover** — land on `/`, understand what Lingotran Engine is and why the fidelity claim matters, in one screen.
2. **Explore the engine** — `/engine`: understand the architecture (layers, roles, agents, models) without needing prior context.
3. **Browse a corpus** — `/french` or `/german` → `/french/[slug]`: scan available books/corpora, drill into one, understand its fidelity/QA metrics.
4. **Reference/verify** — `/reference`: look up specifics (likely for a technical/skeptical reader validating claims).

Every UX review starts by naming which of these (or a sub-flow within one) is in scope.

---

## 2. Foundational Laws of UX

Apply these explicitly — name the law when it's the reason for a recommendation, don't just assert "this feels better."

| Law | Statement | Applied here |
|---|---|---|
| **Jakob's Law** | Users spend most of their time on *other* sites; they expect yours to work the same way. | Nav, search, and theme-toggle placement should match conventional positions (top nav, top-right search/toggle) unless there's a specific reason to diverge — don't relocate familiar controls for novelty. |
| **Hick's Law** | Decision time increases with the number and complexity of choices. | Corpus/language selection should not present every book/language as an undifferentiated flat list once the catalog grows — group/filter (see [01_PROJECT_CONTEXT.md](01_PROJECT_CONTEXT.md) §6 on N-language scalability). |
| **Fitts's Law** | Time to acquire a target is a function of distance and size. | Primary actions (nav items, CTA buttons, close/dismiss controls) need adequate touch/click target size — see [08_RESPONSIVE.md](08_RESPONSIVE.md) §"Touch Targets." Frequently-used controls (theme toggle, search) stay in fixed, reachable positions (header). |
| **Miller's Law** | Working memory holds about 7 (±2) items. | Nav bars, filter chip groups, and legend entries should chunk beyond ~7 items rather than listing everything flat. |
| **Doherty Threshold** | Productivity/engagement rises sharply when system response is <400ms. | Search (`global-search.tsx`), filters, and route transitions must feel instant — perceived latency matters as much as real latency; see [11_PERFORMANCE.md](11_PERFORMANCE.md) and skeleton/optimistic-state guidance in [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md). |
| **Tesler's Law (Conservation of Complexity)** | Complexity can't be removed, only moved — the question is who bears it, user or system. | Corpus/fidelity data is genuinely complex; the system (component design, data formatting, defaults) should absorb that complexity so the user faces a clean read, not a raw data dump. |
| **Gestalt Principles** (proximity, similarity, common region, continuity) | Grouped/similar/enclosed elements read as related. | KPI cards in a row read as one comparison set because of consistent spacing/sizing (proximity + similarity); a bordered card (common region) should only enclose things that are actually one unit — don't group unrelated stats inside one card border. |
| **Recognition over recall** | Showing options beats making users remember them. | Status/fidelity meaning should be legible from the badge/color itself (`--verified`/`--flag`/`--amber` semantics) without requiring the user to remember a legend, though a legend should still exist for the color-blind/first-time case. |

---

## 3. Nielsen's 10 Usability Heuristics — Applied

1. **Visibility of system status** — loading/empty/error states always present (see [04_UI_REVIEW.md](04_UI_REVIEW.md) §3.11–3.12); theme toggle immediately reflects its new state.
2. **Match between system and the real world** — fidelity/QA terminology should match how the actual pipeline/team talks about it (see project memory on French multi-PDF rollout), not invented marketing jargon.
3. **User control and freedom** — every dialog/drawer/search has an obvious, working "escape hatch" (Esc, click-outside, explicit close).
4. **Consistency and standards** — one component per concept, everywhere (cross-reference [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §12).
5. **Error prevention** — destructive or irreversible actions (if any are ever added) get a confirmation step; forms validate before submission where relevant.
6. **Recognition rather than recall** — see Gestalt/recognition-over-recall above.
7. **Flexibility and efficiency of use** — power-user paths (keyboard shortcuts via `cmdk`, direct URLs to a corpus/book) coexist with the discoverable click-through path; neither is required to use the other.
8. **Aesthetic and minimalist design** — no decorative element competes with the actual data; every visual flourish must earn its place (see [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §5, "restrained accent color").
9. **Help users recognize, diagnose, and recover from errors** — a missing corpus slug 404s with a clear message and a way back, not a blank page.
10. **Help and documentation** — for a technical-credibility site like this, the `/reference` page *is* the help system; it must be genuinely discoverable from anywhere a skeptical reader would want it.

---

## 4. Information Architecture

- **Depth vs. breadth**: current IA is shallow (home → engine/french/german/reference, one level of nesting into `[slug]`) — this is correct for the content volume today. As corpora grow (see project memory), prefer adding structure *within* a language index page (grouping, filtering) before adding URL depth that fragments the mental model.
- **Findability**: every piece of content should be reachable via both browsing (nav) and search (`global-search.tsx`) — a corpus that only exists behind a search query with no nav path is an IA gap.
- **Labeling**: nav/section labels should match the user's mental model of "language → corpus → book," not internal pipeline terminology (e.g. don't expose internal extraction-stage names as user-facing labels).

---

## 5. Discoverability & Progressive Disclosure

- Surface the **most decision-relevant** information first (top-line fidelity %, QA pass rate) and let detail (per-page breakdowns, token/cost tables) be one click/scroll deeper — don't front-load a full data table above the fold on a corpus index page.
- Progressive disclosure should never hide something the user came specifically looking for (e.g. don't bury the actual fidelity number behind an extra click if that's the site's core value prop — see [01_PROJECT_CONTEXT.md](01_PROJECT_CONTEXT.md) §9).

---

## 6. Cognitive Load & Feedback Systems

- Every user action that isn't instantaneous gets feedback within the Doherty Threshold (~400ms) — a skeleton, spinner, or optimistic UI update, not silence.
- Numbers/metrics should never require mental math — show the percentage, not just the raw counts, if the percentage is the point (and vice versa, per what the specific screen is arguing).
- Reduce simultaneous decisions: a corpus detail page shouldn't ask the user to parse fidelity score, QA breakdown, cost table, and navigation options all with equal visual weight at once — establish a clear read order (see [04_UI_REVIEW.md](04_UI_REVIEW.md) §3.13 hierarchy).

---

## 7. Error Prevention & Trust

- This site's entire value proposition is *trustworthiness of data*. Any UX inconsistency (a stat that doesn't add up across two views, a stale-looking cache) is disproportionately damaging here versus a typical marketing site — treat data-consistency bugs as UX P0s, not just correctness bugs.
- Never show a metric without enough context to interpret it (a bare "94.2%" needs a label of *what* is 94.2% and ideally a comparison point or threshold).

---

## 8. Onboarding & Delight

- This site doesn't have a traditional "onboarding flow" (no account, no setup) — its onboarding *is* the home page's first screen. That screen carries all the weight normal products spread across an onboarding sequence.
- Delight here comes from **precision, not decoration** — a subtly well-animated number count-up on a KPI card, a chart that draws in smoothly, fits this brand; a bouncy playful animation would undercut the "system of record" positioning (see [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md)).

---

## 9. Cross-Reference: Platform Design Guidance

Use these as supplementary lenses, not replacements for the above — this is a web product, not a native OS app, so adapt rather than import wholesale:

- **Apple HIG** — clarity, deference, depth; spacing/typography discipline (already reflected in [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md)).
- **Material Design 3** — elevation and state-layer thinking (hover/focus/pressed as systematic overlays) maps well onto our `--shadow-*`/interaction-state rules.
- **Microsoft Fluent** — "light, depth, motion, material, scale" — useful lens for judging whether motion/elevation choices feel coherent as a system, not ad hoc.

---

## 10. UX Review Reporting Format

```
### Journey: [name]
**Heuristic/law violated:** [name]
**Where:** [route/component]
**What happens:** [concrete description of the friction]
**Impact:** [who hits this, how often, how bad]
**Fix:** [specific, actionable]
```

Prioritize by user impact × frequency, not by ease of fix.

---

**Next:** [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md) — the "Doherty Threshold" and "delight" sections above both depend on getting motion right.
