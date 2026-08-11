import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://localhost:4173";
const OUT = process.argv[2];
const r = {};

const browser = await chromium.launch();

// ---- A. focus ring reality check ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  r.focusRings = await page.evaluate(() => {
    const out = [];
    const probes = [
      ['nav[aria-label="Primary"] a', "appbar nav link"],
      ['a[href="#corpus"]', "hero primary CTA"],
      ['input[aria-label="Search the corpus"]', "corpus search input"],
      ["select", "corpus filter select"],
      ['button[aria-label="Toggle light or dark theme"]', "theme toggle"],
      ['table tr[role="button"]', "corpus table row"],
      ['button[aria-label="Open menu"]', "mobile menu button"],
    ];
    for (const [sel, label] of probes) {
      const el = document.querySelector(sel);
      if (!el) { out.push({ label, missing: true }); continue; }
      el.focus();
      const cs = getComputedStyle(el);
      out.push({
        label, sel,
        outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor, outlineOffset: cs.outlineOffset,
        boxShadow: cs.boxShadow.slice(0, 120),
      });
    }
    return out;
  });

  // ---- B. sticky stack height vs scroll-margin ----
  r.stickyStack = await page.evaluate(() => {
    const topbar = document.querySelector("header");
    const appbar = document.querySelector('nav[aria-label="Primary"]');
    const secnav = document.querySelector('nav[aria-label="On this page"]');
    const section = document.querySelector("#corpus");
    const h = (e) => (e ? Math.round(e.getBoundingClientRect().height) : null);
    return {
      topbar: h(topbar), appbar: h(appbar), sectionNav: h(secnav),
      totalSticky: (h(topbar) || 0) + (h(appbar) || 0) + (h(secnav) || 0),
      sectionScrollMarginTop: section ? getComputedStyle(section).scrollMarginTop : null,
      mainScrollMarginTop: getComputedStyle(document.querySelector("main")).scrollMarginTop,
    };
  });

  // land on each section nav pill and measure clipping
  const pills = await page.locator('nav[aria-label="On this page"] a').all();
  const landings = [];
  for (const p of pills) {
    const href = await p.getAttribute("href");
    await p.click();
    await page.waitForTimeout(800);
    const info = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const heading = el?.querySelector("h2");
      const eyebrow = el?.querySelector("span");
      return {
        sectionTop: el ? Math.round(el.getBoundingClientRect().top) : null,
        eyebrowTop: eyebrow ? Math.round(eyebrow.getBoundingClientRect().top) : null,
        headingTop: heading ? Math.round(heading.getBoundingClientRect().top) : null,
      };
    }, href);
    landings.push({ href, ...info });
  }
  r.anchorLandings = landings;

  await ctx.close();
}

// ---- C. contrast math on real rendered pairs, both themes ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const measure = async (theme) => {
    await page.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
      document.dispatchEvent(new CustomEvent("lt:themechange", { detail: t }));
    }, theme);
    await page.waitForTimeout(500);
    return page.evaluate(() => {
      const lum = (c) => {
        const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const parse = (s) => { const m = s.match(/[\d.]+/g) || []; return { rgb: [ +m[0]||0, +m[1]||0, +m[2]||0 ], a: m[3] === undefined ? 1 : +m[3] }; };
      const over = (fg, bg) => fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));
      const ratio = (a, b) => { const [L1, L2] = [lum(a), lum(b)].sort((x, y) => y - x); return +((L1 + 0.05) / (L2 + 0.05)).toFixed(2); };
      const effBg = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c.a > 0.95) return c.rgb;
          n = n.parentElement;
        }
        return [255, 255, 255];
      };
      const probes = [
        ["h1", "hero H1"],
        ["main p", "body paragraph (text-muted)"],
        ['span.text-link', "eyebrow / link color"],
        ['[class*="text-text-subtle"]', "text-subtle small text"],
        ['a[href="#corpus"]', "primary CTA label on brand"],
        ['[class*="text-verified-strong"]', "verified green text"],
        ['[class*="text-amber-strong"]', "amber in-progress text"],
        ["footer span", "footer text"],
        ["table thead th", "table header"],
        ['input[aria-label="Search the corpus"]', "search input text"],
        ["kbd", "kbd hint"],
      ];
      const out = [];
      for (const [sel, label] of probes) {
        const el = document.querySelector(sel);
        if (!el) { out.push({ label, missing: true }); continue; }
        const cs = getComputedStyle(el);
        const fg = parse(cs.color);
        const bg = effBg(el);
        const size = parseFloat(cs.fontSize);
        const bold = +cs.fontWeight >= 700;
        const large = size >= 24 || (size >= 18.66 && bold);
        const cr = ratio(over(fg, bg), bg);
        out.push({ label, fontPx: size, large, ratio: cr, passAA: large ? cr >= 3 : cr >= 4.5, passAAA: large ? cr >= 4.5 : cr >= 7 });
      }
      // non-text: borders & focus ring vs surface
      const nonText = [];
      const cardBorder = getComputedStyle(document.querySelector('[class*="border-border"]') || document.body).borderTopColor;
      nonText.push({ label: "card border vs page bg", ratio: ratio(parse(cardBorder).rgb, effBg(document.body)) });
      const ringVar = getComputedStyle(document.documentElement).getPropertyValue("--ring").trim();
      nonText.push({ label: "--ring token", value: ringVar });
      return { text: out, nonText };
    });
  };

  r.contrastLight = await measure("light");
  r.contrastDark = await measure("dark");
  await ctx.close();
}

