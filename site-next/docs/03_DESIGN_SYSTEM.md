# 03 — Design System ("Manifest")

> The single source of truth for every color, font, spacing, radius, shadow, and elevation value used in `site-next/`. All tokens live in [`app/globals.css`](../app/globals.css). **If a value isn't here, don't invent it — extend this file first.**

---

## 1. Design Language

**Name:** Manifest — deep-violet authority, emerald "verified" signal, a confined textbook/paper motif reserved for fidelity content. Light is the default theme; dark is a fully-specified mirror, not a filter.

**Benchmark comparison** — this system should read at the level of:

| Reference | What we borrow from them |
|---|---|
| **Stripe** | Dense data (KPIs, tables, charts) presented with generous whitespace and restrained color — data density without visual noise. |
| **Linear** | Motion restraint, keyboard-first affordances (see `cmdk`/`global-search.tsx`), a single confident accent color used sparingly. |
| **Vercel** | Typographic contrast between a display face and a quiet UI face; near-black/near-white dark mode done as a real palette, not `#000`/`#fff` inverted. |
| **Apple (HIG)** | Spacing discipline — the 4px-based scale below is non-negotiable; nothing "eyeballs" a gap. |
| **Figma** | Component consistency — one `Button`, one `Badge`, one `Dialog`, reused everywhere, never re-invented per page. |

If a screen doesn't hold up next to these, it's not done — see [04_UI_REVIEW.md](04_UI_REVIEW.md) for the audit framework.

---

## 2. Color Tokens

