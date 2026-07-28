# 02 — Frontend Engineering Rules

> Enterprise engineering standards for Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui, Base UI, and CVA in `site-next/`. Follow these for **every** implementation, not just "big" ones.

---

## 1. Project Structure & Folder Organization

```
app/            # Routes only. Route-level composition, not business logic.
components/
  ui/           # shadcn/Base UI generated primitives. Generic, app-agnostic.
  charts/       # ECharts wrapper components. Chart-specific, still generic.
  *.tsx         # Domain components — specific to Lingotran's content (kpi-card, fidelity-card, …)
lib/            # Pure logic: utils, data access, token mappings. No JSX.
docs/           # This operating-system doc set.
public/         # Static assets.
```

Rules:
- **`components/ui/` is shadcn territory.** Prefer regenerating/extending via shadcn conventions over hand-editing generated primitives, except for intentional token wiring already established in this repo.
- **A component graduates from `components/*.tsx` to `components/ui/*.tsx` only if it becomes truly generic** (no Lingotran-specific copy/data). Don't pre-emptively "promote" things.
- **No `src/` directory** — this project uses root-level `app/`, `components/`, `lib/`. Don't introduce a parallel structure.
- **Colocate route-only components inside the route folder** (e.g. `app/french/_components/`) only once a component is proven single-route; otherwise it lives in `components/`.

---

## 2. Naming Conventions

| What | Convention | Example |
|---|---|---|
| Component files | `kebab-case.tsx` | `kpi-card.tsx`, `status-badge.tsx` |
| Component export | `PascalCase`, matches filename | `export function KpiCard()` |
| Hooks | `useCamelCase.ts`, always starts with `use` | `useCorpusFilter.ts` |
| Types/interfaces | `PascalCase`, no `I`/`T` prefix | `type CorpusEntry`, not `ICorpusEntry` |
| CVA variant keys | `camelCase` | `variant`, `size`, not `Variant` |
| CSS custom properties | `--kebab-case`, namespaced by concern | `--brand-700`, `--sp-4`, `--r-md` |
| Route folders | lowercase, matches URL segment | `app/french/[slug]/` |
| Boolean props | `is`/`has`/`should` prefix | `isLoading`, `hasError` |

Never abbreviate ambiguously (`btn`, `cfg`) in exported identifiers; local one-line-scope variables may abbreviate when the meaning is obvious from context (`i`, `el`).

---

## 3. Server Components vs. Client Components

**Default: Server Component. Every `"use client"` must be justified.**

Add `"use client"` only when the component needs one of:
- Interactivity/event handlers (`onClick`, `onChange`, …)
- State (`useState`, `useReducer`) or effects (`useEffect`)
- Browser-only APIs (`window`, `localStorage`, `document`)
- Context consumption of a client-provided context

**Push `"use client"` to the leaf, not the root.** If a page needs one interactive widget, extract that widget into its own client component and keep the page itself a Server Component composing it — don't mark the whole page client just because one child needs it.

Existing precedent in this repo to follow:
- `components/theme-toggle.tsx` — small, focused client component (reads/writes `localStorage`, DOM attribute).
- `components/global-search.tsx`, `components/mobile-nav.tsx`, `components/corpus-console.tsx` — interactive leaves, not whole-page client boundaries.
- `app/layout.tsx` stays a Server Component; the theme-init script is inlined as a plain `<script>` tag (no client component needed for a one-time DOM write before hydration) — this pattern (inline script for pre-hydration DOM work) beats promoting the whole layout to client.

### Hydration Rules

