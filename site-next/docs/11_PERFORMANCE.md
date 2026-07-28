# 11 — Performance Standards

> Frontend performance rules for Next.js 16 + React 19 in `site-next/`. Performance is a correctness concern here, not an optimization afterthought — a slow, janky presentation of "zero data loss, 94% fidelity" undercuts the exact claim the product is making about itself.

---

## 1. Core Web Vitals — Targets

| Metric | Target | Why it matters here |
|---|---|---|
| **LCP** (Largest Contentful Paint) | < 2.5s | First impression of the home/engine page — this is the "discover" journey from [05_UX_REVIEW.md](05_UX_REVIEW.md) §1; a slow LCP directly damages it. |
| **INP** (Interaction to Next Paint) | < 200ms | Search, filters, theme toggle, nav — must clear the Doherty Threshold (~400ms) with margin. |
| **CLS** (Cumulative Layout Shift) | < 0.1 | See [10_VISUAL_QA.md](10_VISUAL_QA.md) §2.11 — images, fonts, skeletons are the usual culprits. |
| **TTFB** (Time to First Byte) | < 600ms | Server Component data-fetching efficiency, Vercel edge/region config. |

Measure with: Lighthouse (local + CI), Chrome DevTools Performance panel, and real-field data via Vercel Analytics/Speed Insights if enabled.

---

## 2. Server Components First

The single biggest performance lever in this stack: **a Server Component ships zero client JS.** Every unnecessary `"use client"` directly costs bundle size and hydration time. Re-derive this from [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §3 — the rule there ("push `use client` to the leaf") is as much a performance rule as an architecture one.

- Data fetching happens in Server Components directly (`async function Page()`), not via client-side `useEffect` + fetch.
- Static/mostly-static routes should render as much as possible on the server/at build time; only the genuinely interactive leaf (search input, theme toggle, mobile nav trigger) pays the client JS cost.

---

## 3. Image Optimization

- **Always `next/image`**, never raw `<img>`, for any content image (corpus/fidelity screenshots, illustrations) — automatic format negotiation (AVIF/WebP), responsive `srcset`, and lazy-loading below the fold come free.
- Set explicit `width`/`height` (or `fill` with a sized parent) always — this is also the CLS fix from [10_VISUAL_QA.md](10_VISUAL_QA.md) §2.11.
- `priority` prop only on the actual LCP image (typically one hero image above the fold on `/` or `/engine`) — never mark every image `priority`, which defeats its purpose.
- Correct `sizes` attribute matching actual rendered size at each breakpoint — see [08_RESPONSIVE.md](08_RESPONSIVE.md) §13 for the high-DPI angle on this same rule.

---

## 4. Font Loading

- All fonts via `next/font/google` (Fraunces, Inter, IBM Plex Mono per `app/layout.tsx`) — this self-hosts Google Fonts at build time, eliminating the render-blocking third-party font request entirely and providing automatic `size-adjust` fallback matching to minimize layout shift during font swap.
- Load only the weights/subsets actually used (`IBM_Plex_Mono` already scopes to `weight: ["400","500","600"]`, `subsets: ["latin"]` — match this discipline for any new font addition per [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §3.1; don't load a family's full weight range "just in case").
- Prefer variable fonts (Fraunces already uses `axes: ["opsz"]`) over multiple static weight files where Google Fonts offers a variable version — fewer requests, smaller total payload.

---

## 5. Code Splitting & Dynamic Imports

- Heavy client-only libraries load via `next/dynamic` when not needed for first paint:
  - **ECharts** (`components/echart.tsx` and its consumers `bar-chart.tsx`, `cost-donut.tsx`, `qa-donut.tsx`) — dynamically import with `ssr: false` for any chart not in the initial viewport, or at minimum ensure the ECharts core library itself isn't pulled into the main bundle for a page that doesn't render a chart above the fold.
  - **`cmdk`** (`components/ui/command.tsx`, `global-search.tsx`) — the command palette's full implementation only needs to load once the user actually opens it (or, at minimum, doesn't need to block first paint).
- Route-level code splitting is automatic under the App Router (`app/*/page.tsx` boundaries) — don't fight this by importing across route boundaries in a way that forces shared bundling of route-specific code.

---

## 6. Lazy Loading

- Below-the-fold charts/images/heavy components: lazy-load via `next/dynamic` (component-level) and `next/image`'s built-in lazy loading (image-level, on by default for non-`priority` images).
- Don't lazy-load anything above the fold or on the critical path to LCP — that would delay the exact content that needs to appear fastest.

---

## 7. Bundle Analysis

- Periodically (and any time a new dependency is added) check bundle impact — `next build` output includes route-level First Load JS sizes; watch for a route's JS budget growing unexpectedly after a change.
- No new runtime dependency without confirming it's not already covered by the existing stack (see [01_PROJECT_CONTEXT.md](01_PROJECT_CONTEXT.md) §2) — every new dependency is a bundle-size and maintenance liability, not a free win.

---

## 8. Rendering Optimization & Memoization

- Default to **not** memoizing. `useMemo`/`useCallback` are justified by a measured re-render cost, not applied reflexively to every value/function in a component — unjustified memoization adds cognitive overhead and can itself cost more than the render it "saves" for cheap computations.
- For genuinely expensive derived data (e.g. sorting/filtering a large corpus dataset for `data-table.tsx`), memoize the computation, not the JSX.
- React 19's compiler-assisted optimizations (if enabled in this project's Next.js/React config) reduce the need for manual memoization further — check before manually optimizing something the compiler may already handle.

