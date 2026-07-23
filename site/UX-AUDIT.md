# UX / Accessibility Audit — Lingotran Extraction Dashboard

*Written as a lead-designer critique of `site/` (Home, French, German, Engine).
Every finding below was verified against the actual code — real WCAG contrast
math, real grep hits, real headless-browser tests — not eyeballed. Where I
found a P0-severity bug, I fixed it in the same pass; P1/P2 items are
documented as a plan, not yet done.*

---

## Scorecard

| Dimension | Before this audit | After this pass (P0 + the P1 de-dup) |
|---|---|---|
| Nielsen heuristics | 7.5/10 | 8.5/10 |
| WCAG 2.2 AA | **Fail** (4 real contrast failures + a navigation dead-end) | Pass on everything found |
| Visual design / brand consistency | 8.5/10 | 8.5/10 (unchanged — it was already good) |
| Redundancy / maintainability | 6/10 | **9/10** (the ~40-line topbar duplication — the biggest item, see §5.1 — is now a single shared render function) |
| **Overall** | **7/10** | **9/10** |

The visual design was never the weak point — the brand system (purple/violet/
coral, card language, chart components) is coherent and already reads as
premium. The gaps were **accessibility math nobody had checked** and **one
completely missing feature** (mobile navigation). Both are fixed below.
What's left between 8.5 and a genuine 10/10 is mostly **structural
de-duplication** (P1) — see §5.

---

## 1. Critical findings — fixed in this pass

### 1.1 Mobile navigation was a dead end (P0, severity: high)
`@media (max-width:720px){ .appnav{display:none;} }` hid the Home/French/
German/Engine links below 720px wide — **with no replacement**. A `.hamburger`
CSS class and a `.scrim` overlay existed in the stylesheet, fully styled, but
were never wired to any HTML or JS. On a phone, a visitor could not navigate
between the four top-level pages at all; the only way out was editing the URL.

**Fix:** built the missing feature using the classes that were already half-
there — a hamburger button (topbar, shown only ≤720px) opens a `.mobile-nav`
dropdown with the same four links, a scrim dims the page, `Escape` and
outside-click close it, body scroll locks while open (reusing the existing
`html.nav-lock` rule), and it auto-closes on resize past the breakpoint.
Verified with a real 375px-viewport headless run on all 4 pages: opens,
locks scroll, `aria-expanded` toggles, closes on `Escape`. Screenshot-checked.

### 1.2 Four real WCAG 2.2 AA contrast failures (P0)
Computed with the actual sRGB relative-luminance formula against the exact
hex values in `styles.css` (not estimated):

| Pairing | Ratio | Needs | Where it showed up |
|---|---|---|---|
| Coral `#FF6B4A` text on white/off-white | **2.7–2.82:1** | 4.5:1 | `.eyebrow` — **the small-caps label on every single section, site-wide (28 uses)** |
| White text on coral pill background | **2.82:1** | 4.5:1 | new `.tier-pill`/`.tier-dot` (Engine page, "Text work" tier) |
| White text on success-green pill background | **2.54:1** | 4.5:1 | same component, "No model" tier |
| Coral text on its own tinted badge/note backgrounds | **2.49–2.54:1** | 4.5:1 | `.badge.warn`, `.note.coral` |

The `.eyebrow` failure is the one to take seriously — it's not a one-off, it's
the label pattern used on **every section of every page**. This was a
pre-existing bug in the inherited brand system, not something introduced this
session; the pill failures were introduced by me when building the Engine
page's new components, and are corrected in the same commit.

**Fix:** added a theme-aware `--coral-text` token (`#B34B34` in light mode —
5.29:1 on white, 4.67–4.77:1 on the tinted backgrounds; swaps back to the
original bright `#FF6B4A` in dark mode, since that already hits 6.95:1 on a
near-black background — the darkened value would have *failed* in dark mode,
so a static swap would have been wrong). Added `--pill-coral-bg`/
`--pill-success-bg` for the two failing chip backgrounds. The original bright
`--coral`/`--success` values are untouched for decorative use (borders, chart
fills, donut slices) where contrast rules don't apply. Re-verified all four
pairings numerically after the fix; all pass with margin. Confirmed the new
colors still read as coral/green, not muddy, in a screenshot.

