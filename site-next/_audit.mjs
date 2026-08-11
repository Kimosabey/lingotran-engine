import { chromium, webkit, devices } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

const BASE = "http://localhost:4173";
const OUT = process.argv[2] || "./audit-out";
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["/", "home"],
  ["/engine", "engine"],
  ["/french", "french"],
  ["/french/cosmopolite-a1-methode", "french-book"],
  ["/german", "german"],
  ["/reference", "reference"],
  ["/explorer/french/catalog", "explorer-catalog"],
  ["/explorer/french/questions", "explorer-questions"],
  ["/nope-404", "notfound"],
];

const VIEWPORTS = [
  { w: 320, h: 640, name: "320" },
  { w: 375, h: 812, name: "375" },
  { w: 768, h: 1024, name: "768" },
  { w: 1440, h: 900, name: "1440" },
  { w: 2560, h: 1440, name: "2560" },
];

const report = { routes: {}, overflow: [], console: [], axe: {}, perf: {}, misc: {} };

const browser = await chromium.launch();

// ---------- 1. per-route: console errors, axe, perf, screenshots ----------
for (const [path, name] of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const msgs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") msgs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
  page.on("pageerror", (e) => msgs.push(`[pageerror] ${String(e).slice(0, 300)}`));
  const failed = [];
  page.on("requestfailed", (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));

  const t0 = Date.now();
  const resp = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => ({ err: String(e) }));
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(1200);

  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const res = performance.getEntriesByType("resource");
    const bytes = res.reduce((s, r) => s + (r.transferSize || 0), 0);
    const js = res.filter((r) => r.name.endsWith(".js")).reduce((s, r) => s + (r.transferSize || 0), 0);
    return {
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      loadEvent: Math.round(nav.loadEventEnd || 0),
      transferBytes: bytes,
      jsBytes: js,
      docBytes: (res.find((r) => r.initiatorType === "navigation") || {}).transferSize || 0,
      resourceCount: res.length,
      domNodes: document.getElementsByTagName("*").length,
    };
  });
  report.perf[name] = { path, status: resp?.status?.() ?? "err", loadMs, ...perf };

  // axe
  try {
    const a = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    report.axe[name] = a.violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help, n: v.nodes.length,
      sample: v.nodes.slice(0, 3).map((n) => ({ target: n.target.join(" "), summary: (n.failureSummary || "").replace(/\s+/g, " ").slice(0, 260) })),
    }));
  } catch (e) { report.axe[name] = [{ id: "AXE_ERROR", help: String(e).slice(0, 200) }]; }

  report.console.push({ name, msgs, failed });

  await page.screenshot({ path: `${OUT}/${name}-light.png`, fullPage: false });
  await page.evaluate(() => { document.documentElement.setAttribute("data-theme", "dark"); document.dispatchEvent(new CustomEvent("lt:themechange", { detail: "dark" })); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}-dark.png`, fullPage: false });

  await ctx.close();
}

// ---------- 2. horizontal overflow at every viewport ----------
for (const [path, name] of ROUTES) {
  for (const v of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h } });
    const page = await ctx.newPage();
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(900);
    const res = await page.evaluate(() => {
      const de = document.documentElement;
      const over = de.scrollWidth > de.clientWidth + 1;
      const culprits = [];
      if (over) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.right > de.clientWidth + 2 || r.left < -2)) {
            const cs = getComputedStyle(el);
            if (cs.position === "fixed") continue;
            culprits.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ").slice(0, 4).join(".")} right=${Math.round(r.right)}`);
          }
          if (culprits.length > 6) break;
        }
      }
      return { over, scrollW: de.scrollWidth, clientW: de.clientWidth, culprits };
    });
    if (res.over) report.overflow.push({ name, viewport: v.name, ...res });
    await ctx.close();
  }
}

