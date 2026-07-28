# 01 — Project Context

> Read this before making **any** change in `site-next/`. It answers: what is this, what stack is it built on, what is it trying to be, and what must never regress.

---

## 1. What This Project Is

`site-next/` is the **Lingotran Engine** site — a Next.js application that presents the Lingotran document-extraction/translation engine: how it's orchestrated, the layers/roles/agents/models behind it, and the "zero data loss" fidelity guarantee across processed corpora (currently French and German textbook material, e.g. Tricolore).

It currently ships these routes:

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Landing/home |
| `/engine` | `app/engine/page.tsx` | Engine architecture explainer (roles, agents, models) |
| `/french` | `app/french/page.tsx` | French corpus index |
| `/french/[slug]` | `app/french/[slug]/page.tsx` | Individual French corpus/book detail |
| `/german` | `app/german/page.tsx` | German corpus index |
| `/reference` | `app/reference/page.tsx` | Reference/documentation page |

This is a **content-and-data-driven marketing/reference site**, not an authenticated SaaS app — there is no login flow today. Its job is to make the engine's rigor *visible*: fidelity scores, QA pass rates, cost/token metrics, corpus statistics, rendered via KPI cards, donut/bar charts, and data tables.

This site is also **migrating an existing static site** to Next.js (see the git history: "migrate Engine page to the new design system"). Treat existing static-site behavior (theming, tokens, copy) as the source of truth to preserve unless a task explicitly says otherwise — don't "improve" content or behavior that's mid-migration without flagging it.

---

## 2. Stack

| Layer | Choice | Version (pinned in `package.json`) |
|---|---|---|
| Framework | Next.js, App Router | `16.2.12` |
| UI runtime | React | `19.2.4` |
| Language | TypeScript | `^5` (strict mode on) |
| Styling | Tailwind CSS | `^4` (CSS-first config — no `tailwind.config.js`) |
| Component system | shadcn/ui | `^4.15.0`, style `base-nova` (see `components.json`) |
| Primitive layer | Base UI (`@base-ui/react`) | `^1.6.0` — unstyled, accessible primitives under shadcn's styled layer |
| Variant engine | class-variance-authority (CVA) | `^0.7.1` |
| Class utilities | `clsx` + `tailwind-merge` (combined as `cn()` in `lib/utils.ts`) | `^2.1.1` / `^3.6.0` |
| Icons | `lucide-react` | `^1.27.0` |
| Charts | ECharts (`echarts`) | `^6.1.0`, wrapped by `components/echart.tsx` |
| Command palette | `cmdk` (via `components/ui/command.tsx`) | `^1.1.1` |
| Animation utilities | `tw-animate-css` | `^1.4.0` |
| Fonts | `next/font/google`: **Fraunces** (display), **Inter** (sans/body), **IBM Plex Mono** (code) | loaded in `app/layout.tsx` |
| Package manager | pnpm (workspace-aware — see `pnpm-workspace.yaml`) | — |
| Lint | ESLint 9 + `eslint-config-next` | `^9` / `16.2.12` |
| Deployment | Vercel | project `site-next` |

**Do not introduce a competing library for something the stack already solves** — no new icon set, no second CSS-in-JS system, no second chart library, no second class-merging utility. If `03_DESIGN_SYSTEM.md`/`02_FRONTEND_RULES.md` don't cover a need, propose extending what's here before reaching for a new dependency, and confirm with the user before adding any new runtime dependency.

---

## 3. Architecture Summary

```
site-next/
├── app/                  # App Router: routes, layout, global styles
│   ├── layout.tsx        # Root layout: fonts, theme-init script, skip link, TooltipProvider
│   ├── globals.css       # ALL design tokens live here (see 03_DESIGN_SYSTEM.md)
│   ├── page.tsx          # Home
│   ├── engine/           # /engine
│   ├── french/           # /french, /french/[slug]
│   ├── german/            # /german
│   └── reference/        # /reference
├── components/
│   ├── ui/               # shadcn/Base UI primitives (button, dialog, sheet, tooltip, input, command…)
│   ├── charts/            # ECharts wrappers (bar-chart, cost-donut, qa-donut)
│   └── *.tsx              # Domain components (header, footer, kpi-card, meter, fidelity-card,
│                           #   status-badge, chip, corpus-console, data-table, global-search, …)
├── lib/
│   ├── utils.ts           # cn() — clsx + tailwind-merge
│   ├── data.ts             # Site content/data
│   └── chart-tokens.ts     # Chart color/token mapping (mirrors globals.css tokens for ECharts)
└── docs/                   # This operating-system doc set (00–15)
```

**Theming mechanism** (load-bearing — do not "simplify" this): `<html>` carries `data-theme="light"|"dark"`, set by an inline pre-hydration script in `app/layout.tsx` reading `localStorage['lt-theme']` (avoids flash-of-wrong-theme), and toggled at runtime by `components/theme-toggle.tsx`, which also dispatches a `lt:themechange` custom event. Tailwind's `dark:` variant is repointed in `globals.css` via `@custom-variant dark (&:is([data-theme="dark"] *))` so shadcn components (which use `dark:` directly) share this exact mechanism instead of a second `.dark`-class system. **Never** introduce a second theming mechanism (e.g. a class-based one) alongside this.

---

## 4. Project Philosophy

- **The site is proof of the product's rigor, not just a description of it.** Every metric shown (fidelity %, QA pass rate, cost per page) must read as precise and earned — sloppy UI undermines the exact claim the product makes about itself.
- **System-of-record aesthetic.** The existing design system (`03_DESIGN_SYSTEM.md`) is explicitly named "Manifest" in code comments — deep-violet authority, emerald "verified" signal, a confined textbook/paper motif for fidelity content. This is a deliberate brand decision, not a placeholder theme — don't drift from it toward generic SaaS-purple.
- **Content-driven, not app-driven.** Prefer Server Components and static/data-driven rendering over client-side state machines. This is a site people read, not an app people operate.
- **Dark mode is not an afterthought.** It's a fully-specified parallel token set (see `globals.css` lines ~214–324) that must be checked on every visual change.

