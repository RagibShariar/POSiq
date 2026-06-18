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

// Dashboard topbar branch badge
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.locator("header").first().getByText(/branch|MAIN|GUL/i).first().waitFor({ timeout: 10000 });
const dashText = await page.locator("header").first().innerText();
console.log("1. dashboard topbar has branch info:", /branch/i.test(dashText) || /MAIN|GUL/.test(dashText));
await page.screenshot({ path: "screenshots/branch-dashboard.png", clip: { x: 0, y: 0, width: 760, height: 60 } });

// POS header branch badge
await page.goto(`${BASE}/pos`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.locator("header").first().getByText(/branch|MAIN|GUL/i).first().waitFor({ timeout: 10000 });
console.log("2. POS header has branch info ✓");
await page.screenshot({ path: "screenshots/branch-pos.png", clip: { x: 0, y: 0, width: 900, height: 60 } });

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("3. no console errors");

await browser.close();
