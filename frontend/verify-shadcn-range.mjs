import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
await page.waitForSelector("text=Income overview", { timeout: 20000 });
// Per-card period brackets
await page.waitForSelector("text=(Today)", { timeout: 10000 });
console.log("1. dashboard cards show period in brackets, e.g. (Today)");

// Open the shadcn calendar popover (trigger button shows the year)
await page.getByRole("button", { name: /2026/ }).first().click();
await page.waitForSelector(".rdp-root", { timeout: 10000 });
console.log("2. shadcn calendar popover opened");
await page.waitForTimeout(400);
await page.screenshot({ path: "screenshots/dashboard-calendar.png" });

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("3. no console errors");

await browser.close();