---

## 9. Hydration Performance

- Minimize the amount of HTML that needs hydrating by keeping Server Components as the default (§2) — hydration cost scales with client component tree size, not just JS bundle size.
- Avoid large client component subtrees where only a small leaf is genuinely interactive — re-extract per [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §3 rather than accepting a large hydration boundary for convenience.

---

## 10. Streaming & Suspense

- Use `loading.tsx`/`<Suspense>` boundaries at route/section level for any data fetch that isn't instant (e.g. a corpus detail page's heavier stats) so the shell/nav paints immediately and data streams in — this directly serves the LCP target in §1 and the Doherty Threshold in [05_UX_REVIEW.md](05_UX_REVIEW.md) §2.
- Pair every Suspense boundary with a skeleton matching final content dimensions (see [10_VISUAL_QA.md](10_VISUAL_QA.md) §2.11) so streaming doesn't introduce the layout shift it's meant to avoid.

---

## 11. Caching

- Leverage Next.js's built-in data/fetch caching and static rendering wherever content isn't per-request-dynamic (most of this site — corpus/fidelity data changes on a content-pipeline cadence, not per-request) — prefer static/ISR-style rendering over forcing dynamic rendering without a reason.
- Vercel's edge caching applies automatically to static/ISR output — don't add a custom caching layer without confirming the platform default doesn't already cover the need.

---

## 12. Performance Budgets

| Budget | Value | Enforcement |
|---|---|---|
| First Load JS per route | Keep it lean — flag any route-level regression >20% vs. its prior build | `next build` output diff |
| LCP | < 2.5s on representative pages | Lighthouse in CI / manual check before release |
| CLS | < 0.1 | Lighthouse / DevTools |
| Total image payload above the fold | Minimize — prefer `next/image` auto-format + correct `sizes` over raw payload reduction tricks | Network panel |

If a change would blow a budget, that's a P1 finding (per [04_UI_REVIEW.md](04_UI_REVIEW.md) severity scale) to flag before shipping, not after.

---

## 13. Measurement Techniques

1. **Lighthouse** (Chrome DevTools or CLI) — Core Web Vitals + actionable diagnostics, run against `pnpm build && pnpm start` (production build), never against `pnpm dev` (dev server numbers are not representative).
2. **DevTools Performance panel** — frame-by-frame rendering cost, main-thread blocking, exact source of jank (ties to [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md) §7).
3. **Network panel** — verify image formats served (AVIF/WebP), font request count/timing, and no unexpectedly large JS chunks on a route that shouldn't need them.
4. **`next build` output** — route-level First Load JS sizes, flagged regressions.
5. **Vercel Analytics/Speed Insights** (if connected) — real-user field data as the ultimate check against synthetic Lighthouse numbers.

---

## 14. Performance Checklist (Pre-Ship)

- [ ] No unnecessary `"use client"` added — every one justified per [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §3.
- [ ] All images via `next/image`, correctly sized/`sizes`, `priority` only on the true LCP image.
- [ ] Fonts loaded via `next/font/google` only, scoped to needed weights/subsets.
- [ ] Heavy libraries (ECharts, cmdk) dynamically imported where not needed for first paint.
- [ ] No unjustified `useMemo`/`useCallback` noise; genuinely expensive computations are memoized.
- [ ] Suspense boundaries + matching skeletons for any non-instant data fetch.
- [ ] Measured against Lighthouse/Core Web Vitals targets in §1 on a production build, not dev server.
- [ ] Bundle impact checked for any new dependency.

---

**Next:** [12_PLAYWRIGHT.md](12_PLAYWRIGHT.md) to encode critical flows (including performance-sensitive ones) into repeatable E2E tests.
