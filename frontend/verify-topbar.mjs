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
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");

// Highlighted POS button in the topbar
await page.waitForSelector('header a[href="/pos"]:has-text("POS")', { timeout: 10000 });
console.log("1. POS quick-access button present in topbar");
await page.screenshot({ path: "screenshots/topbar-pos.png" });

// Clicking it navigates to POS
await page.click('header a[href="/pos"]');
await page.waitForURL("**/pos", { timeout: 15000 });
console.log("2. POS button navigates to /pos");

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("3. no console errors");

await browser.close();