- Never render content that differs between server and client without `suppressHydrationWarning` **and** a documented reason (see `app/layout.tsx`'s `<html>` tag — the reason is the theme-init script deliberately mutating an attribute before React hydrates).
- Never read `window`/`document`/`localStorage` during the render body of a component that also renders on the server — gate it behind `useEffect` (see `theme-toggle.tsx`'s pattern: state starts `null`, is set in `useEffect`, never guessed during SSR).
- Never let a client component's first render differ from its SSR output in a way that isn't explicitly hydration-safe (e.g. `theme === null` renders a neutral/skeleton state, not a guess).

---

## 4. Component Composition

- **Compose, don't configure via boolean explosion.** If a component is accumulating `isPrimary`, `isCompact`, `isDanger` boolean props, it needs a CVA `variant`/`size` axis instead (see `components/ui/button.tsx` for the reference pattern: `variant` × `size` via `cva()`).
- **Slots over rigid children.** Prefer accepting `children`/named slot props over components that hardcode their internal structure when more than one page needs to vary it.
- **Data down, events up.** Domain components (`kpi-card`, `fidelity-card`, `data-table`) receive data via props from the route/page (Server Component fetches/holds the data); they don't fetch their own data unless they are themselves the data-fetching boundary.
- Full component API rules in [09_COMPONENT_STANDARDS.md](09_COMPONENT_STANDARDS.md). See also the `composition-patterns` skill for compound components, render props, and provider design when a component's API is getting complex.

---

## 5. Variants: CVA Pattern

Every component with visual variants uses `class-variance-authority`, following `components/ui/button.tsx`:

```ts
const componentVariants = cva(
  "base classes shared by all variants",
  {
    variants: {
      variant: { default: "...", outline: "...", ghost: "..." },
      size: { default: "...", sm: "...", lg: "..." },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

- Export both the component and its `Variants` function (`export { Button, buttonVariants }`) so other components can reuse the class computation (e.g. a link styled as a button).
- `VariantProps<typeof componentVariants>` types the props — don't hand-roll a parallel union type.
- Base classes always include state selectors already established in this codebase's convention: `disabled:pointer-events-none disabled:opacity-50`, `focus-visible:ring-3 focus-visible:ring-ring/50`, `aria-invalid:*`. New interactive primitives must include the equivalent set — see [09_COMPONENT_STANDARDS.md](09_COMPONENT_STANDARDS.md) §"Required states".

---

## 6. State Management

- **Local state first.** `useState`/`useReducer` in the closest client component that needs it.
- **No global client state library** (Redux/Zustand/Jotai) exists in this stack and none should be introduced without an explicit, justified need — this is a content site, not an app with complex cross-cutting client state. If a genuine need arises, raise it before adding a dependency.
- **URL is state where it should be.** Filters, active tabs, and selected corpus/book belong in the URL (search params / route segments) when they should be shareable/bookmarkable and back-button-safe — not only in `useState`.
- **Server state (data) lives in Server Components** fetching directly (no client-side data-fetching library is in this stack yet); don't introduce `useEffect`-based data fetching for data available at request time on the server.

---

## 7. Hooks

- One responsibility per hook. `useCorpusFilter` filters; it doesn't also format display strings.
- Hooks always start with `use`, live beside their consumer unless shared by 2+ components (then promote to `lib/` or a `hooks/` folder — note `components.json` already reserves the `@/hooks` alias for this).
- Never call hooks conditionally or after an early return — standard Rules of Hooks, enforced by `eslint-plugin-react-hooks` via `eslint-config-next`. Treat lint errors here as build-blocking, not advisory (see the existing `// eslint-disable-next-line react-hooks/set-state-in-effect` in `theme-toggle.tsx` — note even that is an explicit, commented, single-line exception, not a blanket disable).

---

## 8. Performance Patterns

Full detail in [11_PERFORMANCE.md](11_PERFORMANCE.md). Rules that affect architecture decisions:

- Server Components ship zero client JS by default — this is the single biggest performance lever available; don't spend it by defaulting to `"use client"`.
- Heavy client libraries (`echarts` via `components/echart.tsx`, `cmdk` via `command.tsx`) must be dynamically imported (`next/dynamic`) when not needed for first paint — e.g. below-the-fold charts, command palettes gated behind a keyboard shortcut/click.
- Memoize (`useMemo`/`useCallback`) only when a measured re-render cost justifies it — not by default/reflex. Premature memoization is noise, not performance.
- Images always via `next/image`, never a raw `<img>`, unless there's a specific documented reason (e.g. an SVG icon sprite).

---

## 9. Clean Architecture, SOLID, DRY, KISS, YAGNI — Applied to This Stack

- **Single Responsibility**: a component renders; a hook manages a slice of behavior; `lib/data.ts` holds data shape and access, not rendering logic. `components/echart.tsx` wraps ECharts setup so domain chart components (`bar-chart.tsx`, `cost-donut.tsx`) stay declarative.
- **Open/Closed**: extend via CVA variants/new props, not by branching internals with `if (someSpecialCase)`. A component should be closed to modification for a new visual need, open to extension via its variant API.
- **Liskov-equivalent for React**: any component accepting a `variant` prop must render sensibly for every declared variant — no variant that silently no-ops or crashes.
- **Interface Segregation**: don't force a component to accept props it ignores because it shares a type with an unrelated component. Split the type.
- **Dependency Inversion**: domain components depend on data shapes (`lib/data.ts` types), not on how that data was fetched (fetch/DB/static import) — keeps the eventual move from static data to a real API cheap.
- **DRY**: real duplication (identical logic in 2+ places) gets extracted. **Coincidental similarity does not** — two components that happen to look alike today but represent different concepts stay separate (see YAGNI below).
- **KISS**: the simplest implementation that fully satisfies the requirement wins over the "more elegant" one that adds indirection without adding capability.
- **YAGNI**: don't build the filter system, the pagination abstraction, or the multi-tenant hook for a requirement that hasn't been asked for. Three similar lines beat a premature shared abstraction (per the standing project-wide rule).

---

## 10. Error Handling

- **Boundaries at route level**: use Next.js `error.tsx`/`not-found.tsx` conventions per route segment where a route can meaningfully fail (data missing for a `[slug]`, corpus not found) rather than one global catch-all swallowing context.
- **Validate only at real boundaries**: data coming from `lib/data.ts`/external sources gets validated/narrowed at the point it enters the app; internal prop-passing between trusted components does not need redundant runtime checks — trust TypeScript there.
- **Fail loud in development, gracefully in production**: a missing corpus slug should 404 cleanly for a user, not silently render an empty page — but should throw clearly during development/build if the underlying data contract is violated.
- **No silent catch blocks.** A `catch {}` with no comment explaining why the error is safely ignorable (see the one legitimate example in this codebase, `theme-toggle.tsx`'s `localStorage.setItem` catch — private-browsing storage quota is genuinely fine to ignore) is a bug, not error handling.

---

## 11. Import & Path Rules

- Always import via the `@/*` path alias (`@/components/...`, `@/lib/...`) — never deep relative paths (`../../../lib/utils`). The alias is already configured in `tsconfig.json`.
- Group imports: external packages first, then `@/` internal, then relative (same-folder) imports, with a blank line between groups (match existing file conventions — see `components/ui/button.tsx`).

---

## 12. Reusability & Maintainability Checklist

Before adding a new component or utility, confirm:

- [ ] I grepped `components/`, `components/ui/`, and `lib/` for an existing solution.
- [ ] If extending an existing component, I added a variant/prop rather than forking the file.
- [ ] The new code follows the naming, structure, and RSC/Client rules above.
- [ ] No new runtime dependency was added without confirming it's genuinely not covered by the existing stack (§2 of [01_PROJECT_CONTEXT.md](01_PROJECT_CONTEXT.md)).
- [ ] `tsc --noEmit` and `pnpm lint` are clean.

---

**Next:** [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) for every visual value these rules assume you'll reach for instead of inventing.
