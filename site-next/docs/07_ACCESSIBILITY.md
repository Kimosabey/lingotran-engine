# 07 — Accessibility Handbook (WCAG 2.2 AA/AAA)

> Complete accessibility standard for `site-next/`. **AA is the floor for everything shipped. AAA where achievable without UX compromise.** This codebase already ships a skip link (`app/layout.tsx`) and focus-visible rings (`button.tsx`) — every new surface must meet or exceed that baseline.

---

## 1. Semantic HTML First

- Use the native element before reaching for ARIA: `<button>` for actions, `<a href>` for navigation, `<nav>`/`<main>`/`<header>`/`<footer>`/`<section>` for landmarks, real `<table>`/`<thead>`/`<tbody>`/`<th scope>` for tabular data (`data-table.tsx`).
- Base UI primitives (`@base-ui/react`) already provide correct semantics/ARIA wiring for `Button`, `Dialog`, `Tooltip`, etc. — don't override or strip their built-in `role`/`aria-*` attributes when composing them.
- Heading levels (`h1`–`h6`) must nest logically per page — one `h1` per page, no skipped levels for visual-size reasons (use type-scale tokens for size, heading level for structure — these are independent).

## 2. ARIA — Use Sparingly, Correctly

- "No ARIA is better than bad ARIA." Only add `role`/`aria-*` when semantic HTML + the Base UI primitive's defaults don't already cover it.
- Every icon-only interactive element (icon buttons in `header.tsx`, `mobile-nav.tsx`, `theme-toggle.tsx`) needs `aria-label` — already correctly done in `theme-toggle.tsx` ("Toggle light or dark theme"); match this pattern for every new icon-only control.
- Live regions (`aria-live="polite"`) for content that updates without user-initiated navigation — e.g. search result counts, async-loaded KPI updates — so screen reader users aren't left unaware of a change.
- `aria-expanded`, `aria-controls`, `aria-haspopup` on any disclosure trigger (nav dropdowns, command palette trigger, mobile nav toggle) — `button.tsx` already has `aria-expanded` styling hooks (`aria-expanded:bg-muted`); wire the actual attribute, not just the CSS selector.

## 3. Keyboard Navigation

**Every interactive element must be operable with keyboard alone — no exceptions.**

- [ ] Tab order follows visual/logical reading order.
- [ ] `Enter`/`Space` activate buttons; `Enter` submits forms; `Escape` closes dialogs/sheets/dropdowns/command palette.
- [ ] Arrow keys navigate within composite widgets (command palette results, tab lists, menus) per the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) patterns — Base UI's `Command`/`Dialog`/`Tooltip` primitives implement this; verify it after any customization, don't assume it survives styling changes.
- [ ] No keyboard trap — a user must always be able to Tab or Escape out of any component.
- [ ] Skip link (`app/layout.tsx` — "Skip to content") must remain the first focusable element on every page and must actually move focus to `#main`.
- [ ] Global search/command palette keyboard shortcut (if bound, e.g. `Cmd/Ctrl+K`) must not conflict with browser/OS/screen-reader shortcuts, and must be documented in the UI (see [05_UX_REVIEW.md](05_UX_REVIEW.md) §6).

## 4. Focus Management

- **Focus-visible, always.** `button.tsx`'s `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` is the reference pattern — every new interactive primitive needs an equivalent, visible-but-not-obtrusive focus ring using the `--ring` token.
- **Never suppress the focus outline** (`outline: none` without a replacement) anywhere in the codebase.
- **Dialogs/Sheets**: focus moves to the panel (or its first focusable element/heading) on open, is trapped within the panel while open, and **returns to the triggering element** on close. Verify this explicitly for `dialog.tsx` and `sheet.tsx` consumers — a Base UI primitive provides the mechanism, but a custom trigger/content composition can still break the return-focus behavior.
- **Route changes**: on client-side navigation, focus should move to the new page's main heading or `#main` so screen reader/keyboard users aren't left focused on a now-stale nav item.

## 5. Screen Readers

- Test with at least one real screen reader (NVDA on Windows, VoiceOver on Mac) for any new complex interactive component (search, command palette, charts) — automated tools (axe, Lighthouse) catch maybe half of real screen-reader issues.
- Decorative elements (`hero-glyphs.tsx`, purely visual icons already paired with adjacent text) get `aria-hidden="true"` so they don't add noise to the accessibility tree.
- Chart components (`echart.tsx` wrappers) need a **text alternative** — a visually-hidden summary (`sr-only`) or an adjacent data table/description — since canvas-rendered charts are invisible to screen readers by default. Never ship a chart as the *only* way to access its data.

## 6. Touch Targets

