# 09 — Component Standards

> Every component in `components/` and `components/ui/` must pass this quality bar before it's considered production-ready. This is the checklist to run against any new component and against any existing one under review.

---

## 1. API Design Principles

- **Props describe intent, not implementation.** `variant="destructive"` not `isRedButton`. `size="lg"` not `fontSize={18}`.
- **Sensible defaults, explicit overrides.** Every variant-bearing component has `defaultVariants` (CVA) so it renders correctly with zero props passed, per `components/ui/button.tsx`'s pattern.
- **Composition over configuration.** Prefer `children`/slot props for structural flexibility over an ever-growing list of content-shape props (`title`, `subtitle`, `icon`, `footer`, …) once that list exceeds ~4-5 — see the `composition-patterns` skill for compound-component/slot patterns when a component's prop surface is genuinely outgrowing flat props.
- **Extend native props.** Wrap and extend the underlying element/primitive's prop type (`ButtonPrimitive.Props & VariantProps<typeof buttonVariants>`, per `button.tsx`) rather than redeclaring a narrower custom type — consumers should be able to pass any valid native/primitive prop (`onClick`, `disabled`, `aria-*`) through without the wrapper blocking it.

---

## 2. Naming Conventions

Covered fully in [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §2. Component-specific additions:

- Exported variant function name is the component name + `Variants` (`buttonVariants`, `badgeVariants`).
- `data-slot="component-name"` attribute on the root element of every primitive (already the pattern in `button.tsx`) — enables consistent styling hooks (`in-data-[slot=...]`) and predictable DOM inspection.

---

## 3. Composition & Slots

- A component that renders multiple distinct visual regions (e.g. a card with header/body/footer) should expose each as a sub-component or named slot (`CardHeader`, `CardBody`, `CardFooter` pattern) rather than an opaque set of props trying to describe arbitrary content — this is the shadcn convention already implicit in this stack's component style.
- Sub-components share a `data-slot` naming scheme with the parent (`data-slot="card-header"`, etc.) for consistent internal styling hooks.

---

## 4. Accessibility (Non-Negotiable Per-Component)

Every interactive component must satisfy [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md) in full. Component-level summary checklist:

- [ ] Correct semantic element or ARIA role.
- [ ] Keyboard operable (Tab reaches it, Enter/Space/Escape/Arrows behave per its widget type).
- [ ] Visible focus state using `--ring` token.
- [ ] Accessible name (visible label, `aria-label`, or `aria-labelledby`) — never an icon-only control with no name.
- [ ] Works with a screen reader (verified, not assumed, for any new non-trivial component).

---

## 5. Variants

- All variants defined via CVA (see [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §5), never via conditional className string concatenation or a chain of ternaries.
- Every declared variant must render a complete, correct state — no variant is a stub "for later."
- Variant naming is consistent across components: `variant` for semantic/color axis, `size` for dimensional axis — don't invent a differently-named axis (`type`, `kind`) for the same concept in a new component.

---

## 6. Required States

Every interactive component must explicitly handle, and visually distinguish:

| State | Required? | Notes |
|---|---|---|
| Default (rest) | Always | |
| Hover | Always (pointer devices) | No-op on touch — don't rely on hover to reveal required info |
| Focus-visible | Always | `--ring` token, never suppressed |
| Active/pressed | Always for buttons/pressable elements | Match `button.tsx`'s `translate-y-px` convention |
| Disabled | If the component can be disabled | `pointer-events-none`, reduced opacity, `aria-disabled`/`disabled` |
| Loading | If the component can be async | Skeleton or spinner per [06_MOTION_SYSTEM.md](06_MOTION_SYSTEM.md) §3.5, never a silent freeze |
| Error | If the component can fail | Uses `--flag*` tokens, specific message, `aria-invalid` where applicable |
| Empty | If the component renders a collection | Designed empty state, not a blank area — see [04_UI_REVIEW.md](04_UI_REVIEW.md) §3.12 |
| Selected/active | If the component is selectable (nav item, tab, table row) | Visually distinct, `aria-selected`/`aria-current` as appropriate |

A component missing an applicable row above is **not** production-ready — treat this table as a literal gate, not general guidance.

---

## 7. Styling Patterns

- All styling via Tailwind utility classes + `cn()` (`lib/utils.ts`) for conditional/merged classes — never inline `style={{}}` except for a genuinely dynamic value Tailwind can't express statically (e.g. a computed chart color, a measured pixel offset).
- Every color/spacing/radius/shadow value traces to a [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) token via its Tailwind utility mapping — no arbitrary values (`bg-[#7c4dff]` when `bg-brand-500` exists).
- `className` prop always accepted and merged last via `cn()` so consumers can extend/override — per every existing `components/ui/*` file.

---

## 8. State Handling

- Local UI state (open/closed, hovered, focused-within) lives in the component itself (via Base UI primitives' built-in state, or local `useState` in a client component) — don't lift state to a parent unless the parent genuinely needs to control/observe it.
- Controlled + uncontrolled support where the underlying primitive supports both (e.g. `Dialog`'s `open`/`onOpenChange` vs. uncontrolled default) — match the Base UI primitive's existing controlled/uncontrolled API rather than building a parallel one.

---

## 9. Loading & Error States (Component-Level)

- Any component that can receive async data (`data-table.tsx`, chart wrappers, `corpus-console.tsx`) must accept/render a loading state and an error state as first-class concerns, not an afterthought bolted on with a ternary at the call site.
- Error states inside a component should never crash the whole page — isolate failure to the component's own render output (React error boundaries at a sensible granularity for anything genuinely risky, e.g. third-party chart rendering).

---

## 10. Testing Requirements

- Every new component with non-trivial logic (conditional rendering, variant branching, async states) gets at least a smoke-level check before being called done — via the `webapp-testing` skill (render it, interact with it, screenshot it) at minimum; a formal test file (Playwright, see [12_PLAYWRIGHT.md](12_PLAYWRIGHT.md)) for anything on a critical user journey.
- Visual verification (§8 of [00_MASTER_FRONTEND.md](00_MASTER_FRONTEND.md)) counts as part of "testing" for presentational components — a component isn't tested if it was never actually rendered and looked at.

---

## 11. Documentation Expectations

- No verbose docblocks. A component's props should be self-documenting via TypeScript types and clear naming (see the no-comments-unless-non-obvious rule, project-wide).
- A one-line comment is warranted only for a genuinely non-obvious constraint — e.g. `theme-toggle.tsx`'s comment explaining *why* state starts `null` and is set in `useEffect` (hydration correctness, not decoration).
- If a component's usage isn't obvious from its name + props + a glance at a call site, that's a signal the API itself needs simplifying — not a signal to add a comment explaining the confusing part.

---

## 12. Reusability

- A component belongs in `components/ui/` only once it has zero Lingotran-specific content/copy/data baked in — see [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §1.
- Before writing a new component, grep existing ones (`components/`, `components/ui/`) for something that already does 80% of the job via a new variant/prop.

---

## 13. Component Quality Checklist (Gate Before "Production-Ready")

- [ ] API uses intent-based props, sensible defaults, extends native/primitive prop types (§1).
- [ ] Naming matches conventions (§2, and [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §2).
- [ ] Structurally complex content uses composition/slots, not an opaque prop pile (§3).
- [ ] Fully accessible per [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md) (§4).
- [ ] Variants via CVA, every variant fully rendered/correct (§5).
- [ ] Every applicable required state from §6's table is implemented and visually distinct.
- [ ] Styling is 100% token-traceable, no arbitrary values (§7).
- [ ] State handling matches controlled/uncontrolled conventions of its underlying primitive (§8).
- [ ] Loading/error states handled at the component level for anything async (§9).
- [ ] Verified by actually rendering and interacting with it, not just type-checked (§10).
- [ ] No unnecessary comments; the one-line-max rule respected where a comment is genuinely warranted (§11).
- [ ] Confirmed no existing component already covered this need before creating a new one (§12).

---

**Next:** [10_VISUAL_QA.md](10_VISUAL_QA.md) to catch the visual defects that slip through even a component meeting every item above.
