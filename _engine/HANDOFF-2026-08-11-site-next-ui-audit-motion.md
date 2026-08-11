# Handoff — `site-next` UI/UX audit, remediation & motion system

**Date:** 2026-08-11
**Scope:** `site-next/` frontend, plus two infrastructure changes made *outside* the repo.
**Branch worked on:** `lingotran-engine-v1.1.0`
**Read this before touching `site-next/`, `app/globals.css`, `next.config.ts`, `playwright.config.ts`, or the Vercel/Netlify setup.**

Companion docs: [`site-next/docs/00_MASTER_FRONTEND.md`](../site-next/docs/00_MASTER_FRONTEND.md) is still the root of authority for frontend rules. This file records **what changed, what is deployed, and which decisions must not be "cleaned up"**.

---

## 0. ⚠️ Concurrency warning — read first

An automated run in this repo commits with a broad `git add`, **concurrently with interactive sessions**. During this session it:

- swept two throwaway audit scripts (`site-next/_a1.mjs`, `_a2.mjs`) into commit `cfc1f37`;
- committed a large part of this session's work without being asked;
- advanced `main` while work was in progress;
- caused a `.next/` collision that corrupted the dev server's Turbopack cache.

**Consequences for you:**

1. `git status` in this repo is not a reliable record of "what this session did" — some of it is already committed.
2. **Never run `next build` into the same `distDir` as a live `next dev`.** That is what corrupted the Turbopack cache (`Unable to open static sorted file … .sst`). Use the escape hatch added for exactly this (§4.1).
3. If you see stray `_*.mjs` files at `site-next/` root, they are audit scratch files, not source. Delete them.

---

## 1. Current state — committed vs uncommitted vs deployed

These three are **not** the same thing. Check before assuming.

### Already committed (by the automation)
Charts rewrite, Explorer client-fetch, platform files, token refactor, and most component changes. Notably:
`components/charts/{donut,qa-donut,bar-chart,cost-donut}.tsx`, `components/{select-field,csv-explorer-table,global-search,theme-toggle,mobile-nav,kpi-card}.tsx`, `lib/{site,csv-data,csv-explorer-shared}.ts`, `app/{robots,sitemap,manifest}.ts`, `app/opengraph-image.tsx`, `package.json` (incl. `motion`), `README.md`.
**Deleted and committed:** `components/echart.tsx`, `lib/chart-tokens.ts`, `components/ui/select.tsx`, `site/` (21 files), `netlify.toml`.

### Uncommitted at handoff time (~23 files)
```
M  .gitignore  app/globals.css  app/layout.tsx  next.config.ts
M  playwright.config.ts  tsconfig.json
M  app/{page,engine/page,reference/page,not-found}.tsx
M  app/{french/page,french/[slug]/page,german/page,explorer/[lang]/[type]/page}.tsx
M  components/{corpus-console,fidelity-card,footer,section}.tsx
M  tests/e2e/{accessibility,explorer,search}.spec.ts
?? components/byline.tsx  components/react-bits/
```

### Deployed to production
**Production is BEHIND the working tree.** It has the earlier fixes but *not* the motion work, the byline, the CSP fix, or the prose measure. Verify with:

```bash
CSS=$(curl -s https://lingotran-engine.vercel.app/ | grep -o '/_next/static/chunks/[^"]*\.css' | head -1)
curl -s "https://lingotran-engine.vercel.app$CSS" | grep -c "scan-head"   # 0 = motion work not live
```

---

## 2. Infrastructure changed OUTSIDE the repo

Both are done and verified. Do not redo.

| Change | Detail |
|---|---|
| **Vercel `rootDirectory`** | Was `null` → set to `site-next` via the REST API. This was why every build failed with `No Next.js version detected`: there is no `package.json` at the repo root, so Vercel ran `npm install` in a directory with no manifest. Production redeployed `READY` and is aliased to `lingotran-engine.vercel.app`. **If builds start failing with that error again, check this setting first.** Leave "Include files outside the root directory" OFF — `site-next/` is self-contained and the corpus CSVs are snapshotted into `public/data/`. |
| **Netlify project deleted** | The old static `site/` was published to Netlify via the root `netlify.toml`. Both are gone: `site/` and `netlify.toml` deleted from the repo, and Netlify project `8068d1c6-f86e-488a-b61b-8e9c8e31585d` (`lingotran-engine`) deleted. `lingotran-engine.netlify.app` is dead by design. The unrelated `lingotran-task` Netlify project was left alone. `NETLIFY_URL` was removed from `lib/data.ts`. |