- Minimum **24×24px** (WCAG 2.2 SC 2.5.8, AA) for any target, minimum **44×44px** recommended for primary mobile actions (matches `button.tsx`'s `size="lg"`/`h-9` needing care on touch — verify actual rendered size, not just the class name, meets this on real mobile viewports). See [08_RESPONSIVE.md](08_RESPONSIVE.md) §"Touch Targets" for full detail.
- Adequate spacing between adjacent touch targets (icon button groups in `header.tsx`) so mis-taps are unlikely — don't rely on target size alone.

## 7. Color Contrast

All ratios below are already computed into the token set in [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §2 — **use the `-strong` variant tokens for text, never the base decorative token:**

| Use | Correct token | Ratio |
|---|---|---|
| Verified text on surface | `--verified-strong` | 5.0:1 (AA) |
| Flag/error text on surface | `--flag-strong` | 5.0:1 (AA) |
| Amber text on surface | `--amber-strong` | 6.1:1 (AA) — **never** `--amber` for text (3.4:1, fails) |
| Muted body text | `--text-muted` | 6.7:1 |
| Subtle/small text | `--text-subtle` | 4.6:1 — fine for small text, don't go quieter |

- [ ] Every new text/background pairing checked against WCAG AA (4.5:1 normal text, 3:1 large text ≥24px/19px-bold, 3:1 UI component boundaries/graphics).
- [ ] Never convey status/meaning by color alone (§9 below) — pair `--flag`/`--verified`/`--amber` with an icon or label too.
- [ ] Re-check contrast in **both themes independently** — a pairing that passes in light mode is not guaranteed to pass in dark mode even with "equivalent" tokens, since dark-mode values are re-tuned, not simply inverted (see [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §2.7).

## 8. Reduced Motion

Full detail in [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md) §5 — global `prefers-reduced-motion: reduce` override is mandatory, verified by actually toggling the OS setting.

## 9. Don't Rely on Color Alone

Status badges (`status-badge.tsx`), fidelity indicators (`fidelity-card.tsx`), and chart series must each carry a **second signal** beyond color — an icon (check/flag/warning), a text label, or a distinct shape/pattern — for color-blind users (~8% of men) and screen-reader users (who get none of the color signal at all).

## 10. Accessible Forms

- Every `<input>`/`<textarea>` has a programmatically associated `<label>` (`htmlFor`/`id`, not just visual proximity).
- Required fields marked with `aria-required`/`required`, not visual asterisk alone.
- Validation errors: `aria-invalid="true"` on the field, `aria-describedby` pointing to the specific error message text, and the error message itself must be programmatically associated — not just colored red text nearby.
- Error summary (for forms with multiple fields) should be announced and allow jumping to each error field, if/when a form of that complexity is built.

## 11. Accessible Dialogs

Covered in §4 (focus) — additionally: `Dialog`'s accessible name comes from its heading (`aria-labelledby`) and, if present, a description (`aria-describedby`) — verify Base UI's `Dialog` wiring survives whatever custom title/description composition is used in `dialog.tsx` consumers.

## 12. Accessible Tables

- Real `<table>` markup (not `<div>` grids styled to look like a table) for `data-table.tsx`.
- `<th scope="col">`/`<th scope="row">` as appropriate; a `<caption>` (can be visually hidden) describing the table's content for screen reader users who tab into it out of context.
- Sortable columns: sort state communicated via `aria-sort` on the `<th>`, not just a visual arrow icon.

## 13. Accessible Charts

See §5 — text alternative required. Additionally: don't encode the *only* copy of a critical number (e.g. the headline fidelity %) exclusively inside a canvas chart; restate it as real text somewhere on the page.

## 14. Images & Alt Text

- Meaningful images: descriptive `alt` text describing content/purpose, not filename or "image of...".
- Decorative images (including background/motif graphics): `alt=""` (empty, not omitted) so screen readers skip them cleanly.
- Complex images (a diagram of the engine's architecture, if used on `/engine`): alt text summarizes the point; full detail lives in adjacent real text/table, not crammed into the alt attribute.

## 15. Skip Links & Landmarks

- The existing skip link in `app/layout.tsx` (`Skip to content` → `#main`) must be preserved on every page — confirm `#main` actually exists and wraps the primary content on every route added.
- One `<main>` per page. `<nav>` for `header.tsx`/`mobile-nav.tsx`/`section-nav.tsx`; `<header>`/`<footer>` for their respective components — landmarks let screen reader users jump directly to a region instead of tabbing through everything.

## 16. Error Messaging & Validation

Errors must be: specific ("Corpus slug not found" beats "Error"), programmatically associated with their field/context (§10), and — where the error is page-level (404 on `/french/[slug]`) — announced via a heading/landmark a screen reader user would land on naturally, not buried mid-page.

---

## 17. Accessibility Testing — Automated Verification

Run these for any new/changed interactive surface, in this order:

1. **`accesslint-scan` skill** — live-DOM WCAG audit via CDP against the running dev server; grounds each violation to a DOM selector and source file:line. Use this first for anything beyond a trivial change.
2. **`accesslint-diff` skill** — when checking whether a change introduced *new* violations versus a baseline/branch, rather than a full fresh scan.
3. **Manual keyboard pass** — unplug the mouse, mentally: Tab through the entire changed surface, operate every control, confirm nothing is unreachable or untriggerable.
4. **Manual screen reader spot-check** — for new complex components (search, charts, command palette) — see §5.
5. **Contrast check** — verify any new color pairing against §7's table in both themes.

**A change is not "accessible" because it passed lint/TypeScript.** None of those check any of the above. State explicitly in your report which of the four layers above you ran, and which you couldn't (e.g. "no screen reader available in this environment — flagging for manual verification").

---

## 18. Accessibility Checklist (Pre-Ship)

- [ ] Semantic HTML used before any ARIA (§1).
- [ ] All interactive elements keyboard-operable, no traps (§3).
- [ ] Focus-visible on every interactive element; focus returns correctly after dialogs/sheets close (§4).
- [ ] Screen-reader tested (or explicitly flagged as not tested) for new complex components (§5).
- [ ] Touch targets ≥24×24px minimum (§6).
- [ ] Color contrast verified in both themes using `-strong` text tokens (§7).
- [ ] Status/meaning never conveyed by color alone (§9).
- [ ] Forms: labels, required state, and errors all programmatically associated (§10).
- [ ] Reduced motion respected (§8, full detail in [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md)).
- [ ] Automated scan run (`accesslint-scan`/`accesslint-diff`) and findings resolved or explicitly triaged.

---

**Next:** [08_RESPONSIVE.md](08_RESPONSIVE.md) for touch-target sizing in full device context.
