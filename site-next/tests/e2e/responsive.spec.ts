import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { width: 375, height: 812, label: "mobile" },
  { width: 768, height: 1024, label: "tablet" },
  { width: 1440, height: 900, label: "desktop" },
];

const ROUTES = ["/", "/french", "/french/cosmopolite-a1-methode"];

test.describe("No horizontal overflow", () => {
  // Page-level scrollWidth vs. innerWidth, NOT a per-element bounding-rect
  // sweep -- the latter false-positives on anything correctly scrollable
  // within its own bounded container (e.g. data-table.tsx's overflow-x-auto
  // wrapper legitimately has children wider than the viewport; that's not
  // page overflow, it's the intended horizontal-scroll pattern from
  // 08_RESPONSIVE.md). Confirmed this distinction the hard way earlier in
  // this same project.
  for (const path of ROUTES) {
    for (const vp of VIEWPORTS) {
      test(`${path} @ ${vp.label} (${vp.width}px) has no page-level horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(path);
        await page.waitForLoadState("networkidle");

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));

        expect(scrollWidth, `document.scrollWidth (${scrollWidth}) vs window.innerWidth (${innerWidth})`).toBeLessThanOrEqual(
          innerWidth
        );
      });
    }
  }
});

test.describe("Mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hamburger opens the sheet, background becomes inert, Escape closes and returns focus", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();
    await page.waitForTimeout(650); // sheet motion (--dur-4, 550ms) settling

    const headerInert = await page.evaluate(() => document.querySelector("header")?.getAttribute("aria-hidden"));
    expect(headerInert).toBe("true");
    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(bodyOverflow).toBe("hidden");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(650);

    const headerInertAfter = await page.evaluate(() => document.querySelector("header")?.getAttribute("aria-hidden"));
    expect(headerInertAfter).toBeNull();
    await expect(trigger).toBeFocused();
  });

  test("section-nav tab row scrolls horizontally with an edge-fade hint when it overflows", async ({ page }) => {
    await page.goto("/french/cosmopolite-a1-methode");
    const nav = page.getByRole("navigation", { name: "On this page" });
    const { scrollWidth, clientWidth } = await nav.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);
  });
});
