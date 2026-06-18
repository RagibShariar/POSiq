import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// Owner login
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.fill("#email", "ragib@test.com");
await page.fill("#password", "ResetPass789");
await page.click("button[type=submit]");
await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30000 });
console.log("1. owner logged in");

await page.goto(`${BASE}/products`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.waitForSelector("text=Variations", { timeout: 20000 });
console.log("2. products table shows # + Variations columns");
await page.screenshot({ path: "screenshots/products-table.png" });

// New product modal — variations checkbox flow
await page.click('button:has-text("New product")');
await page.waitForSelector("text=This product has variations", { timeout: 10000 });
await page.click("text=This product has variations");
await page.click('button:has-text("Add variation")');
const dialog = page.locator('[role="dialog"]');
await dialog.locator('input[placeholder="e.g. Large"]').fill("Small");
await dialog.locator('input[placeholder="৳ price"]').fill("50");
console.log("3. new-product modal: variations checkbox + row + modifier-group checkboxes");
await page.screenshot({ path: "screenshots/products-new-modal.png" });
await page.keyboard.press("Escape");

// View modal for Coca Cola (has a variation from the earlier backend test)
const row = page.locator("tr", { hasText: "Coca Cola 500ml" }).first();
await row.getByTitle("View details").click();
await page.waitForSelector("text=/Variations \\(/", { timeout: 10000 });
console.log("4. view modal opened with variation details");
await page.screenshot({ path: "screenshots/products-view-modal.png" });

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("5. no console errors");

await browser.close();
