# 06 — Motion System

> Enterprise motion design standards for `site-next/`. Motion tokens live in [`app/globals.css`](../app/globals.css) (`--ease-out`, `--ease-spring`, `--dur-1..4`) and are further supported by `tw-animate-css`. Every animation decision must trace to this document.

---

## 1. Motion Philosophy

Motion here serves the brand's "system of record" positioning (see [01_PROJECT_CONTEXT.md](01_PROJECT_CONTEXT.md) §10): **precise, confident, quiet** — never bouncy, playful, or attention-seeking. If an animation would look at home in a consumer social app but not in Stripe's dashboard or Linear's app, it's wrong for this site.

Every animation must satisfy at least one of:
- Clarifies **cause and effect** (a card that appeared didn't just teleport in — it visibly came from somewhere).
- Reduces **perceived latency** (skeleton → content transition, optimistic feedback within the Doherty Threshold — see [05_UX_REVIEW.md](05_UX_REVIEW.md) §2).
- Maintains **spatial continuity** (a drawer slides from the edge it's anchored to; a dialog scales from its trigger, not from nowhere).

If it doesn't do one of these three things, it's decoration — and decoration is the first thing to cut when in doubt.

---

## 2. Motion Tokens

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0.7, 0.2, 1)` | **Default for almost everything** — fast start, gentle settle. Entrances, hovers, most transitions. |
| `--ease-spring` | `cubic-bezier(0.22, 1, 0.36, 1)` | Reserved for emphasis moments — a featured card drawing attention, a success confirmation. Use sparingly; overuse reads as "bouncy," which conflicts with the brand tone. |
| `--dur-1` | `0.12s` | Micro-interactions: hover color/background shifts, icon state swaps. |
| `--dur-2` | `0.2s` | Small UI transitions: button press, tooltip appear, toggle switch. |
| `--dur-3` | `0.35s` | Medium surfaces: dropdown/popover open, card hover-lift, accordion expand. |
| `--dur-4` | `0.55s` | Large surfaces: drawer/sheet slide-in, dialog open, page-level transitions. |

**Rule of scale**: the larger the element or the distance it travels, the longer the duration — never animate a full-screen drawer in `0.12s` (will feel like a glitch) or a tiny hover state in `0.55s` (will feel laggy). Match token to §3 category below, don't eyeball a duration.

---

## 3. Motion by Category

### 3.1 Page / Route Transitions
- Default: no heavy custom page-transition choreography — Next.js App Router navigations should feel instant (see [11_PERFORMANCE.md](11_PERFORMANCE.md)); a lightweight fade-in of new content (`--dur-3`, `--ease-out`) is acceptable but never a full-page wipe/slide that delays perceived load.
- Never block interactivity for a decorative transition to finish.

### 3.2 Modal / Dialog Animations (`dialog.tsx`)
- Entrance: scrim fades in (`--dur-2`), panel scales from ~96% → 100% + fades in (`--dur-3`, `--ease-out`). Exit: reverse, slightly faster (`--dur-2`).
- Never animate dialog content position in a way that fights focus-trap/scroll behavior — see [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md).

### 3.3 Drawer / Sheet Animations (`sheet.tsx`, `mobile-nav.tsx`)
- Slide from the physical edge it's anchored to (right sheet slides from right, mobile nav from wherever it's triggered), `--dur-4`, `--ease-out`. Scrim fades concurrently, not sequentially (concurrent = feels responsive; sequential = feels laggy).

### 3.4 Hover Effects
- `--dur-1`–`--dur-2`, `--ease-out`. Color/background/border transitions only by default; a subtle lift (`translateY(-1px)` + shadow step-up per [03_DESIGN_SYSTEM.md](03_DESIGN_SYSTEM.md) §6) is appropriate for clickable cards, not for every hoverable element indiscriminately.
- Button press states already follow the codebase's existing pattern (`active:not-aria-[haspopup]:translate-y-px` in `button.tsx`) — match this convention for any new pressable element rather than inventing a different press feedback.

### 3.5 Loading & Skeleton Animations
- Skeletons pulse subtly (opacity oscillation, `--dur-4`-scale period, low amplitude) — never a hard blink, never a shimmer so fast it reads as jittery.
- Skeleton shapes must match real content dimensions (ties to [04_UI_REVIEW.md](04_UI_REVIEW.md) §3.11) so the loaded-state swap causes zero layout shift.
- Spinners reserved for genuinely indeterminate waits; prefer skeletons for anything with a knowable shape (cards, tables, charts).

### 3.6 Micro-interactions
- Theme toggle icon swap (`theme-toggle.tsx`): should cross-fade/rotate rather than hard-cut between sun/moon icons — `--dur-2`, `--ease-out`.
- Badge/status changes (`status-badge.tsx`): a brief highlight flash on value change is acceptable for drawing attention to updated data; must respect reduced-motion (§5).
- Chart entrance (`echart.tsx` wrappers): bars/donut slices drawing in on first render (ECharts' built-in animation) is appropriate once per mount; never re-trigger the full draw-in animation on every re-render/data refresh — only on genuinely new data or first paint.

---

## 4. Motion Hierarchy

Not everything should move with equal prominence. Establish a hierarchy per screen:
1. **Primary feedback** (the thing the user just did) gets the clearest, most immediate motion.
2. **Secondary/ambient** (a background chart redrawing, a list reordering) gets subtler, slower motion so it doesn't compete for attention with primary feedback happening at the same time.
3. **Nothing animates purely for decoration** on a data-dense screen — competing simultaneous animations on a KPI dashboard read as chaotic, not premium.

---

## 5. Reduced Motion Support

**Mandatory, not optional.** Every animation must respect `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- This is a global reset, not per-component opt-in — if it isn't already present in `app/globals.css`, adding it is a P0 accessibility gap, not a nice-to-have (see [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md) §"Motion").
- Reduced motion means **instant state changes, not no state changes** — a dialog must still open, a toggle must still switch; only the tween is removed, not the resulting state.
- `tw-animate-css` utilities used anywhere in the codebase must be checked against this override, not assumed to already respect it.

---

## 6. GPU Acceleration & Performance

- Animate only `transform` and `opacity` wherever possible — these are compositor-only properties that don't trigger layout/paint. Avoid animating `width`, `height`, `top`/`left`, `margin` for anything performance-sensitive (prefer `transform: scale()`/`translate()`).
- For an element that will animate, `will-change: transform` (or `opacity`) can be applied just before the animation and removed after — don't leave `will-change` on indefinitely (it costs memory for no benefit once the animation is done).
- Avoid animating `box-shadow` directly on a frequently-hovered large surface if profiling shows jank — prefer a pseudo-element opacity-fade of a pre-rendered shadow instead, only if a real performance problem is measured (don't pre-optimize without evidence — see YAGNI in [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §9).

---

## 7. Detecting Motion Defects

When reviewing motion (own work or auditing existing UI), check for:

| Defect | How to detect | Likely cause |
|---|---|---|
| **Jank / stutter** | Record screen at 60fps or use browser DevTools' Performance/Rendering panel; look for dropped frames during the animation | Animating layout-triggering properties (§6); too many simultaneous animations |
| **Layout shift** | DevTools' Layout Shift Regions overlay; Core Web Vitals CLS in Lighthouse | Skeleton shape mismatch; images without dimensions; content popping in after measurement |
| **Flicker** | Watch theme toggle and any conditionally-rendered content at normal speed *and* slowed down (DevTools CPU throttle) | Hydration mismatch (see [02_FRONTEND_RULES.md](02_FRONTEND_RULES.md) §3 hydration rules); FOUC on font/theme load |
| **Inconsistent transitions** | Compare the same interaction (e.g. "open a dialog") across two different dialogs/pages | Not using the shared motion tokens — a hand-rolled duration/easing snuck in instead of `--dur-*`/`--ease-*` |
| **Animation that never resolves** | Trigger the interaction, wait — does the loading/transition state ever end? | Missing cleanup in `useEffect`, or a stuck loading flag not tied to actual async resolution |
| **Motion on load that fires every time** | Reload vs. client-navigate to the same view repeatedly | Draw-in animation triggered by component mount rather than gated to first-paint/new-data (§3.6 chart note) |

---

## 8. What Good Motion Looks Like (Checklist)

- [ ] Every animation maps to a token from §2 — no hand-written `transition: all 0.3s ease` with arbitrary values.
- [ ] Every animation clarifies cause/effect, reduces perceived latency, or maintains spatial continuity (§1) — nothing purely decorative on a data-dense screen.
- [ ] `prefers-reduced-motion: reduce` is respected globally (§5), verified by actually toggling the OS setting, not assumed.
- [ ] No animation triggers a layout shift (verified via DevTools, not assumed).
- [ ] No animation runs longer than necessary for its category (§3) — nothing feels sluggish.
- [ ] Simultaneous animations on one screen don't compete (§4 hierarchy respected).
- [ ] Only `transform`/`opacity` animate on anything performance-sensitive (§6).

---

**Next:** [07_ACCESSIBILITY.md](07_ACCESSIBILITY.md) — reduced motion is one requirement among many there.