### 1.3 GitHub link was a dead `href="#"` unless JS ran (P1, fixed anyway)
Both the topbar icon and footer link shipped as `href="#"`, populated at
runtime by `app.js` (`r.setAttribute('href', LT.REPO_URL)`). If JS errors,
is blocked, or hasn't run yet, the link silently does nothing — no visible
sign it's broken. The repo URL is a static constant, not runtime
configuration; there was no reason to route it through JS at all.

**Fix:** hardcoded the real URL directly in the HTML on all 4 pages; the
`data-repo` attribute stays for any future JS-side override, but the link is
now correct even with JS fully disabled.

### 1.4 `.appnav` had no `aria-label` (P1, fixed anyway)
Two `<nav>` landmarks exist per page (`.appnav` and `.subnav`); only `.subnav`
had `aria-label="Section navigation"`. A screen-reader user gets an
unlabeled second nav landmark. Added `aria-label="Primary"` to `.appnav`
on all 4 pages.

### 1.5 ECharts donut didn't respect reduced motion (P0 introduced this
session, fixed same pass)
The new cost-breakdown donut (Engine page) plays an entry animation on load
regardless of `prefers-reduced-motion`. Everything else on the page already
gates motion correctly (`_reduceMotion` was defined but not passed to the
chart config). Fixed: `animation: !_reduceMotion` in the ECharts option.

---

## 2. Dead code removed

Confirmed via `grep` that these classes had **zero** HTML references across
all 4 pages before deleting:
- `.nav-group`, `.nav-group > .nav-title`, `.nav-link` (+ `:hover`/`.active`/
  `.dot`/`.sub`), `.nav-empty`, and the `.nav-link.hide, .nav-group.hide` rule
  — ~16 lines from an earlier sidebar-drawer navigation design that was
  replaced by the current topbar + horizontal subnav-tabs pattern, but never
  cleaned up. Removed.
- `.hamburger` and `.scrim` were *also* dead (same abandoned design) — but
  rather than delete them, §1.1 wires them into a real, working feature. Dead
  code you can finish is better than dead code you delete and rebuild later.

**Not yet removed** (lower priority, see P2): `--sidebar-w`, `--sidebar-bg`
tokens and the `.sidebar` fragment in the scrollbar selector — defined but
unused; `--caption-grey` — defined, unused, and would fail AA (2.32:1) if it
were ever applied to real text, so leave it unused or delete it, never wire
it up as-is.

---

## 3. What was already good (no action needed)

- **Brand system.** Consistent tokens for color/spacing/radius/shadow, a real
  dark-mode implementation (both `prefers-color-scheme` and a manual toggle
  that wins over it, persisted to `localStorage`), smooth theme transitions.
- **Semantic structure.** Real `<header>`/`<nav>`/`<main>`/`<footer>`
  landmarks, one `<h1>` per page with a clean `h2` hierarchy under it (checked
  all 4 pages), `lang="en"` set, all logo images have real `alt` text.
- **Motion respect.** `@media (prefers-reduced-motion:reduce){ *{transition:
  none!important; scroll-behavior:auto!important;} }` was already global;
  the new scroll-reveal system (`.reveal`/`.js-reveal`) was built to degrade
  to fully-visible with no JS or with reduced motion — verified this holds.
- **Focus visibility.** A generic `:focus-visible` ring exists site-wide; no
  `outline:none` traps found anywhere in the stylesheet.
- **Color isn't the only signal.** Status badges (`.badge.ok/.warn/.idle`)
  pair color with a text label ("verified"/etc.), satisfying WCAG 1.4.1.
- **Graceful CDN degradation.** The new ECharts donut checks for
  `window.echarts` and silently no-ops if the CDN script hasn't loaded (with
  a short poll, then gives up) — the existing accessible bar-chart below it
  carries every number regardless, so a blocked CDN never loses information.

---

## 4. An honest redundancy I introduced — not fixed, documented instead

**Two different "donut chart" implementations now coexist:** a hand-rolled
pure-CSS `conic-gradient` donut (`.donut`, used for the French QA pass/fail
split — a simple 2-value case) and the new ECharts SVG donut (Engine cost
breakdown — 6 labeled categories with leader lines). I built the second one
today per a direct request for "modern minicharts."