// ---------- 3. targeted interaction checks on home ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // computed contrast for key text tokens (light)
  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    return {
      light: {
        bg: g("--bg"), surface: g("--surface"), text: g("--text"), textMuted: g("--text-muted"),
        textSubtle: g("--text-subtle"), link: g("--link"), verifiedStrong: g("--verified-strong"),
        flagStrong: g("--flag-strong"), amberStrong: g("--amber-strong"), border: g("--border"),
      },
    };
  });
  report.misc.tokens = tokens;

  // Section stagger: are delay classes present in DOM but missing in CSS?
  report.misc.staggerDelay = await page.evaluate(() => {
    const el = document.querySelector('[class*="delay-"]');
    if (!el) return { domHasDelayClass: false };
    const cls = [...el.classList].find((c) => c.startsWith("delay-"));
    return { domHasDelayClass: true, cls, computed: getComputedStyle(el).transitionDelay };
  });

  // tap targets < 24px (WCAG 2.2 AA 2.5.8)
  report.misc.smallTargets = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('a,button,input,select,[role="button"],[tabindex="0"]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 24 || r.height < 24) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out.slice(0, 20);
  });

  // keyboard: tab through first 25 stops, record focus visibility
  const tabStops = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return { tag: "BODY" };
      const cs = getComputedStyle(a);
      const r = a.getBoundingClientRect();
      return {
        tag: a.tagName, label: (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 40),
        outline: cs.outlineStyle + " " + cs.outlineWidth + " " + cs.outlineColor,
        visible: r.width > 0 && r.height > 0, inViewport: r.top >= 0 && r.top < window.innerHeight,
      };
    });
    tabStops.push(info);
  }
  report.misc.tabStops = tabStops;

  // "/" shortcut opens palette
  await page.keyboard.press("Escape");
  await page.click("body", { position: { x: 5, y: 400 } }).catch(() => {});
  await page.keyboard.press("/");
  await page.waitForTimeout(600);
  report.misc.slashOpensPalette = await page.evaluate(() => Boolean(document.querySelector('[role="dialog"]')));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  report.misc.escClosesPalette = await page.evaluate(() => !document.querySelector('[role="dialog"]'));

  // corpus table row expand keyboard
  const rowCount = await page.locator('table tr[role="button"]').count();
  report.misc.corpusRows = rowCount;

  // anchor / scroll-spy: click a section nav pill, check scroll landed under sticky headers
  const pill = page.locator('nav[aria-label="On this page"] a').nth(2);
  if (await pill.count()) {
    const target = await pill.getAttribute("href");
    await pill.click();
    await page.waitForTimeout(1000);
    report.misc.anchorLanding = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { missing: sel };
      const r = el.getBoundingClientRect();
      return { sel, top: Math.round(r.top), note: "positive = below viewport top; sticky chrome ~108-150px" };
    }, target);
  }

  await ctx.close();
}

// ---------- 4. theme toggle round-trip + persistence + FOUC ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.click('button[aria-label="Toggle light or dark theme"]');
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ attr: document.documentElement.getAttribute("data-theme"), ls: localStorage.getItem("lt-theme"), bg: getComputedStyle(document.body).backgroundColor }));
  await page.reload({ waitUntil: "networkidle" });
  const persisted = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  // charts repaint on toggle?
  await page.goto(BASE + "/german", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const chartBefore = await page.locator('div[role="img"]').first().screenshot().catch(() => null);
  await page.click('button[aria-label="Toggle light or dark theme"]');
  await page.waitForTimeout(1200);
  const chartAfter = await page.locator('div[role="img"]').first().screenshot().catch(() => null);
  report.misc.theme = { after, persisted, chartRepainted: chartBefore && chartAfter ? !chartBefore.equals(chartAfter) : "n/a" };
  await ctx.close();
}

// ---------- 5. explorer stress: filter, sort, paginate, dialog ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  const t0 = Date.now();
  await page.goto(BASE + "/explorer/french/questions", { waitUntil: "networkidle", timeout: 120000 });
  const navMs = Date.now() - t0;
  // time-to-interactive proxy: type in the search box and measure response
  const box = page.locator('input[aria-label="Search this dataset"]');
  const t1 = Date.now();
  await box.fill("maison");
  await page.waitForTimeout(50);
  await page.locator("table tbody tr").first().waitFor({ timeout: 20000 }).catch(() => {});
  const filterMs = Date.now() - t1;
  const filteredCount = await page.locator("table tbody tr").count();
  await box.fill("");
  await page.waitForTimeout(600);
  // sort
  const t2 = Date.now();
  await page.locator("table thead th button").first().click();
  await page.waitForTimeout(100);
  const sortMs = Date.now() - t2;
  // open row dialog
  await page.locator("table tbody tr").first().click();
  await page.waitForTimeout(700);
  const dialogOpen = await page.locator('[role="dialog"]').count();
  const dialogHasClose = await page.locator('[role="dialog"] button').count();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const dialogClosed = (await page.locator('[role="dialog"]').count()) === 0;
  report.misc.explorer = { navMs, filterMs, filteredCount, sortMs, dialogOpen, dialogHasClose, dialogClosed, errs };
  await ctx.close();
}

// ---------- 6. WebKit smoke ----------
{
  const wb = await webkit.launch();
  const ctx = await wb.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1000);
  const mobileNav = await page.locator('button[aria-label="Open menu"]').count();
  await page.locator('button[aria-label="Open menu"]').click().catch(() => {});
  await page.waitForTimeout(700);
  const sheetOpen = await page.locator('[role="dialog"]').count();
  await page.screenshot({ path: `${OUT}/webkit-mobile-nav.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const focusBack = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  const searchVisible = await page.locator('button:has-text("Search the corpus")').isVisible().catch(() => false);
  report.misc.webkit = { mobileNav, sheetOpen, focusBack, searchVisibleOnMobile: searchVisible, errs };
  await ctx.close();
  await wb.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