---

## 3. 🚫 Do NOT undo these — non-obvious decisions with reasons

Every item here looks like dead code or redundancy and is not. Each was verified by measurement.

### 3.1 `tabIndex={0}` on the skip link — `app/layout.tsx`
Looks redundant (`<a href>` is natively focusable). **It is not.** WebKit/Safari does not place links in the sequential focus order by default, so removing it makes the skip link **unreachable by keyboard in Safari**. This was removed as "cleanup" during this session and the e2e suite caught it. Leave it.

### 3.2 The theming model — one `light-dark()` source
`app/globals.css` declares every theme-dependent value **once**, as `light-dark(light, dark)`, resolved via `color-scheme`. **Do not add a second copy of a token under `[data-theme="dark"]` or `@media (prefers-color-scheme: dark)`.** That duplicated-block pattern is exactly how `--amber-strong` went missing from one of two hand-kept dark blocks and dropped amber text to **2.99:1** (WCAG AA fail) for anyone using the toggle from a light OS. Composite values (gradients, shadows, glows) are assembled from `light-dark()` *colour parts* for the same reason.

### 3.3 The `dark:` custom variant covers **both** signals
`@custom-variant dark` in `globals.css` has two branches (attribute *and* `prefers-color-scheme`). Keyed to the attribute alone, every `dark:` utility silently no-ops for system-dark visitors who never touched the toggle — which shipped the **violet logo on the near-black header** for most dark-mode users. 15 `dark:` usages depend on this.

### 3.4 `:focus-visible` is deliberately **unlayered**
It sits outside `@layer base`, after the imports. Tailwind's preflight ships `* { outline-color: color-mix(in oklab, var(--ring) 50%, transparent) }` unlayered, and unlayered beats layered regardless of specificity — so inside `@layer base` the rule lost its *colour* and every focus ring on the site rendered at half alpha (**2.08:1**, below the 3:1 of WCAG 1.4.11). It also re-declares `transition-property` without `outline-color`, because Tailwind's `transition-colors` otherwise makes the ring fade in *from* `currentColor` — on the white-on-violet CTA that was **1.08:1** for ~150 ms.

### 3.5 No `upgrade-insecure-requests` in the CSP — `next.config.ts`
Deliberately absent, with a comment. WebKit applies it to `localhost` (Chromium exempts localhost as trustworthy), so every asset failed with `SSL connect error`: no CSS, no JS, a dead page in Safari while Chromium looked perfect. It buys nothing here — HSTS already forces HTTPS, Vercel serves HTTPS only, and the site loads no third-party subresources.

### 3.6 `'unsafe-eval'` / `ws:` are dev-only
Gated on `process.env.NODE_ENV !== "production"`. React's dev build needs `eval()` for debugging and `next dev` needs its HMR websocket. Without them the dev server serves a page whose own framework cannot boot. Production correctly has neither.

### 3.7 `--border-control` is separate from `--border`
Card edges may be faint (no meaning). A *control* edge is the only thing indicating an input/select exists, so WCAG 1.4.11 requires 3:1. `--border` measured **1.26:1**. `--border-control` is `--slate-500` — the first step on the existing ramp clearing 3:1 against **both** `--surface` (5.45:1) and `--bg` (5.03:1). Dark needs `.36` alpha for 3.33:1.

### 3.8 `.spotlight > *` is scoped
`:where(:not(.absolute):not(.fixed))`. Unscoped, it overrode `position: absolute` on the KPI cards' top accent hairline, dropping it into normal flow **21 px below the card edge and 42 px narrower** — a stray floating line on every KPI card site-wide.

### 3.9 Stagger delays are inline styles, never `delay-[Nms]` classes
Tailwind v4 scans for *literal* class candidates, so `delay-[${n}ms]` is never generated — the class landed in the DOM resolving to nothing and the section choreography was dead. Use `style={{ transitionDelay }}`.

