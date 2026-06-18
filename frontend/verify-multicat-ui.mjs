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

await page.goto(`${BASE}/products`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.waitForSelector("text=/List of menu items \\(/", { timeout: 20000 });
console.log("1. 'List of menu items (N items)' header + bigger tabs visible");
await page.screenshot({ path: "screenshots/products-multicat-table.png" });

await page.click('button:has-text("New product")');
await page.waitForSelector("text=Categories", { timeout: 10000 });
// Tick two category chips
const dialog = page.locator('[role="dialog"]');
const checkboxes = dialog.locator('label:has(input[type="checkbox"])');
// Categories are the first group of checkbox-labels in the dialog
await dialog.getByText("Beverages", { exact: true }).click();
await dialog.getByText("Snacks", { exact: true }).click();
console.log("2. new-product modal (wider) — multiple categories selectable");
await page.screenshot({ path: "screenshots/products-multicat-modal.png" });

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("3. no console errors");

await browser.close();
