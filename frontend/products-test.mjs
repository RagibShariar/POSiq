import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const SKU = `COKE-${Date.now() % 100000}`;

// Owner login
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "ragib@test.com");
await page.fill("#password", "ResetPass789");
await page.click("button[type=submit]");
await page.waitForURL("**/dashboard", { timeout: 30000 });
console.log("1. owner login");

// Products page — create a product
await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Nescafe Classic", { timeout: 30000 });
console.log("2. products table loaded");

await page.click('button:has-text("New product")');
await page.fill("#p-name", "Coca Cola 500ml");
await page.fill("#p-sku", SKU);
await page.fill("#p-price", "45");
await page.fill("#p-cost", "32");
await page.click('button:has-text("Create product")');
await page.waitForSelector("text=Coca Cola 500ml", { timeout: 15000 });
console.log(`3. product created (${SKU})`);
await page.screenshot({ path: "screenshots/products.png" });

// Inventory page — defaults to Main Branch (empty); restock the new product there
await page.goto(`${BASE}/inventory`, { waitUntil: "networkidle" });
await page.waitForSelector("text=No stock at this branch yet", { timeout: 30000 });
console.log("4. inventory table loaded (main branch, empty as expected)");

await page.click('button:has-text("Restock")');
await page.click('[role="combobox"]:has-text("Choose product")');
await page.click(`[role="option"]:has-text("Coca Cola 500ml")`);
await page.fill("#r-qty", "24");
await page.fill("#r-note", "Initial delivery");
await page.click('button:has-text("Add stock")');
await page.waitForSelector("text=Coca Cola 500ml", { timeout: 15000 });
console.log("5. restocked 24 units — row visible");
await page.screenshot({ path: "screenshots/inventory.png" });

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("6. no console errors");

await browser.close();
