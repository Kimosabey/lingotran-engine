import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Wait for every FINITE animation and transition to finish before scanning.
//
// A fixed timeout was used here and became wrong the moment the Section
// entrance stagger was repaired: the delays (up to 180ms) had silently never
// applied, so the reveal used to complete in --dur-4 (550ms) and a 650ms wait
// covered it. With the stagger working, the last element finishes at 730ms, and
// axe began sampling text mid-fade -- reporting #848198 on #fcfcfe, which is
// --text-muted composited at partial opacity rather than any real token.
//
// Deriving the settle point instead of guessing it means restyling the reveal
// can't quietly break the scan again. Infinite animations are excluded: the
// hero's verification loop never settles by design.
async function settle(page: import("@playwright/test").Page) {
  // Reveal the page the way a reader does, THEN scan.
  //
  // Sections render at opacity-0 and are revealed by an IntersectionObserver,
  // so anything below the fold is still transparent when the page first loads.
  // axe walks the whole DOM regardless of scroll position, computes those
  // elements' colours composited against their background, and reports
  // contrast failures that no human could ever see -- e.g. #848198 on #fcfcfe,
  // which is --text-muted at partial opacity rather than any real token.
  // Waiting alone cannot fix this: with nothing yet animating, a wait returns
  // immediately and the transitions start during the scan.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  });
  // Now every reveal has been triggered, wait for the finite ones to land.
  // Infinite animations are excluded -- the hero's verification loop never
  // settles by design.
  await page
    .waitForFunction(
      () =>
        document.getAnimations().filter((a) => {
          const iterations = a.effect?.getTiming?.().iterations;
          return a.playState === "running" && iterations !== Infinity;
        }).length === 0,
      null,
      { timeout: 8000 }
    )
    .catch(() => {});
  // One extra frame so the final committed style is what axe reads.
  await page.waitForTimeout(150);
}

const ROUTES = [
  "/",
  "/engine",
  "/french",
  "/french/cosmopolite-a1-methode",
  "/german",
  "/reference",
  "/explorer/french/catalog",
];

test.describe("Automated WCAG scan (axe-core)", () => {
  // Each of these does real work: scroll the whole page to trigger every
  // reveal, wait for the transitions to land, then run a full axe pass -- twice,
  // once per theme. /engine alone takes ~22s unloaded. The 30s default was
  // fine when the scan was a bare snapshot and is not any more.
  test.describe.configure({ timeout: 120_000 });

  for (const path of ROUTES) {
    test(`${path} has zero critical/serious violations, both themes`, async ({ page }) => {
      await page.goto(path);
      await settle(page);
      const light = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const lightSevere = light.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(lightSevere, JSON.stringify(lightSevere, null, 2)).toEqual([]);

      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      // Same reasoning: toggling data-theme changes the custom properties that
      // transition-colors is watching, so colours interpolate rather than snap.
      await settle(page);
      const dark = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const darkSevere = dark.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(darkSevere, JSON.stringify(darkSevere, null, 2)).toEqual([]);
    });
  }
});

test.describe("Accessibility tree sanity (proxy for screen-reader consumption)", () => {
  test("homepage exposes a coherent landmark + heading structure", async ({ page }) => {
    await page.goto("/");

    // Exactly one h1, reachable via the accessibility tree, not just the DOM.
    const h1Count = await page.getByRole("heading", { level: 1 }).count();
    expect(h1Count).toBe(1);

    // Landmarks a screen reader user would jump between.
    await expect(page.getByRole("banner")).toBeVisible(); // <header>
    await expect(page.getByRole("main")).toBeAttached();
    await expect(page.getByRole("contentinfo")).toBeVisible(); // <footer>
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  test("every icon-only button has a real accessible name", async ({ page }) => {
    await page.goto("/");
    const buttons = await page.locator("button").all();
    for (const btn of buttons) {
      const accessibleName = await btn.evaluate((el) => (el as HTMLElement).innerText || el.getAttribute("aria-label"));
      const hasVisibleText = (await btn.innerText()).trim().length > 0;
      const hasAriaLabel = await btn.getAttribute("aria-label");
      expect(hasVisibleText || !!hasAriaLabel, `button with no accessible name: ${await btn.evaluate((el) => el.outerHTML)}`).toBeTruthy();
      void accessibleName;
    }
  });

  test("skip link moves real document focus to #main, not just scroll position", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    const activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("main");
  });
});