// ---- D. no-JS / SSR visibility of section content ----
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  r.noJs = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")];
    return {
      sectionCount: secs.length,
      opacities: secs.map((s) => getComputedStyle(s.querySelector("h2") || s).opacity),
      corpusConsoleRows: document.querySelectorAll("table tbody tr").length,
      chartPlaceholders: document.querySelectorAll('div[role="img"]').length,
    };
  });
  await page.screenshot({ path: `${OUT}/nojs-home.png`, fullPage: false });
  await ctx.close();
}

// ---- E. reduced motion ----
{
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  r.reducedMotion = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section h2")];
    const kpi = document.querySelector('[class*="font-display"][class*="text-2xl"]');
    return {
      headingOpacities: secs.map((s) => getComputedStyle(s).opacity),
      firstKpiValue: kpi?.textContent?.trim(),
      glyphAnimation: getComputedStyle(document.querySelector(".hero-glyphs span") || document.body).animationDuration,
      inProgressPulse: (() => { const el = document.querySelector('[class*="animate-pulse"]'); return el ? getComputedStyle(el).animationDuration : "none"; })(),
    };
  });
  await ctx.close();
}

// ---- F. CLS + LCP on home & explorer ----
for (const [path, name] of [["/", "home"], ["/german", "german"], ["/explorer/french/questions", "explorer-questions"]]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__cls = 0; window.__lcp = 0; window.__shifts = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), src: (e.sources || []).map((s) => s.node?.tagName + "." + (s.node?.className || "").toString().split(" ")[0]).slice(0, 2) }); } }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { const es = l.getEntries(); window.__lcp = es[es.length - 1]?.startTime || 0; window.__lcpEl = es[es.length - 1]?.element?.tagName; }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(1500);
  r[`vitals_${name}`] = await page.evaluate(() => ({
    cls: +window.__cls.toFixed(4), lcpMs: Math.round(window.__lcp), lcpEl: window.__lcpEl,
    topShifts: window.__shifts.sort((a, b) => b.v - a.v).slice(0, 5),
    fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0),
  }));
  await ctx.close();
}

// ---- G. 320px squeeze on key components ----
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/home-320.png`, fullPage: false });
  r.squeeze320 = await page.evaluate(() => {
    const clipped = [];
    for (const el of document.querySelectorAll("main *")) {
      if (el.children.length) continue;
      const t = (el.textContent || "").trim();
      if (!t) continue;
      if (el.scrollWidth > el.clientWidth + 2) clipped.push(`${el.tagName} "${t.slice(0, 34)}" ${el.scrollWidth}>${el.clientWidth}`);
      if (clipped.length > 14) break;
    }
    const kpi = document.querySelector('[class*="grid-cols-2"]');
    return { clipped, kpiCardWidth: kpi ? Math.round(kpi.firstElementChild.getBoundingClientRect().width) : null };
  });
  await page.goto(BASE + "/explorer/french/catalog", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/explorer-320.png`, fullPage: false });
  await ctx.close();
}

// ---- H. dark-mode paper motif + chart legibility screenshots ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/home-dark-system.png` });
  r.darkSystemDefault = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute("data-theme"),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    toggleIcon: (() => { const b = document.querySelector('button[aria-label="Toggle light or dark theme"]'); const suns = b?.querySelectorAll("svg"); return suns ? [...suns].map((s) => getComputedStyle(s).opacity) : null; })(),
  }));
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/report2.json`, JSON.stringify(r, null, 2));
console.log(JSON.stringify(r, null, 2));
