# Lingotran Engine — site

The public knowledge base for the Lingotran extraction pipeline: the corpus, the
per-book QA record, the orchestration behind it, and a filterable explorer over
the exported datasets.

Live at **https://lingotran-engine.vercel.app**

## Running it

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

```bash
pnpm build && pnpm start   # production build on :3000
pnpm lint
pnpm test:e2e              # Playwright, Chromium + WebKit, against a prod build
```

## Deployment

Vercel, from the `main` branch of the parent repo. Because the Next app lives in
a subdirectory of a larger multi-language corpus repo, **the Vercel project's
Root Directory must be set to `site-next`** — there is no `package.json` at the
repo root, so an unset Root Directory fails the build with
`No Next.js version detected`.

Leave "Include files outside the root directory" off: this directory is
self-contained, and the corpus CSVs it serves are snapshotted into
`public/data/` rather than read from the parent tree at build time.

## Stack

- **Next.js 16** (App Router, RSC-first — client components only where state or
  browser APIs are genuinely needed)
- **Tailwind CSS 4** over the "Manifest" design tokens in `app/globals.css`
- **Base UI** primitives via shadcn (`components/ui/`)
- **TanStack Table** for the Explorer
- **Charts are inline SVG** (`components/charts/`) — deliberately no charting
  library; see the note at the top of `charts/donut.tsx`
- Fonts: Fraunces (display), Inter (sans), IBM Plex Mono — self-hosted by
  `next/font`

## How the theme works

There are three states, not two: an explicit choice stamps
`data-theme="light" | "dark"` on `<html>`; with no stamp, the OS decides.

Every themed value is declared **once**, as `light-dark(light, dark)` in
`:root`, and resolves against `color-scheme` — which is the only thing the
toggle changes. Do not add a second copy of a token under a `[data-theme]` or
`@media (prefers-color-scheme)` block: that pattern is what previously let
`--amber-strong` go missing from one of two hand-kept dark blocks and drop
amber text to 2.99:1, failing WCAG AA for anyone who used the toggle.

The `dark:` Tailwind variant is redefined in `globals.css` to cover *both*
signals, so a `dark:` utility can never disagree with the tokens.

## Docs

`docs/00_MASTER_FRONTEND.md` is the index — frontend rules, the design system,
UI/UX review checklists, motion, accessibility, responsive, performance,
Playwright, and the weighted scorecard used to grade the site.
