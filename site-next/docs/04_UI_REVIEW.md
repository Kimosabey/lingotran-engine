# 04 — UI Review Framework

> A per-element audit checklist for every frontend surface in `site-next/`. Use this when reviewing an existing screen, before shipping a new one, or when the user asks for a "UI review" / "polish pass."

---

## 1. How to Use This Document

1. Open the target screen in both light and dark mode, at mobile (375px), tablet (768px), and desktop (1440px) — see [08_RESPONSIVE.md](08_RESPONSIVE.md).
2. Walk every element category present on the screen (§3), scoring each against the criteria.
3. Log every finding with: **element → issue → severity → fix**. Don't just say "spacing feels off" — cite the actual value and the token it should be.
4. Roll findings into the severity/scoring system in §2, and into [14_SCORECARD.md](14_SCORECARD.md) if a full scorecard was requested.

---

## 2. Severity Levels

| Level | Definition | Example |
|---|---|---|
| **P0 — Blocking** | Broken, unusable, or actively misleading | Button does nothing on click; a KPI shows the wrong number; layout breaks at a common viewport |
| **P1 — Major** | Works, but clearly unpolished or inconsistent with the system | Off-token color; missing hover/focus state; visible layout shift |
| **P2 — Minor** | Small deviation a careful reviewer would flag | 2px spacing inconsistency; icon stroke-width mismatch; slightly wrong shadow depth |
| **P3 — Nit** | Would improve polish but is genuinely optional | A subtler easing curve; a slightly better icon choice |

**Scoring**: a screen with any P0 is not shippable. A screen with 3+ P1s fails the enterprise bar in `00_MASTER_FRONTEND.md` §9 and needs another pass before being called done.

---

## 3. Element-by-Element Audit Checklist

### 3.1 Buttons (`components/ui/button.tsx`)
- [ ] Correct variant for its semantic role (primary action = `default`, secondary = `outline`/`secondary`, destructive = `destructive`, low-emphasis = `ghost`) — never `default` styling on a low-priority action or vice versa.
- [ ] Hover, focus-visible, active (press), and disabled states all visibly distinct.
- [ ] Icon-only buttons have an `aria-label` and use an `icon`/`icon-sm`/`icon-lg` size variant, never a text-size variant with an icon crammed in.
- [ ] No more than one `default` (highest-emphasis) button visible per view/section — competing primaries confuse hierarchy.

### 3.2 Forms & Inputs (`input.tsx`, `input-group.tsx`, `textarea.tsx`)
- [ ] Every input has a visible, associated `<label>` (not placeholder-as-label).
- [ ] Error state uses `--flag*` tokens and `aria-invalid`, with a specific error message, not a bare red border.
- [ ] Focus ring visible and consistent with the button/link focus treatment (`--ring`).
- [ ] Disabled and read-only states are visually distinct from each other and from the enabled state.

### 3.3 Dropdowns / Command (`command.tsx`, `global-search.tsx`)
- [ ] Open/close has no layout jump; anchor positioning stays correct near viewport edges.
- [ ] Keyboard navigation (arrows, Enter, Escape) fully functional — see [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md).
- [ ] Empty/no-results state exists and is styled, not a blank list.