### 3.10 `--prose-max` is `34em`, not `72ch`
`ch` is the advance width of "0" (~0.6em in Inter), not an average character, so `72ch` fits ~86 characters — past the comfortable 45–75 band. It also resolved against whichever element carried it (727 px on a 16 px container). `34em` is font-size-relative and yields **68 characters at every step of the type scale**. **It must be set on the text element itself**, not a wrapper.

### 3.11 The reduced-motion resting state for the hero — required, not optional
`@media (prefers-reduced-motion: reduce)` block near the scan keyframes. The global reduced-motion reset forces `duration: 0.001ms` + `iterations: 1`, and every scan track uses `both` fill — so each snapped to its **100% keyframe**, which in a loop is the *handoff* frame. The entire card rendered at **opacity 0**: reduced-motion users got an empty box. The explicit block pins the HOLD beat instead.

### 3.12 One `GlobalSearch` instance only
It renders *both* triggers itself (pill ≥ sm, icon button below). `CommandDialog` portals an sr-only `DialogHeader` to `<body>`; a second instance put that header outside every landmark and tripped axe's `region` rule on all nine routes.

---

## 4. Tooling changes you need to know

### 4.1 `NEXT_DIST_DIR` — build alongside a live dev server
```bash
NEXT_DIST_DIR=.next-prod pnpm build
NEXT_DIST_DIR=.next-prod pnpm start   # then e.g. -p 4173
```
Unset, behaviour is unchanged (`.next`). `playwright.config.ts` sets it for e2e. `.next-prod/` is gitignored. **This exists because sharing `.next` with `next dev` corrupts the Turbopack persistent cache.**

### 4.2 Playwright config
- `workers: process.env.CI ? 2 : 3` and `expect: { timeout: 10_000 }`. The site now runs an infinite rAF (byline) plus 11 CSS tracks (hero) on every route; 10 parallel contexts starved each other into ~11 timeout failures that were **load artefacts, not defects** (same tests pass at low concurrency; a solo WebKit run reports 0 console errors). A red run should now mean a real regression.
- The axe describe block has `timeout: 120_000` — each test scrolls the whole page to trigger every reveal, waits for finite animations, then runs a full axe pass **twice** (light + dark). `/engine` alone takes ~22 s.

### 4.3 `settle()` in `tests/e2e/accessibility.spec.ts`
Scrolls the page to trigger every IntersectionObserver reveal, *then* waits for finite animations, *then* scans. A fixed wait is wrong: sections sit at `opacity-0` until revealed, axe walks the whole DOM regardless of scroll, and reported `#848198 on #fcfcfe` — `--text-muted` composited at partial opacity, not any real token. Infinite animations are excluded (the hero loop never settles by design).

### 4.4 Row-count regexes accept thousands separators
Counts are `toLocaleString()`-formatted (`"5,566 of 5,566 rows"`), so `/of [\d,]+ rows/`, not `/of \d+ rows/`.

---

## 5. The motion system (new)

All CSS except the byline. See the big comment blocks in `globals.css`.

| Piece | Where | Notes |
|---|---|---|
| **Verification pass** (hero loop) | `.scan-*` in `globals.css`, `components/fidelity-card.tsx` | 5 beats over `--scan-cycle` (7.2 s): settle → sensor sweep with text resolving blur→sharp behind a `clip-path` → fields check in with ticks landing late (follow-through) → badge stamps → hold. **Sync strategy: every track shares the same duration and iteration count and does nothing outside its slice.** A sub-cycle duration with `infinite` desynchronises immediately — the per-row stagger is a small positive `animation-delay` (`--row-stagger`), never a shorter duration. Hover/focus pauses it (inspect affordance). |
| **Grow from origin** | `.unfold` | Corpus detail panel unfolds out of its row via `clip-path`, not `scaleY` (which distorts text). Enter-only: the panel is conditionally rendered, and things leaving should not detain you. |
| **Ease curves have jobs** | `--ease-enter` / `--ease-exit` / `--ease-move` | Arriving (slight overshoot) / leaving (none) / repositioning. `--ease-out` and `--ease-spring` kept as aliases so nothing existing changed. |
| **Scroll-driven layer reveal** | `.layer-row`, `/engine` | Native `animation-timeline: view()`, `@supports`-guarded. **Not Baseline** (Firefox stable was catching up; ~84% global, Interop 2026 priority). Fallback = rows simply present. |
| **Byline sweep** | `components/byline.tsx` + `components/react-bits/shiny-text.tsx` | React Bits `ShinyText` (MIT, `DavidHDev/react-bits`, `ts-tailwind`), vendored faithfully so it stays diffable. Requires `motion` (installed, 13.0.0). |