---

## 5. Constraints

- **No authentication system exists.** Don't design components that assume a logged-in user unless explicitly asked to build that.
- **No design tokens outside `globals.css`.** A component must never define its own color/spacing scale.
- **No CSS-in-JS, no styled-components, no Sass.** Tailwind v4 utility classes (+ the CSS custom properties in `globals.css`) are the only styling mechanism.
- **`components.json` is the shadcn contract** (`style: base-nova`, `baseColor: neutral`, icon library `lucide`, RSC on). Any new shadcn component must be added consistently with this config, not hand-rolled to diverge from it.
- **Content for French/German corpora comes from a separate pipeline** (see the repo root — `french/extracted/`, etc.). The Next.js site consumes/presents this data; it does not own corpus extraction, transcription, or QA logic.
- **Production deploys go through Vercel.** Never touch Vercel project settings, domains, or CI config without explicit user confirmation (see `00_MASTER_FRONTEND.md` §12).

---

## 6. Scalability Expectations

- The route set will grow (more languages beyond French/German are plausible — see project memory on the multi-book rollout). Navigation, layout, and data-fetching patterns must scale to N corpora/languages without a rewrite — don't hardcode "French or German" branching where an N-language pattern costs the same to write.
- Charts and data tables must handle corpus datasets growing in row count without a re-architecture (virtualization is a `11_PERFORMANCE.md` concern once row counts justify it — don't pre-optimize before there's real data volume).
- Component variants (CVA) should scale by adding a variant key, not by forking a component.

---

## 7. Coding Standards (Summary — Full Detail in 02)

TypeScript strict, Server Components by default, `cn()` for all conditional class composition, CVA for all variant-bearing components, path alias `@/*` for all internal imports (never relative `../../../`). Full rules in [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md).

---

## 8. UI Goals

- Match the visual precision of **Stripe** (data density done cleanly), **Linear** (restraint, motion quality), **Vercel** (typography, dark mode), **Apple** (spacing discipline), and **Figma** (component consistency) — see [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §"Benchmark Comparison".
- Every screen should look **designed**, not assembled from default component states.
- Visual hierarchy must always make the single most important element on a screen obvious within 1 second.

## 9. UX Goals

- A first-time visitor should understand *what Lingotran Engine is* and *why the fidelity numbers matter* within the first screen, no scrolling required.
- Navigation between languages/corpora/books must never feel like a dead end — always a next action.
- Full UX heuristics in [05_UX_REVIEW.md](05_UX_REVIEW.md).

## 10. Branding Goals

- The **"Manifest" identity** (deep violet `--brand-700 #41009a`, emerald `--verified`, confined paper/textbook motif) is the brand — see [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md). Don't introduce off-palette colors for "just this one section."
- **Typography must read as chosen, not defaulted.** The current pairing — **Fraunces** (a distinctive, high-contrast optical-size variable serif) for display type, **Inter** for body/UI, **IBM Plex Mono** for code — is deliberately *not* a generic "Inter everywhere" or system-font look. Every font decision on this project must come from Google Fonts (via `next/font/google`, never a CDN `<link>` or self-hosted static font) and must be evaluated against this bar:
  - Would a design-literate reviewer recognize this pairing as intentional branding, or as "whatever the framework starter shipped with"? Generic-safe choices (Roboto, Open Sans, Inter as *both* display and body, system-ui) fail this bar for anything display/heading-level.
  - The **display/serif family carries the brand's personality** (currently Fraunces — warm, editorial, textbook-adjacent, matching the "system of record" positioning); the **body family stays quiet and highly legible** (currently Inter) so long-form content and data tables don't fight the display type; the **mono family is chosen for code/data legibility** (currently IBM Plex Mono) not just "whatever monospace is default."
  - If a font pairing ever needs to change (rebrand, new section with a different tone), pick the replacement with the same rule: a unique, characterful Google Fonts choice for display, a quiet workhorse for body, both loaded via `next/font/google` as variable fonts where available for performance (see [11_PERFORMANCE.md](11_PERFORMANCE.md)). Never fall back to a generic default "because it's already there" — that is the one thing this rule exists to prevent.
  - Never add a fourth font family without a specific documented reason; never use a font not loaded through `next/font/google`.

## 11. Responsiveness Goals

Fully specified in [08_RESPONSIVE.md](08_RESPONSIVE.md). Summary: correct and comfortable from 320px to 2560px, with real breakpoint-aware layout changes (not just shrinking), and touch-target discipline on mobile/tablet.

## 12. Accessibility Goals

WCAG 2.2 **AA minimum, AAA where achievable without UX compromise** — see [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md). This codebase already ships a skip link and focus-visible rings; every new component must meet or exceed that baseline, never fall below it.

## 13. Performance Goals

Full detail in [11_PERFORMANCE.md](11_PERFORMANCE.md). Summary targets: LCP < 2.5s, INP < 200ms, CLS < 0.1 on representative pages; minimal client JS (Server Components by default); charts and images lazy-loaded below the fold.

## 14. Enterprise Quality Expectations

Every shipped change meets the checklist in `00_MASTER_FRONTEND.md` §9 and is scored against [14_SCORECARD.md](14_SCORECARD.md) when a broader quality pass is requested. "Works on my machine" is not the bar — "would pass review at a design-serious product company" is.

---

**Next:** [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) for engineering standards, or jump straight to [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) if the task is visual.
