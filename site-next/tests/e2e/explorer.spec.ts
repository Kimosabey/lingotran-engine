import { test, expect } from "@playwright/test";

test.describe("CSV Data Explorer", () => {
  test("/explorer redirects to the default dataset", async ({ page }) => {
    await page.goto("/explorer");
    await expect(page).toHaveURL(/\/explorer\/french\/catalog$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("French Catalog");
  });

  test("shows real corpus rows, not placeholders", async ({ page }) => {
    await page.goto("/explorer/french/catalog");
    await expect(page.getByRole("cell", { name: "cosmopolite-a1-methode" }).first()).toBeVisible();
    await expect(page.getByText(/\d+ of \d+ rows/)).toBeVisible();
  });

  test("language and type switching navigates to real, distinct routes", async ({ page }) => {
    await page.goto("/explorer/french/catalog");
    await page.getByRole("navigation", { name: "Language" }).getByRole("link", { name: "German" }).click();
    await expect(page).toHaveURL(/\/explorer\/german\/catalog$/);
    await page.getByRole("navigation", { name: "Dataset" }).getByRole("link", { name: "Vocabulary" }).click();
    await expect(page).toHaveURL(/\/explorer\/german\/vocabulary$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("German Vocabulary");
  });

  test("global search filters the row count", async ({ page }) => {
    await page.goto("/explorer/french/vocabulary");
    await page.waitForLoadState("networkidle");
    const before = await page.getByText(/of \d+ rows/).textContent();
    await page.getByPlaceholder("Search this dataset…").fill("Allemagne");
    await page.waitForTimeout(300);
    const after = await page.getByText(/of \d+ rows/).textContent();
    expect(after).not.toBe(before);
    expect(after).toMatch(/^[1-9]\d* of/);
  });

  test("quick-filter dropdown narrows results", async ({ page }) => {
    await page.goto("/explorer/french/catalog");
    await page.waitForLoadState("networkidle");
    await page.getByRole("combobox", { name: "Filter by Activity type" }).click();
    await page.getByRole("option", { name: "cover", exact: true }).click();
    await expect(page.getByText(/of 584 rows/)).toHaveText(/^\d+ of 584 rows$/);
    const count = await page.getByText(/of 584 rows/).textContent();
    expect(count).not.toContain("584 of 584");
  });

  test("KPI stat cards update to reflect the currently filtered rows", async ({ page }) => {
    // Regression test: stats used to be computed server-side from the full
    // unfiltered dataset and never changed no matter what you filtered --
    // a "584 rows" card sitting above a table filtered down to 335 rows.
    await page.goto("/explorer/french/catalog");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    const rowsCard = page.getByText("Rows", { exact: true }).locator("..");
    const before = await rowsCard.locator("div").first().textContent();

    await page.getByRole("combobox", { name: "Filter by Level", exact: true }).click();
    await page.getByRole("option", { name: "A1", exact: true }).click();
    await page.waitForTimeout(1200); // CountUp animates the card's number over 900ms

    const tableCount = await page.locator("text=/\\d+ of \\d+ rows/").first().textContent();
    const n = parseInt(tableCount!.match(/(\d+) of/)![1], 10);
    const after = await rowsCard.locator("div").first().textContent();

    expect(after).not.toBe(before);
    expect(parseInt(after!, 10)).toBe(n);
  });

  test("quick-filter dropdown matches the exact value, not a substring of it", async ({ page }) => {
    // Regression test: "level" has values like "A2", "A2 (inferred)", and
    // "A2+B1" where one is a literal substring of the others. The default
    // TanStack filterFn (includesString) let picking "A2" also match rows
    // whose level was "A2 (inferred)" or "A2+B1" -- silently over-including
    // rows instead of narrowing to just the chosen value.
    await page.goto("/explorer/french/catalog");
    await page.waitForLoadState("networkidle");
    await page.getByRole("combobox", { name: "Filter by Level", exact: true }).click();
    await page.getByRole("option", { name: "A2", exact: true }).click();
    await page.waitForTimeout(300);
    // Every visible row's Level cell must read exactly "A2", never a
    // longer value that merely contains "A2" as a substring.
    const levelCells = page.locator("tbody tr td:nth-child(4)");
    const count = await levelCells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(levelCells.nth(i)).toHaveText("A2");
    }
  });

  test("sortable column header changes row order", async ({ page }) => {
    await page.goto("/explorer/french/vocabulary");
    await page.waitForLoadState("networkidle");
    const firstWordBefore = await page.locator("tbody tr").first().locator("td").nth(1).textContent();
    await page.getByRole("button", { name: "Word", exact: true }).click();
    await page.waitForTimeout(200);
    const firstWordAfter = await page.locator("tbody tr").first().locator("td").nth(1).textContent();
    expect(firstWordAfter).not.toBe(firstWordBefore);
  });

  test("pagination controls move between pages", async ({ page }) => {
    await page.goto("/explorer/french/vocabulary");
    await page.waitForLoadState("networkidle");
    // Column 1 (Word) is unique per row, unlike Collection which repeats
    // across many consecutive rows and wouldn't reliably differ page-to-page.
    const firstWordBefore = await page.locator("tbody tr").first().locator("td").nth(1).textContent();
    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForTimeout(200);
    const firstWordAfter = await page.locator("tbody tr").first().locator("td").nth(1).textContent();
    expect(firstWordAfter).not.toBe(firstWordBefore);
    await expect(page.getByText(/Page 2 of/)).toBeVisible();
  });

  test("Download full CSV link resolves to a real static file", async ({ page, request }) => {
    await page.goto("/explorer/french/catalog");
    const href = await page.getByRole("link", { name: "Download full CSV" }).getAttribute("href");
    expect(href).toBe("/data/french/catalog.csv");
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("collection");
    expect(body).toContain("cosmopolite-a1-methode");
  });

  test("Export CSV produces a real downloaded file with real content", async ({ page }) => {
    await page.goto("/explorer/french/vocabulary");
    await page.waitForLoadState("networkidle");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    const path = await download.path();
    expect(path).toBeTruthy();
    const fs = await import("node:fs");
    const content = fs.readFileSync(path!, "utf-8");
    expect(content).toContain("word");
    expect(content.split("\n").length).toBeGreaterThan(100);
  });
});
