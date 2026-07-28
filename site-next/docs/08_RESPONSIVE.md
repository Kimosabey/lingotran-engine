# 08 — Responsive Design Standards

> Every screen in `site-next/` must work cleanly from a small phone to an ultra-wide monitor. This document defines breakpoints, fluid behavior, and the required testing viewports.

---

## 1. Breakpoints

Use Tailwind v4's default breakpoint scale (no custom breakpoint config exists or should be added without a strong reason):

| Breakpoint | Min width | Represents |
|---|---|---|
| (base) | 0px | Small phones |
| `sm` | 640px | Large phones / small phones landscape |
| `md` | 768px | Tablets (portrait) |
| `lg` | 1024px | Tablets (landscape) / small laptops |
| `xl` | 1280px | Laptops/desktops |
| `2xl` | 1536px | Large desktops |

`--content-max: 1200px` (from [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §7) caps the main content column — beyond that, center the content and let the background/surface extend, never let text lines stretch to full ultra-wide width (hurts readability — see `--prose-max: 72ch` for long-form text specifically).

**Design mobile-first**: write base (unprefixed) styles for the smallest viewport, then layer `sm:`/`md:`/`lg:`/`xl:` for progressive enhancement — never the reverse (desktop-first with `max-w` overrides), which tends to leave mobile as an afterthought.

---

## 2. Required Testing Viewports

Every UI change must be checked at, minimum:

| Width | Represents | Priority |
|---|---|---|
| 320px | Smallest common phone (iPhone SE class) | Must not break |
| 375px | Standard phone (iPhone) | Primary mobile target |
| 768px | iPad portrait / small tablet | Must not break |
| 1024px | iPad landscape / small laptop | Must not break |
| 1440px | Standard desktop | Primary desktop target |
| 1920px | Full HD desktop | Must not break |
| 2560px | Ultra-wide / high-res desktop | Must not break, content stays capped at `--content-max` |

Use the `webapp-testing` skill's Playwright tooling (or browser DevTools device toolbar) to actually render at each, not just resize-and-glance — check for the specific failure modes in §7.

---

## 3. Fluid Layouts

- Prefer CSS Grid/Flexbox with `fr`/`minmax()`/`gap` (mapped to `--sp-*` tokens) over fixed pixel widths for anything that should reflow — e.g. KPI card grids should be `grid-cols-1` on mobile → `grid-cols-3`/`grid-cols-4` at `lg`, not a fixed-width card that overflows on mobile.
- Use `clamp()` for anything that should scale continuously rather than jump at breakpoints — this is already the pattern for display typography (`--display-sm/md/lg`, see [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §3.2); apply the same logic to hero spacing/sizing where a jump would look abrupt.
- Avoid fixed `height` on any container whose content can vary in length across viewports/locales — use `min-height` instead, or let it size to content.

---

## 4. Container Queries

Tailwind v4 supports container queries natively (`@container`, `@sm:`, etc.). Prefer a **container query** over a viewport breakpoint when a component's layout should respond to *its own* available space rather than the full viewport — e.g. a `kpi-card` that might render in a 3-column grid on one page and a 2-column sidebar on another should adapt to its container's width, not assume it always spans a viewport-width-derived column. Reserve viewport breakpoints (`md:`, `lg:`) for page-level layout decisions (nav collapse, overall grid column count).

---

## 5. Responsive Typography

Display headings use the `clamp()`-based tokens (§3.2 of [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md)) — no separate mobile/desktop heading classes to keep in sync. Body/UI text (`--text-*` fixed-px tokens) generally does **not** need to scale with viewport — 15–16px body text is correct at every width; don't shrink body text on mobile for the sake of "fitting more," which harms legibility exactly where thumb-scrolling reading happens most.

## 6. Responsive Spacing

- Layout-level spacing (section padding, page margins) steps down at breakpoints rather than scaling fluidly — e.g. a hero section using `--sp-24` (96px) vertical padding on desktop should step to `--sp-14`/`--sp-16` on mobile (`py-14 lg:py-24`), not fluidly interpolate — spacing reads better as a small number of deliberate steps (see [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §11).
- Component-internal spacing (card padding, gap between icon/label) generally stays constant across breakpoints — it's already small enough that it doesn't need to adapt.

## 7. Common Responsive Defects to Check For

| Defect | How to catch it |
|---|---|
| Horizontal scroll/overflow at any tested width | Check for a horizontal scrollbar at 320px and 375px specifically — the most common width for this to appear |
| Text/button overlap | Long corpus/book titles, long badge labels — test with realistic (not lorem-ipsum-short) content lengths |
| Fixed-width elements breaking layout | Any `w-[Npx]` on a component that also needs to fit a narrow viewport |
| Table unusable on mobile | `data-table.tsx` must scroll horizontally within its own container (`overflow-x-auto` on a wrapper), never break the page's own horizontal scroll |
| Nav overflow | `header.tsx` nav items must collapse into `mobile-nav.tsx` before they'd wrap or overflow — verify the exact breakpoint where this handoff happens has no gap (no width where neither the full nav nor the mobile toggle displays correctly) |
| Chart illegibility | ECharts labels/legends must reflow or truncate gracefully below ~400px chart width, not overlap |
| Touch target shrinkage | Icon buttons/links that are comfortable at desktop mouse-precision but too small once actually measured on a real mobile viewport |

---

## 8. Touch Targets

- Minimum **24×24px** hit area (WCAG 2.2 AA, see [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md) §6), **44×44px recommended** for primary actions on touch devices.
- Adjacent interactive elements (icon groups in `header.tsx`, table row actions) need adequate gap so touch doesn't cause mis-taps — don't rely on padding alone if the visual icon is small; the tappable area can extend beyond the visible icon via padding on the button element itself.
- Hover-only affordances (a "reveal on hover" action) must have a touch-equivalent (always visible on touch, or revealed on tap) — hover has no equivalent on touchscreens.

## 9. Orientation Changes

- Layouts must not break when a tablet/phone rotates portrait ↔ landscape mid-session — verify state (open dialogs, scroll position, mobile nav) survives the resize without visual corruption.
- Avoid `100vh` for full-height layouts on mobile (mobile browser chrome resizes the viewport on scroll, causing `vh`-based layouts to jump) — prefer `100dvh` (dynamic viewport height) where full-viewport height is genuinely needed.

## 10. Responsive Navigation

- `header.tsx` (full nav) ↔ `mobile-nav.tsx` (collapsed/drawer nav) handoff happens at a single, deliberate breakpoint — not different breakpoints for different nav items.
- Mobile nav drawer follows the motion/z-index rules in [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md) and [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §8 (`--z-drawer`).

## 11. Responsive Tables

`data-table.tsx` on narrow viewports: prefer horizontal scroll (with a clear affordance that more columns exist — e.g. a subtle edge fade/shadow) over silently hiding columns, unless specific columns are genuinely non-essential on mobile (then hide deliberately with `hidden md:table-cell`, not by accident of overflow).

## 12. Responsive Forms

Inputs/selects should be full-width on mobile (`w-full`) and constrained to a sensible max-width on desktop (don't let a single search input stretch to 2560px wide) — pair with `--content-max`/`--prose-max` logic in [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §7.

## 13. High-DPI Displays

- All raster images served via `next/image` with appropriate `sizes` so 2x/3x DPI screens get a sharp, correctly-sized asset rather than an upscaled low-res one or an oversized wasteful one.
- Prefer SVG (icons via Lucide, brand marks) wherever possible — inherently resolution-independent, avoids the DPI problem entirely.
- Verify no blurriness on a real high-DPI display or via DevTools' device pixel ratio emulation, especially for `fidelity-card.tsx`'s scanned-page imagery.

---

## 14. Responsive Testing Requirements (Checklist)

For any layout/UI change:

- [ ] Rendered and checked at 320px, 375px, 768px, 1024px, 1440px, 1920px, 2560px (§2).
- [ ] No horizontal overflow at any tested width.
- [ ] Nav correctly hands off between full/mobile forms at its breakpoint, no gap width where neither works.
- [ ] Tables scroll (don't break page layout) on narrow viewports.
- [ ] Touch targets meet minimum size on mobile/tablet.
- [ ] Tested with realistic (not placeholder-short) content lengths for titles/labels/badges.
- [ ] Both orientations checked on at least one tablet-width viewport if the change affects layout significantly.
- [ ] Both light and dark mode checked at at least the primary mobile and desktop widths (per [00_MASTER_FRONTEND.md](00_MASTER_FRONTEND.md) §8).

---

**Next:** [09_COMPONENT_STANDARDS.md](09_COMPONENT_STANDARDS.md) for the component-level API rules that make responsive/accessible/themed behavior easy to get right by construction.
