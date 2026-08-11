import { test, expect } from "@playwright/test";

test.describe("Global search", () => {
  test("opens via keyboard shortcut, filters results, navigates on select", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("/");

    const dialog = page.getByRole("dialog", { name: "Search" });
    // Slightly more generous than the default 5s: confirmed via an isolated,
    // single-worker run that this is CPU contention under full parallelism
    // (11 workers), not a real race in the app -- the "/" keydown handler
    // needs the client component hydrated, which can lag under load.
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await page.keyboard.type("Cosmopolite");
    const result = dialog.getByText("Cosmopolite 1", { exact: false }).first();
    await expect(result).toBeVisible();

    await result.click();
    await expect(page).toHaveURL(/\/french\/cosmopolite-a1-methode/);
  });

  test("shows a designed empty state for a query with no matches", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("/");
    await page.keyboard.type("zzzzznonexistentquery");
    await expect(page.getByText("No matches")).toBeVisible();
  });

  test("closes on Escape", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("/");
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Search" })).toBeHidden();
  });
});

test.describe("Corpus console (homepage)", () => {
  test("filters the corpus table and shows an empty state for no matches", async ({ page }) => {
    await page.goto("/#corpus");
    // CorpusConsole is a client component ("use client") -- wait for
    // hydration before interacting, otherwise a fill() can land on the
    // SSR-painted input before React's onChange is wired up and get lost.
    await page.waitForLoadState("networkidle");
    const searchBox = page.getByPlaceholder("Search books, exams, sources…");
    // networkidle is not proof of hydration -- under WebKit a fill() could land
    // on the SSR-painted input before React's onChange was wired up and be
    // silently dropped, which made this test flaky rather than failing
    // honestly. Typing character by character and asserting on the live count
    // exercises the same path a user does and waits for React to be listening.
    await expect(searchBox).toBeEnabled();
    await searchBox.click();
    await searchBox.pressSequentially("zzzznonexistentbook", { delay: 15 });
    await expect(page.getByText("No matches")).toBeVisible({ timeout: 10_000 });

    await searchBox.fill("");
    await searchBox.pressSequentially("Cosmopolite", { delay: 15 });
    await expect(page.getByText("Cosmopolite 1", { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  });
});
