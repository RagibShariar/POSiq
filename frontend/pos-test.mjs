import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// Cashier login lands on /pos
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.fill("#email", "karim@test.com");
await page.fill("#password", "ManagerPass123");
await page.click("button[type=submit]");
await page.waitForURL("**/pos", { timeout: 30000 });
console.log("1. cashier login → /pos");

await page.waitForSelector("text=Lays Original", { timeout: 30000 });

// Add items: 2x Lays (30) + 1x Nescafe (250) → subtotal 310
await page.click("text=Lays Original");
await page.click("text=Lays Original");
await page.fill('input[placeholder*="Search name"]', "Nescafe");
await page.waitForTimeout(600);
await page.click("text=Nescafe Classic");
console.log("2. cart: 2x Lays + 1x Nescafe (count badge should say 3 items)");
await page.waitForSelector("text=3 items", { timeout: 10000 });

// 10% discount; VAT at whatever rate the owner configured
await page.fill('input[placeholder="0"][type="number"]', "10");
await page.waitForSelector("text=/VAT \\(\\d+/", { timeout: 10000 });
console.log("3. 10% discount + VAT line visible");

// Customer info
await page.fill('input[placeholder="Customer name (optional)"]', "Rahim Uddin");
await page.fill('input[placeholder="Mobile no."]', "01712345678");

await page.screenshot({ path: "screenshots/pos-cart.png" });

// Charge → payment dialog
await page.click('button:has-text("Charge")');
await page.waitForSelector("text=Take payment", { timeout: 10000 });
console.log("4. payment dialog open");

// Split: cash 100 (gave 100) + card for the rest with approval no.
const dialog = page.locator('[role="dialog"]:has-text("Take payment")');
await dialog.locator('input[type="number"]').first().fill("100");
await dialog.locator('input[type="number"]').nth(1).fill("100"); // customer gave
await dialog.locator('button:has-text("Split")').click();
console.log("5. split added (cash 100 + card remainder)");

// Card reference
await dialog.locator('input[placeholder="e.g. 123456"]').fill("APPR-7788");

// Complete
await dialog.locator('button:has-text("Complete sale")').click();
await page.waitForSelector("text=Thank you for your purchase!", { timeout: 30000 });
const receiptText = await page.locator("#receipt").innerText();
const orderNo = receiptText.match(/ORD-\d{4}-\d{5}/)?.[0];
console.log(`6. sale completed — ${orderNo}`);

// Verify receipt contents
const must = ["Rahim Uddin", "01712345678", "Tax", "Cash", "Card", "APPR-7788"];
for (const m of must) {
  if (!receiptText.includes(m)) throw new Error(`Receipt missing: ${m}`);
}
console.log("7. receipt shows customer, tax, split payments, card reference");
await page.screenshot({ path: "screenshots/pos-receipt.png" });

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("8. no console errors");

await browser.close();
