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

await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.waitForSelector("text=Total Sales · Today", { timeout: 20000 });
await page.waitForSelector("text=Income overview — 30 days", { timeout: 20000 });
await page.waitForSelector("text=Order statistics — 30 days", { timeout: 20000 });
await page.waitForSelector("text=Top selling items — 30 days", { timeout: 20000 });
console.log("1. dashboard rendered with all sections");
await page.waitForTimeout(800);
await page.screenshot({ path: "screenshots/dashboard.png", fullPage: true });
console.log("2. screenshot saved");

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("3. no console errors");

await browser.close();
