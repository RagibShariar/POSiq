import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// Cashier login lands on /pos
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "karim@test.com");
await page.fill("#password", "ManagerPass123");
await page.click("button[type=submit]");
await page.waitForURL("**/pos", { timeout: 30000 });
console.log("1. cashier login → /pos");

// Products load
await page.waitForSelector("text=Lays Original", { timeout: 30000 });
console.log("2. product grid loaded");

// Add items: 2x Lays, 1x Nescafe
await page.click("text=Lays Original");
await page.click("text=Lays Original");
await page.fill('input[placeholder*="Search name"]', "Nescafe");
await page.waitForTimeout(600);
await page.click("text=Nescafe Classic");
console.log("3. added 2x Lays + 1x Nescafe to cart");

// Apply discount
await page.fill('input[placeholder="0"][type="number"]', "10");
await page.screenshot({ path: "screenshots/pos-cart.png" });
console.log("4. cart screenshot taken (discount ৳10 applied)");

// Checkout with cash
await page.click('button:has-text("Charge")');
await page.waitForSelector("text=Thank you for your purchase!", { timeout: 30000 });
const receiptText = await page.locator("#receipt").innerText();
const orderNo = receiptText.match(/ORD-\d{4}-\d{5}/)?.[0];
console.log(`5. checkout OK — receipt shown, order ${orderNo}`);
await page.screenshot({ path: "screenshots/pos-receipt.png" });

// New sale resets the cart
await page.click('button:has-text("New sale")');
await page.waitForSelector("text=Tap products to add them", { timeout: 10000 });
console.log("6. new sale — cart cleared");

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("7. no console errors");

await browser.close();
