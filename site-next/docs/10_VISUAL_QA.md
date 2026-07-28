# 10 — Visual QA Handbook

> How to find visual defects in `site-next/` before a user does. Use this whenever verifying a UI change (per [00_MASTER_FRONTEND.md](00_MASTER_FRONTEND.md) §8) or running a dedicated visual QA pass.

---

## 1. Severity Levels

Same scale as [04_UI_REVIEW.md](04_UI_REVIEW.md) §2 (P0 blocking → P3 nit), applied specifically to visual defects:

- **P0**: broken layout, invisible/unreadable content, content that overlaps and hides information.
- **P1**: visible flicker, layout shift, theme inconsistency, clipped/cut-off content.
- **P2**: minor alignment/spacing drift, slightly inconsistent icon rendering.
- **P3**: a marginally-better crop or an optional polish tweak.

---

## 2. Defect Categories & How to Detect Them

### 2.1 Broken Layouts
- **Detect**: render at all required viewports (§2 of [08_RESPONSIVE.md](08_RESPONSIVE.md)). Look for elements outside their container, overlapping siblings, or a grid/flex layout collapsing unexpectedly.
- **Common cause**: a fixed width/height fighting a flexible parent; a missing `min-w-0` on a flex child that needs to truncate (text overflow forcing the flex item wider than intended).

### 2.2 Spacing Issues
- **Detect**: use DevTools' box-model inspector on suspect elements; compare computed `padding`/`margin`/`gap` against the `--sp-*` token table in [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §4.
- **Common cause**: an arbitrary Tailwind value (`p-[13px]`) instead of a token-mapped class; inconsistent gap between sibling instances of the "same" component.

### 2.3 Alignment Problems
- **Detect**: zoom in (DevTools or actual browser zoom) on icon+text pairings, table headers vs. body columns, and multi-line text next to fixed-height elements — misalignment often only shows at 2x-4x zoom, not at a casual glance.
- **Common cause**: `align-items: center` alone doesn't account for different line-heights/optical weight between an icon and adjacent text; needs a small manual nudge or a shared baseline strategy.

### 2.4 Overflow & Clipping
- **Detect**: check every card/badge/table cell with realistic (not lorem-ipsum-short) content — long corpus titles, long book names, long numbers with many digits.
- **Common cause**: missing `truncate`/`text-ellipsis` + `overflow-hidden` + a `min-w-0` ancestor; a fixed-height container with `overflow: hidden` clipping content that grew taller than expected (e.g. after a font-loading swap).