### 3.4 Dialogs & Drawers (`dialog.tsx`, `sheet.tsx`)
- [ ] Focus moves into the dialog on open and returns to the trigger on close.
- [ ] Scrim (`--scrim`) present, click-outside and Escape both close (unless a destructive confirmation intentionally requires explicit action).
- [ ] Uses `--shadow-lg` / `--r-lg` per the elevation table in [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §6.
- [ ] Scrolling long content inside the dialog doesn't scroll the page behind it.

### 3.5 Cards (`kpi-card.tsx`, `fidelity-card.tsx`, general cards)
- [ ] Consistent padding across all cards of the same type (no card with `p-4` next to a sibling with `p-6`).
- [ ] Consistent radius/shadow per §5–6 of [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md).
- [ ] Hover state (if interactive/clickable) is present; if not interactive, no hover state is faked.
- [ ] `fidelity-card.tsx` specifically: paper-motif tokens used correctly and *only* here/similar fidelity content — not leaking into generic cards.

### 3.6 Tables (`data-table.tsx`)
- [ ] Header row visually distinct (weight/background) from body rows.
- [ ] Row hover state present for scannability on dense data.
- [ ] Numeric columns right-aligned; text columns left-aligned; no column alignment left to default/random.
- [ ] Sort/filter affordances (if present) have clear active-state styling.
- [ ] Horizontal scroll (not layout break) on narrow viewports — see [08_RESPONSIVE.md](08_RESPONSIVE.md).

### 3.7 Charts (`echart.tsx`, `bar-chart.tsx`, `cost-donut.tsx`, `qa-donut.tsx`)
- [ ] Colors pulled from `lib/chart-tokens.ts` mapping — no hardcoded hex in chart option objects.
- [ ] Legible in both themes (axis labels, legend text meet contrast in dark mode too).
- [ ] Legend/labels don't overlap data at any tested viewport.
- [ ] Loading and empty-data states both exist and are styled (not a blank canvas).

### 3.8 Navigation (`header.tsx`, `mobile-nav.tsx`, `section-nav.tsx`, `footer.tsx`)
- [ ] Active route is visibly indicated in nav.
- [ ] `--topbar-h`/`--appbar-h` tokens respected — no ad-hoc header height.
- [ ] Mobile nav (`mobile-nav.tsx`) opens/closes without layout shift, traps focus while open, matches `--z-drawer`.
- [ ] Footer content hierarchy matches header's information architecture (no orphaned/inconsistent links).

### 3.9 Search (`global-search.tsx`)
- [ ] Discoverable (visible affordance, not hidden behind an undocumented shortcut only).
- [ ] Keyboard shortcut (if any) is documented/hinted in the UI itself.
- [ ] Results ranked sensibly; empty state present.

### 3.10 Badges, Chips, Status (`badge.tsx`, `chip.tsx`, `status-badge.tsx`)
- [ ] Status colors map exactly to `--verified*`/`--flag*`/`--amber*` semantics — never a badge whose color doesn't match its meaning.
- [ ] Consistent sizing/padding across all badge instances site-wide.
- [ ] Text within badges meets contrast requirements (use `-strong` text variants over `--amber`/`--verified`/`--flag` base fills — see [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §2).

### 3.11 Avatars, Skeletons, Loading States
- [ ] Skeleton shapes match the real content's shape/size (no generic gray box where a specific card shape is expected) to avoid layout shift on load.
- [ ] Loading states never persist past actual load completion (check for stuck spinners on slow-network simulation).

### 3.12 Empty / Error / Success States
- [ ] Every list/table/chart that *can* be empty has a designed empty state (icon/message/action), not a blank area.
- [ ] Error states explain what happened and, where possible, offer a recovery action — never a bare "Something went wrong."
- [ ] Success states (e.g. after a search, after a filter applies) give clear, non-intrusive feedback.

### 3.13 Spacing, Alignment, Hierarchy
- [ ] All spacing traces to `--sp-*` tokens (see [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §4) — no arbitrary values.
- [ ] Optical alignment checked, not just numeric — e.g. icon + text baselines actually look aligned, not just share a CSS `align-items: center`.
- [ ] One clear visual "loudest" element per screen; everything else recedes proportionally.

### 3.14 Typography, Icons, Images
- [ ] Type scale tokens used consistently (§3 of [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md)); no ad-hoc `text-[17px]`.
- [ ] Icons all Lucide, consistent stroke width, correctly sized to their context (§12 of `03`).
- [ ] Images have explicit dimensions (no CLS), correct `next/image` usage, and meaningful `alt` text (or `alt=""` if purely decorative).

### 3.15 Shadows, Borders, Elevation
- [ ] Elevation matches the hierarchy table in [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §6 — a popover should never sit visually "flatter" than the card it floats above.
- [ ] Border usage consistent — `--border` for default dividers, `--border-strong` reserved for actual emphasis, not applied inconsistently.

### 3.16 Interaction States (cross-cutting)
For **every** interactive element, confirm all of: default, hover, focus-visible, active/pressed, disabled, and (where relevant) selected/loading/error states are each deliberately styled — not "whatever the browser does by default" for any of them.

---

## 4. Visual Consistency Pass (Whole-Site)

After element-level review, zoom out:
- [ ] Do all pages use the same header/footer/nav pattern, or has one page drifted?
- [ ] Is the same "kind" of content (e.g. a stat) always presented with the same component, never re-implemented ad hoc per page?
- [ ] Does dark mode hold the same relative hierarchy as light mode (nothing that "disappears" or inverts wrongly)?
- [ ] Would a screenshot of any two pages, placed side by side, look like the same product?

---

## 5. Premium / Enterprise Polish Signals

These are the tells that separate "functional" from "premium" — check for their presence, not just absence of bugs:
- Consistent optical spacing (not just numerically equal, but *feels* balanced — dense data areas can use tighter spacing than marketing sections deliberately).
- Deliberate, restrained use of the brand color — one clear accent per screen, not brand-violet on every third element.
- Motion that clarifies (see [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md)) rather than motion that's merely present.
- Numbers/data formatted consistently (decimal places, units, thousands separators) across every KPI/table/chart.
- No visible "seams" between hand-built domain components and generated shadcn primitives — they should look like one system.

---

## 6. Reporting Format

```
### [Screen/Component name]
- **P0/P1/P2/P3** — [element]: [what's wrong] → [specific fix, citing the token/file:line]
```

Group by severity, P0 first. End with a one-line verdict: ship / needs another pass / blocked on [X].

---

**Next:** [05_UX_REVIEW.md](05_UX_REVIEW.md) for the journey-level review that sits above this element-level one.
