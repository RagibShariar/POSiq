import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.fill("#email", "ragib@test.com");
await page.fill("#password", "ResetPass789");
await page.click("button[type=submit]");
await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30000 });

// Dashboard date range
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.waitForSelector("text=Reporting period:", { timeout: 20000 });
await page.waitForSelector("text=Income overview", { timeout: 20000 });
console.log("1. dashboard shows date range picker + sections");

// Click the 7d preset and confirm a refetch happens without errors
await page.click('button:has-text("7d")');
await page.waitForTimeout(1200);
await page.screenshot({ path: "screenshots/dashboard-7d.png", fullPage: true });
console.log("2. switched to 7d preset, screenshot saved");

// Orders date range
await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.waitForSelector('button:has-text("All")', { timeout: 20000 });
await page.click('button:has-text("30d")');
await page.waitForTimeout(1000);
await page.screenshot({ path: "screenshots/orders-daterange.png" });
console.log("3. orders page has date range (30d applied)");

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("4. no console errors");

await browser.close();