### 2.5 Z-Index Issues
- **Detect**: open every overlay (tooltip, dropdown, dialog, sheet, mobile nav) simultaneously-adjacent to every other overlay type where plausible; confirm stacking order matches [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §8's scale (`--z-appbar` 40 < `--z-topbar` 50 < `--z-scrim` 55 < `--z-drawer` 60 < `--z-tooltip` 70).
- **Common cause**: a new component introducing an arbitrary `z-[999]`/`z-50` instead of using the shared scale — instant tell in this codebase's convention.

### 2.6 Theme Inconsistencies
- **Detect**: toggle `data-theme` between light/dark on every changed screen; look for anything that stays the "wrong" color (e.g. a hardcoded hex that didn't re-theme), any text that becomes low-contrast, any shadow/border that disappears.
- **Common cause**: a raw hex/rgba value used instead of a CSS variable/Tailwind token — always traceable back to [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) tokens which *are* theme-aware; a hardcoded value never is.

### 2.7 Hydration Flickers
- **Detect**: hard-refresh (not client navigation) on every changed page; watch specifically for a flash of wrong theme (should not happen — the pre-hydration script in `app/layout.tsx` prevents this) or a flash of unstyled/mismatched content immediately after paint.
- **Common cause**: reading `window`/`localStorage`/`document` during initial render instead of gating behind `useEffect` (see [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §3 hydration rules); a client component whose first client render doesn't match its SSR output.

### 2.8 Animation Glitches
Full detail in [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md) §7 — jank, layout shift from animation, flicker, inconsistent transitions, animations that never resolve.

### 2.9 Blurry Images
- **Detect**: inspect at actual device pixel ratio (DevTools device toolbar with correct DPR, or a real high-DPI screen). Compare `next/image`'s rendered size against its natural/served size.
- **Common cause**: missing/incorrect `sizes` prop causing the browser to pick an undersized source for a high-DPI display; an upscaled low-resolution source image.

### 2.10 Icon Inconsistencies
- **Detect**: screenshot every icon used on a page at the same zoom level side-by-side; check stroke width, corner style, and visual weight match.
- **Common cause**: mixing a hand-drawn/inline SVG in among Lucide icons (see [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §12 — Lucide only); overriding `stroke-width` on one icon instance without a systemic reason.

### 2.11 Layout Shift (CLS)
- **Detect**: Chrome DevTools' Performance panel → Experience section flags layout shifts; or Lighthouse's CLS score; watch specifically during: font load, image load, skeleton→content swap, async data arriving.
- **Common cause**: images without explicit dimensions; fonts loading without a matched fallback (check `next/font`'s automatic `size-adjust` is doing its job); skeleton shapes that don't match final content dimensions (see [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md) §3.5).

---

## 3. Debugging Steps (General Procedure)

1. **Reproduce** at the specific viewport/theme/state where the defect was reported — visual bugs are frequently state-specific (only in dark mode, only at 768px, only on second render).
2. **Isolate**: use DevTools to toggle the suspect CSS class/property on/off live and confirm the defect tracks it.
3. **Trace to source**: find the file:line responsible (a Tailwind class, an inline style, a CSS variable definition) rather than patching the symptom at the DOM level.
4. **Fix at the token/component level**, not with a one-off override — if the fix is "add `!important`" or a page-specific override class, the real fix is almost always upstream (the component or token itself).
5. **Re-verify** at all originally-required viewports/themes, not just the one where the defect was first seen — a fix can introduce a regression at an adjacent viewport.

---

## 4. Verification Procedures

For any UI change, before calling it done:

1. **Screenshot-compare** (mentally or literally, via the `webapp-testing` skill) the changed area against its pre-change state (or against a sibling component if new) — does anything look different that wasn't intended to?
2. **Cross-theme check**: light and dark, side by side if possible.
3. **Cross-viewport check**: at minimum mobile/tablet/desktop widths per [08_RESPONSIVE.md](08_RESPONSIVE.md).
4. **Console check**: zero errors/warnings in the browser console, zero hydration warnings specifically.
5. **Realistic content check**: verify with actual/realistic data lengths (long titles, edge-case numbers like `100%` or `0%`, empty states), not just the placeholder content used during development.

---

## 5. Visual QA Checklist

- [ ] No broken layout at any required viewport (§2.1).
- [ ] All spacing traces to design tokens (§2.2).
- [ ] Icon/text/column alignment verified at zoom (§2.3).
- [ ] No unintended clipping/overflow with realistic content lengths (§2.4).
- [ ] Overlay stacking matches the z-index scale (§2.5).
- [ ] No hardcoded colors breaking theme consistency (§2.6).
- [ ] No hydration flicker on hard refresh (§2.7).
- [ ] No animation jank/layout-shift/flicker (§2.8, full detail in `06`).
- [ ] Images sharp at high DPI, correctly sized (§2.9).
- [ ] Icons visually consistent (Lucide-only, consistent stroke) (§2.10).
- [ ] CLS verified near-zero via DevTools/Lighthouse (§2.11).
- [ ] Console free of errors/hydration warnings.

---

**Next:** [11_PERFORMANCE.md](11_PERFORMANCE.md) — several defects above (layout shift, hydration) are as much performance concerns as visual ones.
