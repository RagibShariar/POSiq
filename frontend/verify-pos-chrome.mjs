import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.fill("#email", "ragib@test.com");
await page.fill("#password", "ResetPass789");
await page.click("button[type=submit]");
await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30000 });

// 1) Topbar POS button opens in a new tab (target=_blank)
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
const tgt = await page.locator('header a[href="/pos"]').getAttribute("target");
console.log("1. POS button target:", tgt, tgt === "_blank" ? "(new tab ✓)" : "(NOT new tab)");

// 2) POS page header has clock + calculator + theme toggle
await page.goto(`${BASE}/pos`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
const header = page.locator("header").first();
await header.locator("text=/\\d{1,2} [A-Z][a-z]{2} \\d{4}/").waitFor({ timeout: 10000 });
const hasCalc = await header.locator('button[aria-label="Calculator"]').count();
const hasTheme = await header.locator('button[aria-label="Toggle theme"]').count();
console.log("2. POS header — clock ✓, calculator:", hasCalc, "theme toggle:", hasTheme);
await page.screenshot({ path: "screenshots/pos-chrome.png", clip: { x: 0, y: 0, width: 1440, height: 60 } });

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("3. no console errors");

await browser.close();
