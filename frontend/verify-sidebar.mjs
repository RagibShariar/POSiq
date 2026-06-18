import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.fill("#email", "ragib@test.com");
await page.fill("#password", "ResetPass789");
await page.click("button[type=submit]");
await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30000 });

await page.goto(`${BASE}/products`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");

const active = page.locator('aside a[href="/products"]');
const bgImage = await active.evaluate((el) => getComputedStyle(el).backgroundImage);
console.log("active backgroundImage:", bgImage);
await page.screenshot({ path: "screenshots/sidebar-light.png", clip: { x: 0, y: 0, width: 230, height: 480 } });

await browser.close();
