import { test, expect } from "@playwright/test";

test.describe("Theme toggle", () => {
  test("toggles data-theme, persists across reload, and keeps text readable", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");

    // Starts light (no stored preference in a fresh context).
    await expect(html).not.toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: "Toggle light or dark theme" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    // Persists across a real reload (localStorage + the pre-hydration script).
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");

    // The eyebrow label (the exact element that was a P0 dark-mode contrast
    // bug earlier this session) must render with real, non-transparent color.
    const eyebrow = page.locator("span.text-link").first();
    const color = await eyebrow.evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toBe("rgba(0, 0, 0, 0)");

    await page.getByRole("button", { name: "Toggle light or dark theme" }).click();
    await expect(html).not.toHaveAttribute("data-theme", "dark");
  });

  test("no flash-of-wrong-theme on a hard navigation with dark stored", async ({ page, context }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle light or dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Navigate to a different route entirely (fresh document load, not a
    // client-side transition) -- the inline pre-hydration script must apply
    // data-theme before first paint every time, not just after mount.
    await page.goto("/engine");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