All colors are CSS custom properties on `:root`, re-themed under `:root[data-theme="dark"]` (and mirrored under `@media (prefers-color-scheme: dark)` for users who haven't explicitly toggled). **Always consume via the Tailwind utility mapping in `@theme inline`** (e.g. `bg-brand-700`, `text-verified`, `border-flag`) or the shadcn semantic utilities (`bg-primary`, `text-muted-foreground`) — never a raw hex value in a component.

### 2.1 Brand (violet) — the anchor; logos are this color

| Token | Light | Usage |
|---|---|---|
| `--brand-900` | `#2c0a63` | Deepest — hover-on-hover states, dark accents |
| `--brand-700` | `#41009a` | **Primary** — `--primary`, `--accent`, `--link` |
| `--brand-600` | `#5a18c2` | Secondary emphasis |
| `--brand-500` | `#7c4dff` | Interactive violet — `--ring`, chart series 1 |
| `--brand-300` | `#b79cff` | Dark-mode accent/link/ring; chart series 5 |
| `--brand-100` | `#ede6ff` | Tinted surface — `--accent-soft`, shadcn `--accent` |

### 2.2 Verified (emerald) — the emotional core: `ok: true`, zero data loss

| Token | Light | Contrast note |
|---|---|---|
| `--verified` | `#0e9f6e` | Fills, dots, donut slice — decorative, not for small text |
| `--verified-strong` | `#0a7d57` | **AA-safe text on white, 5.0:1** — use for any text-on-surface verified state |
| `--verified-soft` | `#e4f5ee` | Tinted surface background |

### 2.3 Flag (rose) — QA-fail / needs attention, used sparingly

| Token | Light | Contrast note |
|---|---|---|
| `--flag` | `#e11d48` | Fills, dots — decorative |
| `--flag-strong` | `#be123c` | **AA-safe text on white, 5.0:1** |
| `--flag-soft` | `#fce7ec` | Tinted surface background |

### 2.4 Amber — info/neutral chart accent

| Token | Light | Contrast note |
|---|---|---|
| `--amber` | `#c77a0a` | **Decorative only — 3.4:1 on white, fails AA text.** Never use for text. |
| `--amber-strong` | `#8f5400` | **AA-safe text variant, 6.1:1** — use this one for any amber text |
| `--amber-soft` | `#fbf0dc` | Tinted surface background |

### 2.5 Paper — confined to the fidelity/scan/textbook motif ONLY

`--paper #f4eee1`, `--paper-2 #ebe2cf`, `--paper-line #dccfb4`, `--paper-ink #4a4230`. This is a deliberately narrow-scope token group — it exists to make scanned-textbook/fidelity content feel tactile and archival. **Never use paper tokens for general UI surfaces** (cards, nav, dialogs) — that's what `--surface*` is for. Using paper tokens outside the fidelity motif is a design-system violation to flag on sight.

### 2.6 Ink & Neutral Ramp

`--ink #14101e` → `--slate-900` … `--slate-50 #f8f8fc` → `--white`. This ramp backs the semantic surface/text tokens below; components should reference the semantic layer, not the raw ramp, except when building a new semantic token.

### 2.7 Semantic Surfaces (theme-aware — values differ light vs. dark, name never changes)

| Token | Role |
|---|---|
| `--bg` | Page background |
| `--surface` | Card/panel background |
| `--surface-2` | Secondary surface (nested panels, muted backgrounds) |
| `--surface-3` | Tertiary surface (deepest nesting) |
| `--surface-inset` | Inset/recessed areas (code blocks, wells) |
| `--border` / `--border-strong` / `--border-faint` | Default / emphasized / barely-there dividers |
| `--text` | Primary text (= `--ink` in light) |
| `--text-muted` | Secondary text — **6.7:1 on `--surface`** |
| `--text-subtle` | Tertiary text — **4.6:1, small text OK, don't go quieter than this for body copy** |
| `--text-onbrand` | Text on filled brand backgrounds |
| `--accent` / `--accent-hover` / `--accent-soft` | Interactive accent + states |
| `--link` | Link color (same as `--accent` by design) |
| `--ring` | Focus ring color |

**Dark mode is not "invert everything."** Note specific deliberate divergences: `--verified-strong` becomes `#34d399` (brighter, since dark backgrounds need more luminance for the same perceived weight), `--paper` inverts to a warm dark brown (`#26210f`) rather than going cool-gray, preserving the "archival paper" feeling instead of breaking the metaphor.

### 2.8 Code Tokens

`--code-bg #160c2b` (near-black violet, not pure black), `--code-text #ede7ff`, `--code-cmt #9b8ac9`, `--code-kw #c4a6ff`, `--code-str #8de9c4` — used by `components/code-block.tsx`. Code blocks keep a **dark background in both themes** — this is intentional (a code/terminal surface reads as code regardless of site theme, matching every serious dev-tool product).

### 2.9 Chart Tokens

`--chart-track #ecebf6` (unfilled donut/track color), plus gradients: `--grad-brand`, `--grad-brand-90`, `--grad-verified`. `--scrim` (modal/drawer backdrop) and `--glow-brand` (brand-colored elevation glow for hero/CTA emphasis) round out the set. shadcn chart slots `--chart-1..5` map to `brand-500 / verified / flag / amber / brand-300` respectively — see `lib/chart-tokens.ts` for the ECharts-side mirror of this mapping. **Any new chart must pull colors from this mapping, never hardcode a hex value in chart config.**

---

## 3. Typography

### 3.1 Font Families — Selection Philosophy (Google Fonts only)

Every font on this project loads via **`next/font/google`** — never a `<link>` tag, never a self-hosted static file, never a system-font stack for anything user-facing above body text. Three-family system, each with a distinct job:

| Role | Family | CSS variable | Why this one, specifically |
|---|---|---|---|
| **Display / headings** | **Fraunces** (variable, `axes: ["opsz"]`) | `--font-display` | A high-contrast, warm optical-size serif with real editorial character — it signals "textbook / system of record" without looking like a template default. This is the brand's personality carrier. |
| **Body / UI** | **Inter** | `--font-sans` | Quiet, highly legible, huge glyph coverage, excellent at small sizes for dense UI (tables, KPI labels) — deliberately *not* trying to be interesting, so it doesn't compete with Fraunces. |
| **Code / data / mono content** | **IBM Plex Mono** (weights 400/500/600) | `--font-mono` | Legible at small sizes, distinct zero/one/l/I disambiguation, and — like Fraunces — has enough character to avoid the generic `ui-monospace` fallback look in code blocks. |

**The rule this table exists to enforce:** a font pairing must be *chosen*, never defaulted. Concretely:

- [ ] The display family is **not** the same family as the body family (no "Inter everywhere").
- [ ] The display family is **not** a generic-safe choice (Roboto, Open Sans, Lato, system-ui) — it should be recognizable as a deliberate pick when you look at a heading in isolation.
- [ ] The body family stays quiet/workhorse-grade — legibility at small sizes beats personality here.
- [ ] Every family is loaded through `next/font/google` as a variable font where one exists (better performance, fewer requests — see [11_PERFORMANCE.md](11_PERFORMANCE.md)).
- [ ] No fourth family gets added without a specific, stated reason.
- [ ] If a rebrand or new section ever calls for a different pairing, apply this same test to the replacement — don't relax the bar "just this once."

Fonts attach as CSS variables on `<html>` in `app/layout.tsx` and resolve through `--font-display-family`, `--font-sans-family`, `--font-mono-family` in `globals.css`, each with a sane system-font fallback chain for the brief pre-load window.

### 3.2 Type Scale

| Token | Size | Use |
|---|---|---|
| `--text-2xs` | 11px | Micro-labels, badge text |
| `--text-xs` | 12px | Captions, meta |
| `--text-sm` | 13px | Secondary UI text |
| `--text-smd` | 14px | Dense table/UI text |
| `--text-base` | 15px | **Default body** |
| `--text-md` | 16px | Comfortable body/reading |
| `--text-lg` | 18px | Small headings, lead paragraphs |
| `--text-xl` | 20px | Section headings |
| `--text-2xl` | 24px | Page-section headings |
| `--display-sm` | `clamp(26px, 3vw, 34px)` | Fluid small display heading |
| `--display-md` | `clamp(32px, 4.4vw, 46px)` | Fluid medium display heading |
| `--display-lg` | `clamp(38px, 6vw, 62px)` | Fluid hero display heading |

Display sizes use `clamp()` deliberately — **fluid type, not breakpoint-jumping type.** Never hardcode a `text-[38px]` for a hero; use the display tokens so headline size scales continuously with viewport (see [08_RESPONSIVE.md](08_RESPONSIVE.md)).

### 3.3 Line Height & Letter Spacing

`--lh-tight 1.12` (display headings), `--lh-snug 1.3` (subheadings), `--lh-normal 1.6` (body), `--lh-relaxed 1.7` (long-form reading). `--ls-tight -0.02em` (large display type needs negative tracking), `--ls-snug -0.01em`, `--ls-wide 0.02em` (small caps-adjacent labels), `--ls-caps 0.08em` (true uppercase labels/eyebrows).

Rule: **the larger the type, the tighter the tracking and leading**; the smaller/denser the type (table cells, badges), the more generous the tracking needs to be for legibility. Never apply `--ls-caps` to non-uppercase text.

---

## 4. Spacing System (4px base / 8-point-aligned)

```
--sp-1: 4px   --sp-5: 20px   --sp-12: 48px
--sp-2: 8px   --sp-6: 24px   --sp-14: 56px
--sp-3: 12px  --sp-7: 28px   --sp-16: 64px
--sp-4: 16px  --sp-8: 32px   --sp-20: 80px
              --sp-10: 40px  --sp-24: 96px
```

- Every margin, padding, and gap value must map to one of these (via Tailwind's spacing scale, which is aligned to the same 4px base — `gap-4` = 16px = `--sp-4`). **No arbitrary spacing values** (`p-[13px]`, `mt-[22px]`) except for a documented optical correction (rare, and commented as such).
- Component-internal spacing (padding inside a card, gap between icon and label) should favor the smaller end (`--sp-1` to `--sp-4`); layout-level spacing (section gaps, page margins) favors the larger end (`--sp-8` and up).

---

## 5. Radius

`--r-xs 6px` (chips, small badges) · `--r-sm 8px` (inputs, buttons) · `--r-md 12px` (cards — also shadcn's `--radius` default) · `--r-lg 16px` (panels, dialogs) · `--r-xl 20px` (large feature cards) · `--r-2xl 28px` (hero containers) · `--r-pill 999px` (pills, avatars, fully-rounded badges).

Rule: **radius scales with element size.** A 32px icon button and a 400px feature card should never share the same radius token — bigger surface, bigger (or fully pill) radius, following the table above top-to-bottom as size increases.

---

## 6. Shadows & Elevation

| Token | Light | Use |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(20,16,30,.05)` | Barely-there separation (inputs, chips) |
| `--shadow-sm` | `0 2px 8px rgba(20,16,30,.06)` | Cards at rest |
| `--shadow-md` | `0 10px 28px -8px rgba(20,16,30,.12)` | Hover/raised state, dropdowns |
| `--shadow-lg` | `0 24px 56px -16px rgba(20,16,30,.18)` | Dialogs, sheets, top-level overlays |
| `--glow-brand` | `0 24px 60px -20px rgba(65,0,154,.45)` | Brand-colored emphasis glow (hero CTA, featured card) — use sparingly, at most one per screen |

Dark mode shadows are **not** the same values at lower opacity — they're re-tuned to pure-black-based shadows with higher opacity (`rgba(0,0,0,.4-.65)`) because colored shadows read as muddy on dark surfaces. Elevation in dark mode should be reinforced with a subtle border (`--border-strong`) in addition to shadow, since shadows alone are less perceptible on dark backgrounds.

**Elevation hierarchy (low → high):** flat content → `--shadow-xs` (input/chip) → `--shadow-sm` (resting card) → `--shadow-md` (hover/menu/popover) → `--shadow-lg` (dialog/sheet/drawer) → scrim (`--scrim`) sits beneath dialogs/drawers, above everything else.

---

## 7. Layout Tokens

`--topbar-h: 60px` (main header height) · `--appbar-h: 48px` (secondary/section nav bar) · `--content-max: 1200px` (max content width) · `--prose-max: 72ch` (max line length for long-form reading — never let body copy exceed this, per classic readability guidance).

## 8. Z-Index Scale

`--z-appbar: 40` < `--z-topbar: 50` < `--z-scrim: 55` < `--z-drawer: 60` < `--z-tooltip: 70`. **Never introduce an arbitrary z-index outside this scale.** If a new layer is needed, insert it into this scale in `globals.css` with a name, don't drop a raw `z-[999]` into a component.

## 9. Motion Tokens

`--ease-out: cubic-bezier(0.2,0.7,0.2,1)` (default UI easing) · `--ease-spring: cubic-bezier(0.22,1,0.36,1)` (playful/emphasis motion) · `--dur-1: .12s` (micro, e.g. hover) → `--dur-4: .55s` (large surface, e.g. drawer). Full motion guidance in [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md).

---

## 10. Light Mode / Dark Mode / High-Contrast

- **Light is default**, dark is `:root[data-theme="dark"]` (explicit) or `@media (prefers-color-scheme: dark)` (system, when no explicit choice stored) — see the mechanism described in [01_PROJECT_CONTEXT.md](01_PROJECT_CONTEXT.md) §3. Never hardcode `dark:` Tailwind variants that bypass this — they're already repointed to the attribute selector globally.
- **Every new token added to `:root` must get a corresponding dark-mode value** in both the `@media` block and the `[data-theme="dark"]` block (they must stay in sync — this repo currently keeps them as literal duplicates; if you add a token, add it in both places or explicitly note why it's theme-invariant, like the paper/border-radius/spacing tokens are).
- **High-contrast / `prefers-contrast: more`**: not yet separately implemented. When asked to add it, prefer bumping `--border`/`--border-strong` opacity and `--text-muted`/`--text-subtle` toward `--text` rather than introducing a third full token set — see [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md).

## 11. Responsive Typography & Spacing

Display headings use `clamp()` tokens (§3.2) so they scale continuously — no separate mobile/desktop heading sizes to keep in sync. Section/layout spacing should reduce by one step (e.g. `--sp-16` desktop → `--sp-10` mobile) at the `md` breakpoint rather than scaling fluidly — spacing reads better as a small number of deliberate steps; type reads better fluid. Full breakpoint detail in [08_RESPONSIVE.md](08_RESPONSIVE.md).

## 12. Iconography

- **Lucide only** (`lucide-react`, wrapped by `components/icon.tsx`) — one icon set, one visual language (consistent stroke width, corner radius). Never mix in a second icon library or inline hand-drawn SVGs for something Lucide already has.
- Default stroke width and sizing come from the `Icon` wrapper — don't override stroke-width per-instance without a specific reason (visual inconsistency across icons is an instant tell of an unpolished UI).
- Icon sizing follows component size, matching the `size-*` conventions already in `components/ui/button.tsx` (`[&_svg:not([class*='size-'])]:size-4` etc.) — icons scale with their container's size variant, not independently.

## 13. Illustration & Imagery Guidelines

- This is a data/document-fidelity product — imagery should favor **real artifacts** (scanned textbook pages, extracted content previews, corpus screenshots via `fidelity-card.tsx`) over generic stock illustration or abstract gradients-as-hero-art.
- Where decorative graphics are needed (`components/hero-glyphs.tsx`), keep them tied to the brand palette (§2) and the "manifest/verified" motif — not arbitrary decorative color.
- All raster imagery via `next/image`; see [11_PERFORMANCE.md](11_PERFORMANCE.md) for sizing/format rules.

## 14. Logos

Brand violet (`--brand-700`) is anchored specifically because it's the logo color — never adjust the logo's rendered color to match a section's local palette; the logo is the one element that stays constant across every surface and theme (with an appropriate light/dark asset variant, not a CSS filter hack, if a dark variant is needed).

---

## 15. Component Variants — Where They Live

Every variant-bearing primitive uses CVA (§5 of [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md)). Current inventory to check before adding a new variant or a new primitive: `Button` (variant × size), `Badge`, `Dialog`, `Sheet`, `Tooltip`, `Input`, `InputGroup`, `Textarea`, `Command`. Domain-specific "variants" (e.g. `StatusBadge`'s ok/warn/fail states) should still route through the same brand/verified/flag/amber token groups above — a status badge's "fail" state is `--flag*`, full stop, never a new red invented locally.

---

**Next:** [04_UI_REVIEW.md](04_UI_REVIEW.md) to audit a screen against this system, or [09_COMPONENT_STANDARDS.md](09_COMPONENT_STANDARDS.md) when building a new component.
