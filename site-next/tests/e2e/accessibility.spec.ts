import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = ["/", "/engine", "/french", "/french/cosmopolite-a1-methode", "/german", "/reference"];

test.describe("Automated WCAG scan (axe-core)", () => {
  for (const path of ROUTES) {
    test(`${path} has zero critical/serious violations, both themes`, async ({ page }) => {
      await page.goto(path);
      // Let the entrance reveal (Section's IntersectionObserver fade, --dur-4
      // = 550ms) fully settle before scanning -- mid-transition opacity would
      // otherwise read as a transient, false-positive contrast failure.
      await page.waitForTimeout(650);
      const light = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const lightSevere = light.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(lightSevere, JSON.stringify(lightSevere, null, 2)).toEqual([]);

      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
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