I'm not merging them, and here's the actual reasoning rather than a shrug:
the CSS conic-gradient approach doesn't scale to 6 labeled slices with
external leader-line labels — that needs a real charting layer. Replacing the
simple 2-value French donut with ECharts *for consistency alone* would add
CDN weight to a page that doesn't need it, for a chart simple enough that CSS
already does the job well. My recommendation: **keep both, but document the
rule** — "use the CSS donut for a single 2-way split; use ECharts once a chart
needs ≥3 labeled categories or leader lines" — so the next person adding a
chart doesn't have to rediscover this by reading two different implementations.
That rule is now written down here; it should also go in a future front-end
README if one gets added.

---

## 5. P1 — the real path from 8.5 to 10/10

### 5.1 Markup duplication across the 4 HTML files — FIXED
This was the single biggest remaining issue, and it wasn't hypothetical — it
already caused a live bug this session: `german/index.html`'s
`<script src=".../app.js">` was missing `defer` (copy-paste drift from the
other 3 pages) until it was caught and fixed. Every page repeated ~40
near-identical lines of topbar + mobile-nav markup.

**Fix shipped:** each page now keeps only a placeholder —
`<header id="topbar-root" data-active="german"></header>` — and a new
`renderTopbar()` in `app.js` builds the brand link, nav, search box, GitHub/
theme/hamburger buttons, and the mobile-nav dropdown from a single
`LT.sitePages` list in `data.js`. One page = one line of nav-shell HTML; the
`defer`-attribute class of bug is now structurally impossible, since there's
only one copy of the script tag left, in `app.js` itself (loaded once per
page, but authored once, not four times).

Re-verified after the refactor: headless run on all 4 pages confirms the
generated `href`s are **byte-identical** to the original hand-written ones
(checked programmatically, not eyeballed), the mobile-nav open/close/Escape/
scroll-lock behavior is unchanged, and the theme toggle (now a dynamically
created button) still works. Zero console errors before or after.

### 5.2 Remaining P1/P2 items, roughly in priority order
1. **Search sets an expectation it doesn't meet.** The topbar search
   (`placeholder="Search sections…"`) only filters the *current page's* own
   subnav tabs — it is not a cross-page or full-text search, despite reading
   like one. Either narrow the label ("Filter this page's sections") or, as a
   real improvement, index all 4 pages' section titles client-side (the
   content is small enough that a static JSON index generated at doc-write
   time would be cheap) for genuine cross-page search.
2. **Remove the last dead tokens**: `--sidebar-w`, `--sidebar-bg`,
   `--caption-grey`, and the `.sidebar` selector fragment (§2).
3. **`itemTypes` in `data.js` (German page) is unused dead data** — no
   `data-chart` element ever references it. Either wire it into a real chart
   (a natural fit: a donut/bar breakdown of question-item types) or remove it.
   Its numbers are correct as of this audit (verified against
   `german-a1-questions-all.csv`), so if left in, it's at least not lying.
4. **Consider a real full-text page search** (P2, bigger effort) once the
   corpus/doc set grows further — the current per-page tab filter won't scale
   past a handful of pages.

---

## 6. Verification performed for this audit (so the findings above are trustworthy)

- Computed WCAG relative-luminance contrast ratios directly from the hex/rgba
  values in `styles.css` (not a browser devtool estimate) for 14 color pairs,
  including composited (alpha-blended) backgrounds for tinted badges/notes.
- `grep`-confirmed zero HTML usage before calling any CSS class "dead."
- Headless-browser (Playwright/Chromium) pass on all 4 pages at both desktop
  (1280–1600px) and phone (375px) viewports: zero console/page errors, correct
  nav-link counts, correct subnav population, mobile menu open/close/Escape/
  resize behavior all verified programmatically, not assumed.
- Cross-checked the live production deploy (not just local files) after
  shipping, including response headers and a full page screenshot.

---

*Next audit should re-run the same contrast/grep/headless checks after the P1
de-duplication lands, to confirm no new drift was introduced by whatever
templating approach replaces the current copy-pasted shell.*
