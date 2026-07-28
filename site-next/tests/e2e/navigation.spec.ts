import { test, expect } from "@playwright/test";

const ROUTES = ["/", "/engine", "/french", "/german", "/reference"];

test.describe("Route reachability", () => {
  for (const path of ROUTES) {
    test(`${path} loads with a real heading and no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
      expect(errors, `console/page errors on ${path}: ${errors.join(", ")}`).toEqual([]);
    });
  }
});

test.describe("French corpus drill-down", () => {
  test("index page links to a real book detail page", async ({ page }) => {
    await page.goto("/french");
    await expect(page.getByRole("heading", { name: /French/i, level: 1 })).toBeVisible();

    const bookLink = page.getByRole("link", { name: /Cosmopolite 1/ }).first();
    await expect(bookLink).toBeVisible();
    await bookLink.click();

    await expect(page).toHaveURL(/\/french\/cosmopolite-a1-methode/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Cosmopolite");
  });
});

test.describe("404 handling", () => {
  test("an unknown route shows the branded not-found page, not a blank shell", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  });

  test("an unknown corpus slug shows the branded not-found page", async ({ page }) => {
    const response = await page.goto("/french/this-book-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  });
});

test.describe("Nav links resolve", () => {
  test("every primary nav link responds with 200", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page.locator("nav a[href^='/']").evaluateAll((els) =>
      Array.from(new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute("href")))).filter(Boolean)
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs as string[]) {
      const res = await request.get(href);
      expect(res.status(), `nav link ${href} should resolve`).toBe(200);
    }
  });
});