### Byline: two integration decisions
1. **Colour.** A conventional silver shimmer cannot be accessible on the light footer — anything bright enough to read as a highlight falls under 4.5:1 (`--brand-500` = **4.44:1**). The sweep runs to `--link`, so the name *inks violet* in light (11.45:1) and genuinely shines in dark (8.55:1). CSS custom properties are passed into the gradient so it flips with `light-dark()` for free.
2. **rAF gating.** Upstream's `useAnimationFrame` runs every frame for the life of the page. This instance is in the footer, below the fold on every route. An IntersectionObserver flips ShinyText's own `disabled` prop so the loop only runs while visible — verified to actually stop. Reduced motion also sets `disabled`, and **cannot** be delegated to the CSS reset because the sweep is a JS-driven `background-position`, not a CSS animation.

---

## 6. Verified results (reproduce these)

```bash
cd site-next
pnpm exec tsc --noEmit                              # clean
NEXT_DIST_DIR=.next-prod pnpm exec next build       # clean, 23 static pages
pnpm exec playwright test                           # 94/94 pass, chromium + webkit
```

| Metric | Before | After |
|---|---|---|
| axe violations (7 routes, both themes) | 0 automated / 4 real AA fails manual | **0 / 0** |
| e2e | — | **94/94** |
| Explorer HTML (`/explorer/french/questions`) | 2,647,322 B | **31,251 B** |
| JS on chart routes | 1,095,694 B | **315,490 B** |
| Focus ring, worst | 2.08:1 | **4.44:1**, 0 failures |
| Amber, toggle-dark | 2.99:1 | **9.74:1** |
| Control borders | 1.26 / 1.48 | **5.03** light / **3.27** dark |
| KPI accent bar offset | +21 px, −42 px wide | **+1 px, −2 px** (border only) |
| Section stagger | dead (0 s) | **0 / 60 / 120 / 180 ms** |
| No-JS sections | all `opacity: 0` | **all visible** (`@media (scripting: none)`) |
| System-dark logo | violet on near-black | **white** |
| Theme toggle latency | 537 ms | **61–128 ms** |
| Mobile sticky chrome | 110 px (14% vp) | **61 px (8%)** |
| Prose measure | 90–97 ch | **68 ch** |
| CLS / LCP | 0 / ~208 ms | **0 / ~240 ms** |

Scorecard (per `site-next/docs/14_SCORECARD.md`) was **6.65/10** at audit time; the findings behind every low category are now closed.

---

## 7. Open decisions — do not resolve unilaterally

1. **~23 files uncommitted.** Harshan handles git in this repo; he asked not to have it committed for him. One commit + push to `main` ships everything (the Vercel fix means the build now succeeds on its own).
2. **`motion` costs +40 KB** on every route, carried solely for the byline sweep. The identical visual is reachable in pure CSS (`background-position` keyframes, which also composites off-main-thread and stops when off-screen without an observer). Harshan asked for React Bits explicitly and was told the cost; he has not ruled either way. It is also the right tool if the shared-layout row→dialog transition is wanted later.
3. **Audit artifact is stale** — the published report describes the pre-fix state.
4. **Not done, identified as the next motion win:** the Explorer row→dialog still pops rather than emerging from the clicked row. `motion`'s shared layout is now available for it.

---

## 8. Not covered by any of this

Real screen-reader passes (NVDA/VoiceOver), real-device touch testing, field Core Web Vitals, and Lighthouse on throttled mobile hardware. All measurements above are desktop Chromium/WebKit via Playwright against a local production build.
